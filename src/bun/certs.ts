import { chmodSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { stateDir } from "./paths";
import { log } from "./log";

export interface CertPaths {
	cert: string;
	key: string;
}

function certDir(): string {
	const dir = join(stateDir(), "certs");
	mkdirSync(dir, { recursive: true, mode: 0o700 });
	return dir;
}

function metaFile(): string {
	return join(certDir(), "meta.json");
}

function currentIp(): string | null {
	try {
		return (JSON.parse(readFileSync(metaFile(), "utf8")) as { ip?: string }).ip ?? null;
	} catch {
		return null;
	}
}

/**
 * Self-signed certificate for the LAN address. Regenerated when the address
 * changes. Uses openssl (present on every mainstream Linux desktop) so the app
 * carries no certificate-generation dependency.
 */
export function ensureCert(ip: string): CertPaths {
	const cert = join(certDir(), "cert.pem");
	const key = join(certDir(), "key.pem");
	if (existsSync(cert) && existsSync(key) && currentIp() === ip) {
		chmodSync(key, 0o600);
		return { cert, key };
	}

	const result = Bun.spawnSync([
		"openssl", "req", "-x509", "-newkey", "rsa:2048",
		"-keyout", key, "-out", cert,
		"-days", "3650", "-nodes",
		"-subj", "/CN=Linux Screen Share",
		"-addext", `subjectAltName=IP:${ip},IP:127.0.0.1,DNS:localhost`,
	], { stdout: "pipe", stderr: "pipe" });

	if (result.exitCode !== 0) {
		const message = new TextDecoder().decode(result.stderr).trim();
		log.add(`cert generation failed: ${message}`);
		throw new Error("Could not create the TLS certificate (openssl missing?)");
	}

	chmodSync(key, 0o600);
	writeFileSync(metaFile(), JSON.stringify({ ip }));
	log.add(`generated TLS certificate for ${ip}`);
	return { cert, key };
}
