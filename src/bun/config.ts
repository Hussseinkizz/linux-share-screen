import { chmodSync, existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { configDir } from "./paths";
import type { Mode } from "@/shared/rpc";

interface PersistedConfig {
	mode?: Mode;
	port?: number;
	audio?: boolean;
	namedTunnel?: { token: string; hostname: string };
}

const file = () => join(configDir(), "config.json");

export function readConfig(): PersistedConfig {
	try {
		return JSON.parse(readFileSync(file(), "utf8")) as PersistedConfig;
	} catch {
		return {};
	}
}

export function writeConfig(next: PersistedConfig): void {
	try {
		writeFileSync(file(), JSON.stringify(next, null, 2), { mode: 0o600 });
	} catch {
		// Best effort only.
	}
}
