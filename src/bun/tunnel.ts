import { cloudflaredBinary } from "./paths";
import { log } from "./log";
import { killProcess } from "./process";

export interface TunnelInfo {
	url: string;
	host: string;
}

/**
 * Quick Cloudflare tunnel in front of the local engine. Cloudflare terminates
 * TLS with a trusted certificate, so phones and TV browsers need no cert
 * exception. The URL changes on every start.
 */
export class TunnelManager {
	private proc: Bun.Subprocess<"ignore", "ignore", "pipe"> | null = null;

	async start(port: number, timeoutMs = 30000): Promise<TunnelInfo> {
		await this.stop();
		const binary = cloudflaredBinary();
		const proc = Bun.spawn({
			cmd: [binary, "tunnel", "--url", `http://127.0.0.1:${port}`, "--no-autoupdate"],
			stdout: "ignore",
			stderr: "pipe",
			env: process.env,
		});
		this.proc = proc;
		log.add(`tunnel starting on 127.0.0.1:${port}`);

		return new Promise<TunnelInfo>((resolve, reject) => {
			let settled = false;
			let buffer = "";
			const finish = (error?: Error, info?: TunnelInfo) => {
				if (settled) return;
				settled = true;
				clearTimeout(timer);
				if (error) reject(error);
				else resolve(info!);
			};
			const timer = setTimeout(() => {
				finish(new Error("The Cloudflare tunnel did not start in time"));
			}, timeoutMs);

			const pump = async () => {
				const reader = proc.stderr.getReader();
				const decoder = new TextDecoder();
				for (;;) {
					const { done, value } = await reader.read();
					if (done) return;
					buffer += decoder.decode(value, { stream: true });
					const lines = buffer.split("\n");
					buffer = lines.pop() ?? "";
					for (const line of lines) {
						log.add(`tunnel: ${line.trim()}`);
						const match = line.match(/https:\/\/([a-z0-9-]+\.trycloudflare\.com)/i);
						if (match) finish(undefined, { url: `https://${match[1]}`, host: match[1]! });
					}
				}
			};

			pump().catch((error) => finish(error instanceof Error ? error : new Error(String(error))));
			proc.exited.then((code) => {
				finish(new Error(code === 0 ? "The Cloudflare tunnel stopped" : `The Cloudflare tunnel exited (code ${code})`));
			});
		});
	}

	async stop(): Promise<void> {
		const proc = this.proc;
		this.proc = null;
		if (proc) await killProcess(proc);
	}

	/** Synchronous last-resort kill for process exit handlers. */
	forceKill(): void {
		try {
			this.proc?.kill();
		} catch {
			// Already gone.
		}
		this.proc = null;
	}
}
