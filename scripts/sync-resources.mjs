#!/usr/bin/env bun
/**
 * Sync runtime resources into ./resources:
 *  - build the viewer from the patched screen-relay checkout (../screen-relay)
 *  - copy the patched relay-engine binary
 *
 * Set LSS_SCREEN_RELAY to point at a different screen-relay checkout.
 */
import { chmod, copyFile, mkdir, rm, stat } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join, resolve } from "node:path";
import { build } from "esbuild";

const appRoot = resolve(import.meta.dir, "..");
const relayRoot = resolve(process.env.LSS_SCREEN_RELAY ?? join(appRoot, "..", "screen-relay"));
const resources = join(appRoot, "resources");
const viewerOut = join(resources, "viewer");
const engineSource = join(relayRoot, "relay-engine");

if (!existsSync(engineSource)) {
	console.error(`relay-engine not found at ${engineSource}`);
	console.error("Build it first: make -C ../screen-relay BACKENDS='x11 wayland' relay-engine");
	process.exit(1);
}

await mkdir(viewerOut, { recursive: true });
await rm(join(viewerOut, "viewer.js"), { force: true });

await build({
	entryPoints: [join(relayRoot, "viewer", "main.ts")],
	outfile: join(viewerOut, "viewer.js"),
	bundle: true,
	platform: "browser",
	format: "iife",
	target: "es2020",
});
await copyFile(join(relayRoot, "viewer", "index.html"), join(viewerOut, "index.html"));

await copyFile(engineSource, join(resources, "relay-engine"));
await chmod(join(resources, "relay-engine"), 0o755);

const { size } = await stat(join(resources, "relay-engine"));
for (const name of ["parec", "pactl"]) {
	const found = Bun.which(name);
	if (!found) {
		console.warn(`warning: ${name} not found; audio capture will be disabled`);
		continue;
	}
	await copyFile(found, join(resources, name));
	await chmod(join(resources, name), 0o755);
}

console.log(`resources ready: relay-engine ${(size / 1024).toFixed(0)} KiB, viewer built from ${relayRoot}`);
