import { createServer } from "node:net";
import { networkInterfaces } from "node:os";

export interface LanAddress {
	name: string;
	address: string;
}

function isPrivate(address: string): boolean {
	return (
		address.startsWith("192.168.") ||
		address.startsWith("10.") ||
		/^172\.(1[6-9]|2\d|3[01])\./.test(address)
	);
}

const VIRTUAL = /^(docker|veth|br-|virbr|podman|cni|flannel|tailscale|zt|tun|tap|wg)/i;

function score({ name, address }: LanAddress): number {
	if (!isPrivate(address) || VIRTUAL.test(name)) return -1;
	let value = 0;
	if (address.startsWith("192.168.")) value += 40;
	else if (address.startsWith("10.")) value += 30;
	else value += 20;
	// Prefer real network hardware over bridges and software interfaces.
	if (/^(wl|en|eth|wlan)/i.test(name)) value += 15;
	return value;
}

export function lanAddresses(): LanAddress[] {
	const result: LanAddress[] = [];
	for (const [name, entries] of Object.entries(networkInterfaces())) {
		for (const entry of entries ?? []) {
			if (entry.family !== "IPv4" || entry.internal) continue;
			result.push({ name, address: entry.address });
		}
	}
	return result
		.map((entry) => ({ entry, score: score(entry) }))
		.filter(({ score }) => score >= 0)
		.sort((a, b) => b.score - a.score)
		.map(({ entry }) => entry);
}

export function pickLanIp(): string | null {
	return lanAddresses()[0]?.address ?? null;
}

function portFree(port: number, host: string): Promise<boolean> {
	return new Promise((resolve) => {
		const server = createServer();
		server.once("error", () => resolve(false));
		server.listen(port, host, () => server.close(() => resolve(true)));
	});
}

export async function findFreePort(start = 8137, end = 8147): Promise<number> {
	for (let port = start; port <= end; port++) {
		if (await portFree(port, "0.0.0.0")) return port;
	}
	throw new Error(`No free port between ${start} and ${end}`);
}
