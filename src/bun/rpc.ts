import { defineElectrobunRPC, Utils } from "electrobun/bun";
import type { AppRPC } from "@/shared/rpc";
import type { SessionManager } from "./session";
import { log } from "./log";

export function createRpc(manager: SessionManager) {
	let loggedConnect = false;
	const rpc = defineElectrobunRPC<AppRPC, "bun">("bun", {
		// Tunnel startup can take ~20s; do not reject the caller at the default 1s.
		maxRequestTime: 120000,
		handlers: {
			requests: {
				getState: () => {
					if (!loggedConnect) {
						loggedConnect = true;
						log.add("UI connected");
					}
					return manager.state();
				},
				start: ({ mode }) => manager.start(mode),
				stop: () => manager.stop(),
				rotateToken: () => manager.rotateToken(),
				setAudio: ({ enabled }) => manager.setAudio(enabled),
				setTunnel: ({ token, hostname }) => manager.setTunnel(token, hostname),
				getPreview: () => manager.preview(),
				openExternal: ({ url }) => {
					try {
						Bun.spawn(["xdg-open", url], { stdout: "ignore", stderr: "ignore" });
						return true;
					} catch (error) {
						log.add(`open failed: ${String(error)}`);
						return false;
					}
				},
				copyText: ({ text }) => {
					try {
						Utils.clipboardWriteText(text);
						return true;
					} catch (error) {
						log.add(`clipboard failed: ${String(error)}`);
						return false;
					}
				},
			},
			// Electrobun types the handler bag per side; runtime messages are
			// empty on the bun side.
			messages: {} as never,
		},
	});

	manager.onChange = (state) => {
		rpc.send.stateChanged(state);
	};

	return rpc;
}
