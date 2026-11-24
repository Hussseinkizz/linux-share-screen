import { chmodSync, existsSync, readFileSync, writeFileSync } from "node:fs";
import { randomBytes } from "node:crypto";
import { join } from "node:path";
import { stateDir } from "./paths";

const tokenPath = () => join(stateDir(), "token");

function valid(token: string): boolean {
	return /^[0-9a-f]{64}$/.test(token);
}

export function tokenFile(): string {
	return tokenPath();
}

/** Stable 64-hex token shared by every link until the user rotates it. */
export function ensureToken(): string {
	const path = tokenPath();
	if (existsSync(path)) {
		const existing = readFileSync(path, "utf8").trim();
		if (valid(existing)) {
			chmodSync(path, 0o600);
			return existing;
		}
	}
	return rotateToken();
}

export function rotateToken(): string {
	const path = tokenPath();
	const token = randomBytes(32).toString("hex");
	writeFileSync(path, token + "\n", { mode: 0o600 });
	chmodSync(path, 0o600);
	return token;
}
