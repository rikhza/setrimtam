/**
 * Synthetic LPAR “capacity” curve for demo UI: low around 08:00 Jakarta,
 * ramps through the day, ~100% from late evening into night.
 * Uses Asia/Jakarta wall clock (no network).
 */
export function getDecimalHourJakarta(d: Date): number {
	const parts = new Intl.DateTimeFormat("en-GB", {
		timeZone: "Asia/Jakarta",
		hour: "2-digit",
		minute: "2-digit",
		hour12: false,
	}).formatToParts(d);
	const h = Number.parseInt(
		parts.find((p) => p.type === "hour")?.value ?? "0",
		10,
	);
	const m = Number.parseInt(
		parts.find((p) => p.type === "minute")?.value ?? "0",
		10,
	);
	return h + m / 60;
}

/** Returns integer 0–100 for UI meters. */
export function getLparLoadPercentNow(d = new Date()): number {
	const t = getDecimalHourJakarta(d);
	// Before 08:00 — low overnight window, easing up toward morning baseline
	if (t < 8) {
		return Math.round(12 + (t / 8) * 3);
	}
	// 08:00 → 22:00 — business day ramp toward full capacity
	if (t <= 22) {
		const u = (t - 8) / 14;
		return Math.round(15 + u * 85);
	}
	// After 22:00 — peak / night processing
	return 100;
}
