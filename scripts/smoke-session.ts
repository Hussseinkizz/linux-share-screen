#!/usr/bin/env bun
/**
 * Headless smoke test for the engine lifecycle (no GUI):
 *   bun scripts/smoke-session.ts [lan|internet]
 * Starts the session, verifies the viewer is served over the advertised URL,
 * then stops. Requires resources/ from `bun run resources` and a graphical
 * session (WAYLAND_DISPLAY or DISPLAY) for capture.
 */
import { SessionManager } from "../src/bun/session";

const mode = (process.argv[2] ?? "lan") as "lan" | "internet";
const manager = new SessionManager();

manager.onChange = (state) => {
	if (state.error) console.error(`error: ${state.error}`);
};

const state = await manager.start(mode);
console.log("status:", state.status);
console.log("link:", state.link ?? "(none)");

if (state.status !== "sharing" || !state.link) {
	console.error("session did not start");
	for (const line of state.logs) console.error(" ", line);
	process.exit(1);
}

const base = state.link.split("/#")[0];
process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
if (mode === "internet") {
	// Cloudflare publishes the quick-tunnel name a few seconds after cloudflared
	// prints it. Look it up too early and the local resolver caches NXDOMAIN.
	await Bun.sleep(10000);
}
let ok = false;
for (let attempt = 0; attempt < 30 && !ok; attempt++) {
	try {
		const response = await fetch(`${base}/`, { redirect: "follow" });
		const body = await response.text();
		console.log(`viewer HTTP ${response.status}, ${body.length} bytes${body.includes("viewer") ? ", looks right" : ""}`);
		ok = response.ok;
	} catch (error) {
		if (attempt === 0) console.log("waiting for DNS/route…", String(error));
		await Bun.sleep(1000);
	}
}
if (!ok) console.error("viewer never became reachable from this machine (DNS?)");

await Bun.sleep(500);
await manager.stop();
console.log("stopped cleanly");
process.exit(0);
