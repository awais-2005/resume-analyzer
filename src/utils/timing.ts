function formatMs(ms: number): string {
	if (ms >= 1000) {
		return `${(ms / 1000).toFixed(2)}s`;
	}
	return `${ms.toFixed(0)}ms`;
}

export class RouteTimer {
	private readonly start: number;
	private readonly steps: { name: string; ms: number }[] = [];

	constructor(private readonly route: string) {
		this.start = performance.now();
		console.log(`[TIMING] ${route} — started`);
	}

	async step<T>(name: string, fn: () => Promise<T>): Promise<T> {
		const stepStart = performance.now();
		try {
			return await fn();
		} finally {
			const ms = performance.now() - stepStart;
			this.steps.push({ name, ms });
			console.log(`[TIMING] ${this.route} › ${name}: ${formatMs(ms)}`);
		}
	}

	stepSync<T>(name: string, fn: () => T): T {
		const stepStart = performance.now();
		try {
			return fn();
		} finally {
			const ms = performance.now() - stepStart;
			this.steps.push({ name, ms });
			console.log(`[TIMING] ${this.route} › ${name}: ${formatMs(ms)}`);
		}
	}

	done(): void {
		const total = performance.now() - this.start;
		const breakdown = this.steps.map((s) => `${s.name}=${formatMs(s.ms)}`).join(", ");
		console.log(`[TIMING] ${this.route} — done in ${formatMs(total)}${breakdown ? ` (${breakdown})` : ""}`);
	}
}

export async function measureAsync<T>(label: string, fn: () => Promise<T>): Promise<T> {
	const start = performance.now();
	try {
		return await fn();
	} finally {
		console.log(`[TIMING] ${label}: ${formatMs(performance.now() - start)}`);
	}
}
