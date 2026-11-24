#!/usr/bin/env bun
/**
 * Download the cloudflared binary into ./resources (dev and CI convenience).
 * The packaged app ships this binary; end users never run this.
 *
 * Pin a release for reproducible builds:
 *   CLOUDFLARED_VERSION=2025.11.0 bun scripts/fetch-cloudflared.mjs
 */
import { chmod, mkdir, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join, resolve } from "node:path";

const appRoot = resolve(import.meta.dir, "..");
const resources = join(appRoot, "resources");
const target = join(resources, "cloudflared");
const version = process.env.CLOUDFLARED_VERSION;
const arch = process.arch === "arm64" ? "arm64" : "amd64";
const url = version
	? `https://github.com/cloudflare/cloudflared/releases/download/${version}/cloudflared-linux-${arch}`
	: `https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-${arch}`;

if (existsSync(target) && !process.env.FORCE) {
	console.log(`cloudflared already present: ${target}`);
	process.exit(0);
}

await mkdir(resources, { recursive: true });
console.log(`downloading ${url}`);
const response = await fetch(url, { redirect: "follow" });
if (!response.ok) {
	console.error(`download failed: HTTP ${response.status}`);
	process.exit(1);
}
const bytes = new Uint8Array(await response.arrayBuffer());
await writeFile(target, bytes);
await chmod(target, 0o755);
console.log(`cloudflared ready: ${(bytes.byteLength / 1024 / 1024).toFixed(1)} MiB`);
