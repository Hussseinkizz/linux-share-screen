import { existsSync, mkdirSync, chmodSync, statSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";

export const APP_ID = "linux-screen-share";

export function stateDir(): string {
	const base = process.env.XDG_STATE_HOME || join(homedir(), ".local", "state");
	return join(base, APP_ID);
}

export function configDir(): string {
	const base = process.env.XDG_CONFIG_HOME || join(homedir(), ".config");
	return join(base, APP_ID);
}

export function ensureDirs(): void {
	mkdirSync(stateDir(), { recursive: true, mode: 0o700 });
	mkdirSync(configDir(), { recursive: true });
}

/** Directory holding the bundled relay-engine, viewer/, and cloudflared. */
export function resourcesDir(): string {
	const candidates = [
		process.env.LSS_RESOURCES_DIR,
		join(import.meta.dir, "..", "..", "resources"),
		join(import.meta.dir, "app", "resources"), // packaged: Resources/app/resources
		join(import.meta.dir, "..", "resources"),
		join(dirname(process.execPath), "resources"),
		join(dirname(process.execPath), "..", "Resources", "app", "resources"),
		join(dirname(process.execPath), "..", "Resources", "resources"),
		join(dirname(process.execPath), "..", "..", "Resources", "resources"),
	];
	for (const candidate of candidates) {
		if (candidate && existsSync(join(candidate, "relay-engine"))) return candidate;
	}
	throw new Error("Bundled resources are missing: relay-engine not found");
}

export function viewerDir(): string {
	return join(resourcesDir(), "viewer");
}

/** Ensure a bundled binary is executable; packaging may drop the mode bits. */
export function ensureExecutable(path: string): string {
	if (!existsSync(path)) throw new Error(`Missing bundled binary: ${path}`);
	const mode = statSync(path).mode & 0o777;
	if ((mode & 0o111) !== 0o111) chmodSync(path, mode | 0o755);
	return path;
}

export function engineBinary(): string {
	return ensureExecutable(join(resourcesDir(), "relay-engine"));
}

export function cloudflaredBinary(): string {
	return ensureExecutable(join(resourcesDir(), "cloudflared"));
}
