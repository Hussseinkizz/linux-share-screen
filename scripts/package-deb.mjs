#!/usr/bin/env bun
/**
 * Build a Debian package from the stable installer artifact.
 *
 * The package installs under /usr/lib/screen-share, adds /usr/bin/screen-share,
 * a desktop entry, an icon, and declares runtime dependencies so a store or
 * `apt install ./screen-share.deb` pulls them in without user commands.
 *
 * Output: artifacts/screen-share_<version>_amd64.deb
 */
import { execFileSync } from "node:child_process";
import { chmodSync, existsSync, readdirSync, readFileSync } from "node:fs";
import { cp, mkdir, rm, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";

const root = resolve(import.meta.dir, "..");
const artifacts = join(root, "artifacts");
const tmp = join(root, ".package-tmp-deb");
const { version } = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
const out = join(artifacts, `screen-share_${version}_amd64.deb`);

function run(command, args, options = {}) {
	return execFileSync(command, args, { stdio: "inherit", ...options });
}

const setup = readdirSync(artifacts).find((name) => name.endsWith("-Setup.tar.gz"));
if (!setup) {
	console.error("No *-Setup.tar.gz in artifacts. Build the app first.");
	process.exit(1);
}

await rm(tmp, { recursive: true, force: true });
await mkdir(tmp, { recursive: true });
run("tar", ["xzf", join(artifacts, setup), "-C", tmp]);

const home = join(tmp, "home");
await mkdir(home, { recursive: true });
run(join(tmp, "installer"), [], { cwd: tmp, env: { ...process.env, HOME: home } });

const installed = join(home, ".local", "share", "dev.linuxscreenshare.app", "stable", "app");
const resources = join(installed, "Resources", "app", "resources");
if (!existsSync(join(resources, "relay-engine"))) {
	console.error("Installed app layout was not what this script expects:", installed);
	process.exit(1);
}

const pkg = join(tmp, "pkg");
const libDir = join(pkg, "usr", "lib", "screen-share");
const binDir = join(pkg, "usr", "bin");
const applications = join(pkg, "usr", "share", "applications");
const iconDir = join(pkg, "usr", "share", "icons", "hicolor", "256x256", "apps");
const metainfo = join(pkg, "usr", "share", "metainfo");
const docDir = join(pkg, "usr", "share", "doc", "screen-share");
const debian = join(pkg, "DEBIAN");

for (const dir of [libDir, binDir, applications, iconDir, metainfo, docDir, debian]) {
	await mkdir(dir, { recursive: true });
}

await cp(installed, libDir, { recursive: true });
await cp(join(root, "assets", "icon.png"), join(iconDir, "screen-share.png"));
await cp(join(root, "assets", "linux-screen-share.appdata.xml"), join(metainfo, "linux-screen-share.appdata.xml"));
await cp(join(root, "LICENSE"), join(docDir, "copyright"));

const wrapper = join(binDir, "screen-share");
await writeFile(wrapper, '#!/bin/sh\nexec /usr/lib/screen-share/bin/launcher "$@"\n');
chmodSync(wrapper, 0o755);

await writeFile(
	join(applications, "screen-share.desktop"),
	[
		"[Desktop Entry]",
		"Type=Application",
		"Name=Linux Screen Share",
		"Comment=Share this Linux screen to any TV or browser",
		"Exec=screen-share",
		"Icon=screen-share",
		"Categories=Network;RemoteAccess;",
		"Terminal=false",
		"",
	].join("\n"),
);

await writeFile(
	join(debian, "control"),
	[
		"Package: screen-share",
		`Version: ${version}`,
		"Section: net",
		"Priority: optional",
		"Architecture: amd64",
		"Maintainer: Hussseinkizz <hssnkizz@gmail.com>",
		"Depends: libwebkit2gtk-4.1-0, libgtk-3-0 | libgtk-3-0t64, libpulse0, openssl, xdg-utils",
		"Description: share this Linux screen to any TV or browser",
		" One window, one button. Shares the desktop over the local network",
		" or a Cloudflare tunnel, with optional desktop audio and a mute",
		" control in the viewer.",
		"",
	].join("\n"),
);

await writeFile(
	join(debian, "postinst"),
	[
		"#!/bin/sh",
		"set -e",
		"if command -v gtk-update-icon-cache >/dev/null 2>&1; then gtk-update-icon-cache -q /usr/share/icons/hicolor || true; fi",
		"if command -v update-desktop-database >/dev/null 2>&1; then update-desktop-database -q /usr/share/applications || true; fi",
		"exit 0",
		"",
	].join("\n"),
);
chmodSync(join(debian, "postinst"), 0o755);

run("dpkg-deb", ["--root-owner-group", "--build", pkg, out]);
await rm(tmp, { recursive: true, force: true });
console.log(`Debian package ready: ${out}`);
