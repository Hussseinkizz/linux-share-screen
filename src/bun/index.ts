import { BrowserWindow, Updater, app } from "electrobun/bun";
import { ensureDirs } from "./paths";
import { createRpc } from "./rpc";
import { log } from "./log";
import { SessionManager } from "./session";

const DEV_SERVER_URL = "http://localhost:5173";

async function mainViewUrl(): Promise<string> {
	const channel = await Updater.localInfo.channel();
	if (channel === "dev") {
		try {
			await fetch(DEV_SERVER_URL, { method: "HEAD" });
			return DEV_SERVER_URL;
		} catch {
			// Fall through to the bundled view.
		}
	}
	return "views://mainview/index.html";
}

ensureDirs();
log.add("app starting");

const manager = new SessionManager();
const rpc = createRpc(manager);

let shuttingDown = false;
async function shutdown(): Promise<void> {
	if (shuttingDown) return;
	shuttingDown = true;
	try {
		await manager.stop();
	} finally {
		log.add("app stopped");
	}
}

app.on("before-quit", () => {
	void shutdown();
});
process.on("exit", () => {
	// Never leave the engine or tunnel behind, even on a fast quit.
	manager.forceKill();
});
for (const signal of ["SIGINT", "SIGTERM", "SIGHUP"] as const) {
	process.on(signal, () => {
		void shutdown().finally(() => process.exit(0));
	});
}

new BrowserWindow({
	title: "Screen Share",
	url: await mainViewUrl(),
	frame: { width: 560, height: 520, x: 240, y: 160 },
	// The window must own our RPC instance, otherwise the webview talks to a
	// default handler-less bridge and every request goes nowhere.
	rpc,
});
