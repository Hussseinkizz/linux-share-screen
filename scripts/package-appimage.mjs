#!/usr/bin/env bun
/**
 * Build an AppImage from the stable installer artifact.
 *
 * Steps: extract the generated installer archive, run it with a throwaway
 * HOME, wrap the installed app in an AppDir, then run appimagetool.
 *
 * Output: artifacts/Linux-Screen-Share-x86_64.AppImage
 */
import { execFileSync } from "node:child_process";
import { chmodSync, existsSync, readFileSync, readdirSync } from "node:fs";
import { cp, mkdir, rm, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";

const root = resolve(import.meta.dir, "..");
const artifacts = join(root, "artifacts");
const tools = join(root, ".tools");
const tmp = join(root, ".package-tmp");
const out = join(artifacts, "Linux-Screen-Share-x86_64.AppImage");
const { version } = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));

function run(command, args, options = {}) {
	return execFileSync(command, args, { stdio: "inherit", ...options });
}

const setup = readdirSync(artifacts).find((name) => name.endsWith("-Setup.tar.gz"));
if (!setup) {
	console.error("No *-Setup.tar.gz in artifacts/. Run `bun run package` build steps first.");
	process.exit(1);
}

await rm(tmp, { recursive: true, force: true });
await mkdir(tmp, { recursive: true });
run("tar", ["xzf", join(artifacts, setup), "-C", tmp]);

// The installer writes to $HOME/.local/share; give it a sandbox HOME.
const home = join(tmp, "home");
await mkdir(home, { recursive: true });
run(join(tmp, "installer"), [], { cwd: tmp, env: { ...process.env, HOME: home } });

const installed = join(home, ".local", "share", "dev.linuxscreenshare.app", "stable", "app");
if (!existsSync(join(installed, "Resources", "app", "resources", "relay-engine"))) {
	console.error("Installed app layout was not what this script expects:", installed);
	process.exit(1);
}

const appdir = join(tmp, "AppDir");
await mkdir(join(appdir, "usr", "lib"), { recursive: true });
await cp(installed, join(appdir, "usr", "lib", "screen-share"), { recursive: true });

const appRun = join(appdir, "AppRun");
await writeFile(
	appRun,
	'#!/bin/sh\nHERE="$(dirname "$(readlink -f "$0")")"\nexec "$HERE/usr/lib/screen-share/bin/launcher" "$@"\n',
);
chmodSync(appRun, 0o755);

await cp(join(root, "assets", "icon.png"), join(appdir, "linux-screen-share.png"));
await mkdir(join(appdir, "usr", "share", "metainfo"), { recursive: true });
await cp(join(root, "assets", "dev.linuxscreenshare.app.appdata.xml"),
  join(appdir, "usr", "share", "metainfo", "dev.linuxscreenshare.app.appdata.xml"));
await mkdir(join(appdir, "usr", "share", "applications"), { recursive: true });
await writeFile(join(appdir, "usr", "share", "applications", "dev.linuxscreenshare.app.desktop"), "[Desktop Entry]\nType=Application\nName=Linux Screen Share\nExec=AppRun\nIcon=linux-screen-share\nCategories=Network;RemoteAccess;\nTerminal=false\n");
await writeFile(
	join(appdir, "dev.linuxscreenshare.app.desktop"),
	[
		"[Desktop Entry]",
		"Type=Application",
		"Name=Linux Screen Share",
		"Comment=Share this Linux screen to any TV or browser",
		"Exec=AppRun",
		"Icon=linux-screen-share",
		"Categories=Network;RemoteAccess;",
		"Terminal=false",
		"",
	].join("\n"),
);

const tool = join(tools, "appimagetool-x86_64.AppImage");
if (!existsSync(tool)) {
	await mkdir(tools, { recursive: true });
	console.log("downloading appimagetool…");
	const response = await fetch(
		"https://github.com/AppImage/appimagetool/releases/download/continuous/appimagetool-x86_64.AppImage",
		{ redirect: "follow" },
	);
	if (!response.ok) throw new Error(`appimagetool download failed: HTTP ${response.status}`);
	await writeFile(tool, new Uint8Array(await response.arrayBuffer()));
}
chmodSync(tool, 0o755);

const env = { ...process.env, ARCH: "x86_64", VERSION: version, APPIMAGE_EXTRACT_AND_RUN: "1" };
try {
	run(tool, [appdir, out], { env });
} catch {
	console.log("retrying appimagetool with --no-appstream…");
	run(tool, ["--no-appstream", appdir, out], { env });
}

await rm(tmp, { recursive: true, force: true });
console.log(`AppImage ready: ${out}`);
