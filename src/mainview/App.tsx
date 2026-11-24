import { useCallback, useEffect, useRef, useState } from "react";
import QRCode from "qrcode";
import { Electroview } from "electrobun/view";
import type { AppRPC, Mode, ShareState } from "@/shared/rpc";
import { APP_VERSION } from "@/shared/version";

const listeners = new Set<(state: ShareState) => void>();

const rpc = Electroview.defineRPC<AppRPC>({
	// Tunnel startup can take ~20s; do not reject at the default 1s.
	maxRequestTime: 120000,
	handlers: {
		requests: {},
		messages: {
			stateChanged: (state: ShareState) => {
				for (const listener of listeners) listener(state);
			},
		} as never,
	},
});
new Electroview({ rpc });
const api = rpc.request;

const IDLE: ShareState = {
	status: "idle",
	mode: "internet",
	link: null,
	error: null,
	logs: [],
	lanIp: null,
	audio: true,
	namedTunnel: null,
	version: APP_VERSION,
};

const STATUS_LABEL: Record<ShareState["status"], string> = {
	idle: "Not sharing",
	starting: "Starting…",
	sharing: "Sharing",
	error: "Needs attention",
};

export function App() {
	const [state, setState] = useState<ShareState>(IDLE);
	const [tab, setTab] = useState<"share" | "preview">("share");
	const [showQr, setShowQr] = useState(false);
	const [qr, setQr] = useState<string | null>(null);
	const [copied, setCopied] = useState(false);
	const [preview, setPreview] = useState<string | null>(null);
	const [previewError, setPreviewError] = useState<string | null>(null);
	const [tunnelToken, setTunnelToken] = useState("");
	const [tunnelHost, setTunnelHost] = useState("");
	const [tunnelError, setTunnelError] = useState<string | null>(null);
	const copiedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

	useEffect(() => {
		listeners.add(setState);
		api.getState({}).then((next) => {
			setState(next);
			setTunnelHost(next.namedTunnel ?? "");
		}).catch(() => undefined);
		return () => {
			listeners.delete(setState);
		};
	}, []);

	useEffect(() => {
		if (!showQr || !state.link) {
			setQr(null);
			return;
		}
		QRCode.toDataURL(state.link, { margin: 1, width: 380 }).then(setQr).catch(() => setQr(null));
	}, [showQr, state.link]);

	const busy = state.status === "starting";
	const sharing = state.status === "sharing";

	useEffect(() => {
		if (tab !== "preview" || !sharing) {
			setPreview(null);
			setPreviewError(null);
			return;
		}
		let active = true;
		const tick = async () => {
			try {
				const frame = await api.getPreview({});
				if (!active) return;
				setPreview(frame.data);
				setPreviewError(frame.error ?? null);
			} catch (error) {
				if (active) setPreviewError(error instanceof Error ? error.message : String(error));
			}
		};
		void tick();
		const timer = setInterval(tick, 1000);
		return () => {
			active = false;
			clearInterval(timer);
		};
	}, [tab, sharing]);

	const toggle = useCallback(() => {
		if (busy) return;
		if (sharing) void api.stop({});
		else void api.start({ mode: state.mode });
	}, [busy, sharing, state.mode]);

	useEffect(() => {
		const onKey = (event: KeyboardEvent) => {
			if (event.code !== "Space") return;
			const target = event.target as HTMLElement | null;
			if (target && /^(INPUT|TEXTAREA|SELECT|BUTTON)$/.test(target.tagName)) return;
			event.preventDefault();
			toggle();
		};
		window.addEventListener("keydown", onKey);
		return () => window.removeEventListener("keydown", onKey);
	}, [toggle]);

	const copy = useCallback(async () => {
		if (!state.link) return;
		try {
			await navigator.clipboard.writeText(state.link);
		} catch {
			await api.copyText({ text: state.link });
		}
		setCopied(true);
		if (copiedTimer.current) clearTimeout(copiedTimer.current);
		copiedTimer.current = setTimeout(() => setCopied(false), 1600);
	}, [state.link]);

	const chooseMode = (mode: Mode) => {
		if (sharing || busy) return;
		setState((current) => ({ ...current, mode }));
	};

	const saveTunnel = async () => {
		setTunnelError(null);
		try {
			const next = await api.setTunnel({ token: tunnelToken, hostname: tunnelHost });
			setState(next);
			setTunnelHost(next.namedTunnel ?? "");
			setTunnelToken("");
		} catch (error) {
			setTunnelError(error instanceof Error ? error.message : String(error));
		}
	};

	return (
		<div className="app">
			<header>
				<h1>Screen Share</h1>
				<span className={`pill ${state.status}`}>
					<span className="dot" />
					{STATUS_LABEL[state.status]}
				</span>
			</header>

			<div className="tabs" role="tablist">
				<button role="tab" aria-selected={tab === "share"} className={tab === "share" ? "active" : ""} onClick={() => setTab("share")}>
					Share
				</button>
				<button role="tab" aria-selected={tab === "preview"} className={tab === "preview" ? "active" : ""} onClick={() => setTab("preview")}>
					Preview
				</button>
			</div>

			{tab === "share" && (
				<>
					<div className="segmented" role="group" aria-label="Connection mode">
						<button
							className={state.mode === "lan" ? "active" : ""}
							disabled={sharing || busy}
							onClick={() => chooseMode("lan")}
						>
							Home network
						</button>
						<button
							className={state.mode === "internet" ? "active" : ""}
							disabled={sharing || busy}
							onClick={() => chooseMode("internet")}
						>
							Internet
						</button>
					</div>
					<p className="hint">
						{state.mode === "lan"
							? "Same Wi-Fi. May show a certificate warning on the other device."
							: state.namedTunnel
								? `Named tunnel: ${state.namedTunnel}`
								: "Works anywhere. No certificate warning, but needs internet."}
					</p>

					<label className="audio-row">
						<input
							type="checkbox"
							checked={state.audio}
							disabled={sharing || busy}
							onChange={(event) => api.setAudio({ enabled: event.target.checked })}
						/>
						Share audio
					</label>

					<button className={`primary ${sharing ? "secondary" : ""}`} disabled={busy} onClick={toggle}>
						{busy ? (
							<>
								<span className="spinner" />
								Starting…
							</>
						) : sharing ? (
							"Stop sharing"
						) : (
							"Share my screen"
						)}
					</button>

					{sharing && state.link && (
						<div className="panel">
							<div className="linkrow">
								<input readOnly value={state.link} onFocus={(e) => e.currentTarget.select()} />
								<button className="small" onClick={copy}>
									{copied ? "Copied" : "Copy"}
								</button>
							</div>
							<div className="linkrow">
								<button className="small" onClick={() => setShowQr((value) => !value)}>
									{showQr ? "Hide QR" : "Show QR"}
								</button>
								<button className="small" onClick={() => api.openExternal({ url: state.link! })}>
									Open here
								</button>
							</div>
							{showQr && qr && (
								<div className="qr">
									<img src={qr} alt="Link QR code" />
								</div>
							)}
							<p className="caption">
								Open this link on your TV or phone. A new internet link can take up to a minute before
								other devices resolve it.
							</p>
						</div>
					)}

					{state.error && (
						<div className="errorbox">
							<p>{state.error}</p>
							<details>
								<summary>Details</summary>
								<pre className="logs">{state.logs.join("\n")}</pre>
							</details>
						</div>
					)}

					<details className="advanced">
						<summary>Advanced: named tunnel</summary>
						<p className="caption">
							Point the Cloudflare public hostname at http://127.0.0.1:8137. Leave both fields empty to
							use a quick tunnel.
						</p>
						<input
							type="password"
							placeholder="Tunnel token"
							value={tunnelToken}
							disabled={sharing || busy}
							onChange={(event) => setTunnelToken(event.target.value)}
						/>
						<input
							placeholder="share.example.com"
							value={tunnelHost}
							disabled={sharing || busy}
							onChange={(event) => setTunnelHost(event.target.value)}
						/>
						<div className="settings-row">
							<button className="small" disabled={sharing || busy} onClick={saveTunnel}>
								Save
							</button>
							{state.namedTunnel && (
								<button
									className="small"
									disabled={sharing || busy}
									onClick={() => { setTunnelToken(""); setTunnelHost(""); void api.setTunnel({ token: "", hostname: "" }).then(setState); }}
								>
									Use quick tunnel
								</button>
							)}
						</div>
						{tunnelError && <p className="caption error-text">{tunnelError}</p>}
					</details>
				</>
			)}

			{tab === "preview" && (
				<div className="preview-panel">
					{!sharing && <p className="caption">Start sharing to see a preview here.</p>}
					{sharing && preview && <img src={preview} alt="Live screen preview" />}
					{sharing && !preview && !previewError && <p className="caption">Loading preview…</p>}
					{previewError && <p className="caption error-text">{previewError}</p>}
				</div>
			)}

			<footer>
				<button disabled={busy} onClick={() => api.rotateToken({})}>
					New link
				</button>
				<span>v{state.version}</span>
			</footer>
		</div>
	);
}
