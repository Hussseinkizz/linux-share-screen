import type { Mode, ShareState, Status } from "@/shared/rpc";
import { APP_VERSION } from "../shared/version";
import { ensureCert } from "./certs";
import { readConfig, writeConfig } from "./config";
import { log } from "./log";
import { findFreePort, pickLanIp } from "./net";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { engineBinary, resourcesDir, viewerDir } from "./paths";
import { killProcess } from "./process";
import { ensureToken, rotateToken as rotateStoredToken, tokenFile } from "./token";
import { TunnelManager } from "./tunnel";

const READY_TIMEOUT_MS = 25000;

function backendFromEnvironment(): { backend: "wayland" | "x11"; note: string } {
	if (process.env.WAYLAND_DISPLAY) {
		return { backend: "wayland", note: `Wayland display ${process.env.WAYLAND_DISPLAY}` };
	}
	if (process.env.DISPLAY) {
		return { backend: "x11", note: `X11 display ${process.env.DISPLAY}` };
	}
	throw new Error("No graphical session found. Start the app from your desktop session.");
}

function humanize(message: string): string {
	if (/Cannot listen on .*:(\d+)/.test(message)) return "The sharing port is already in use. Try again.";
	if (/does not offer zwlr_screencopy_manager_v1/.test(message))
		return "This desktop needs the patched screen relay engine (Wayland capture is unavailable).";
	if (/does not offer ext_image_copy_capture_manager_v1/.test(message))
		return "This desktop does not allow screen capture.";
	if (/Compositor|compositor/.test(message)) return "Screen capture failed: the compositor refused the request.";
	if (/Capture startup failed|Capture worker/.test(message)) return `Screen capture failed: ${message}`;
	if (/token/i.test(message)) return "The access token file is invalid. Use “New link” and try again.";
	return message;
}

export class SessionManager {
	private engine: Bun.Subprocess<"ignore", "pipe", "pipe"> | null = null;
	private tunnel = new TunnelManager();
	private status: Status = "idle";
	private mode: Mode = readConfig().mode ?? "internet";
	private link: string | null = null;
	private error: string | null = null;
	private audio = readConfig().audio ?? true;
	private busy = false;

	onChange?: (state: ShareState) => void;

	state(): ShareState {
		return {
			status: this.status,
			mode: this.mode,
			link: this.link,
			error: this.error,
			logs: log.tail(20),
			lanIp: pickLanIp(),
			audio: this.audio,
			version: APP_VERSION,
		};
	}

	private emit(): void {
		this.onChange?.(this.state());
	}

	private setStatus(status: Status): void {
		this.status = status;
		this.emit();
	}

	async start(mode: Mode): Promise<ShareState> {
		if (this.busy || this.status === "sharing" || this.status === "starting") return this.state();
		this.busy = true;
		this.mode = mode;
		this.error = null;
		this.setStatus("starting");
		try {
			await this.stopChildren();
			await this.launch(mode);
			this.setStatus("sharing");
		} catch (error) {
			await this.stopChildren();
			const message = error instanceof Error ? error.message : String(error);
			this.error = humanize(message);
			log.add(`start failed: ${message}`);
			this.setStatus("error");
		} finally {
			this.busy = false;
		}
		return this.state();
	}

	setAudio(enabled: boolean): ShareState {
		this.audio = enabled;
		writeConfig({ ...readConfig(), audio: enabled });
		this.emit();
		return this.state();
	}

	private audioFlags(): string[] {
		if (!this.audio) return [];
		const parec = join(resourcesDir(), "parec");
		const pactl = join(resourcesDir(), "pactl");
		if (!existsSync(parec) || !existsSync(pactl)) {
			log.add("audio requested but capture helpers are missing");
			return [];
		}
		const probe = Bun.spawnSync([pactl, "get-default-sink"], { stdout: "pipe", stderr: "ignore" });
		const sink = new TextDecoder().decode(probe.stdout).trim();
		if (probe.exitCode !== 0 || !sink) {
			log.add("audio requested but no default sink was found");
			return [];
		}
		return ["--audio", "--audio-tool", parec, "--audio-device", `${sink}.monitor`];
	}

	private async launch(mode: Mode): Promise<void> {
		const { backend, note } = backendFromEnvironment();
		const token = ensureToken();
		const port = await findFreePort();
		log.add(`starting${mode === "internet" ? " (internet)" : " (home network)"} on ${backend}, ${note}`);

		let base: string;
		const args = [engineBinary(), "--backend", backend, "--port", String(port), "--token-file", tokenFile(), "--viewer-dir", viewerDir(), ...this.audioFlags()];

		if (mode === "internet") {
			const tunnel = await this.tunnel.start(port);
			log.add(`tunnel ready: ${tunnel.url}`);
			args.push("--bind", "127.0.0.1", "--behind-tls-proxy", "--public-origin", tunnel.url);
			base = tunnel.url;
		} else {
			const ip = pickLanIp();
			if (!ip) throw new Error("No local network address found");
			const certs = ensureCert(ip);
			args.push("--bind", "0.0.0.0", "--public-origin", `https://${ip}:${port}`, "--tls-cert", certs.cert, "--tls-key", certs.key);
			base = `https://${ip}:${port}`;
		}

		const proc = Bun.spawn({
			cmd: args,
			stdout: "pipe",
			stderr: "pipe",
			env: process.env,
		});
		this.engine = proc;
		this.pumpStderr(proc);
		await this.waitForReady(proc);
		this.link = `${base}/#token=${token}`;
		writeConfig({ mode, port });
		log.add(`sharing ready on port ${port}`);
		if (mode === "internet") {
			// A fresh quick-tunnel hostname takes a few seconds to resolve. Check
			// in the background; never block sharing on it (the viewing device
			// resolves the name independently, and local resolvers may briefly
			// cache the early NXDOMAIN).
			void this.verifyReachable(base).then((reachable) => {
				log.add(reachable ? `tunnel reachable: ${base}` : `tunnel not confirmed reachable: ${base}`);
			});
		}
	}

	private pumpStderr(proc: Bun.Subprocess<"ignore", "pipe", "pipe">): void {
		const pump = async () => {
			const reader = proc.stderr.getReader();
			const decoder = new TextDecoder();
			let buffer = "";
			for (;;) {
				const { done, value } = await reader.read();
				if (done) return;
				buffer += decoder.decode(value, { stream: true });
				const lines = buffer.split("\n");
				buffer = lines.pop() ?? "";
				for (const line of lines) if (line.trim()) log.add(`engine: ${line.trim()}`);
			}
		};
		pump().catch(() => undefined);
	}

	private waitForReady(proc: Bun.Subprocess<"ignore", "pipe", "pipe">): Promise<void> {
		return new Promise<void>((resolve, reject) => {
			let settled = false;
			let buffer = "";
			const finish = (error?: Error) => {
				if (settled) return;
				settled = true;
				clearTimeout(timer);
				if (error) reject(error);
				else resolve();
			};
			const timer = setTimeout(() => finish(new Error("The engine did not start in time")), READY_TIMEOUT_MS);

			const pump = async () => {
				const reader = proc.stdout.getReader();
				const decoder = new TextDecoder();
				for (;;) {
					const { done, value } = await reader.read();
					if (done) return;
					buffer += decoder.decode(value, { stream: true });
					const lines = buffer.split("\n");
					buffer = lines.pop() ?? "";
					for (const line of lines) {
						if (!line.trim()) continue;
						try {
							const message = JSON.parse(line) as { ready?: boolean };
							if (message.ready) finish();
						} catch {
							// Non-JSON stdout is not part of the contract.
						}
					}
				}
			};

			pump().catch((error) => finish(error instanceof Error ? error : new Error(String(error))));
			proc.exited.then((code) => {
				const tail = log
					.tail(8)
					.filter((line) => line.includes("engine:"))
					.at(-1)
					?.replace(/^.*engine: /, "");
				finish(new Error(tail || `The engine exited (code ${code})`));
			});
		});
	}

	/** DNS for a fresh quick-tunnel host can take a while; purely diagnostic. */
	private async verifyReachable(base: string, attempts = 20): Promise<boolean> {
		await Bun.sleep(8000);
		for (let attempt = 0; attempt < attempts; attempt++) {
			try {
				const response = await fetch(`${base}/`, { redirect: "follow" });
				if (response.ok) return true;
			} catch {
				// Retry.
			}
			await Bun.sleep(1000);
		}
		return false;
	}

	async stop(): Promise<ShareState> {
		this.busy = true;
		try {
			await this.stopChildren();
			this.link = null;
			this.error = null;
			this.setStatus("idle");
		} finally {
			this.busy = false;
		}
		return this.state();
	}

	private async stopChildren(): Promise<void> {
		const engine = this.engine;
		this.engine = null;
		if (engine) await killProcess(engine);
		await this.tunnel.stop();
	}

	/** Synchronous last-resort cleanup for process exit handlers. */
	forceKill(): void {
		try {
			this.engine?.kill();
		} catch {
			// Already gone.
		}
		this.engine = null;
		this.tunnel.forceKill();
	}

	async rotateToken(): Promise<ShareState> {
		const wasSharing = this.status === "sharing" || this.status === "starting";
		await this.stop();
		rotateStoredToken();
		log.add("token rotated");
		if (wasSharing) this.setStatus("idle");
		return this.state();
	}
}
