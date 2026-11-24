export async function killProcess(proc: Bun.Subprocess<any, any, any>, graceMs = 3000): Promise<void> {
	try {
		proc.kill();
	} catch {
		return;
	}
	const exited = await Promise.race([
		proc.exited.then(() => true),
		new Promise<boolean>((resolve) => setTimeout(() => resolve(false), graceMs)),
	]);
	if (!exited) {
		try {
			proc.kill(9);
		} catch {
			// Already gone.
		}
		await proc.exited.catch(() => undefined);
	}
}
