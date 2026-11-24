import { appendFileSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { stateDir } from "./paths";

const MAX_LINES = 200;
const MAX_FILE_BYTES = 1_000_000;

class Logger {
	private lines: string[] = [];
	private file: string;
	private writes = 0;

	constructor() {
		const dir = stateDir();
		mkdirSync(dir, { recursive: true, mode: 0o700 });
		this.file = join(dir, "app.log");
	}

	add(line: string): void {
		const stamped = `${new Date().toISOString()} ${line}`;
		this.lines.push(stamped);
		if (this.lines.length > MAX_LINES) this.lines.shift();
		try {
			appendFileSync(this.file, stamped + "\n", { mode: 0o600 });
			// Engine/tunnel stderr is chatty; keep the log bounded on disk too.
			if (++this.writes % 200 === 0) this.trim();
		} catch {
			// Logging must never take the app down.
		}
	}

	private trim(): void {
		try {
			if (statSync(this.file).size <= MAX_FILE_BYTES) return;
			const tail = readFileSync(this.file, "utf8").split("\n").slice(-400).join("\n");
			writeFileSync(this.file, tail, { mode: 0o600 });
		} catch {
			// Best effort.
		}
	}

	/** Last lines, newest last. Never contains the session token. */
	tail(count = 20): string[] {
		return this.lines.slice(-count);
	}
}

export const log = new Logger();
