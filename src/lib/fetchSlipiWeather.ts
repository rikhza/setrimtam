/** Slipi Jaya, Jakarta Barat (approx.) — Open-Meteo, no API key. */
export const SLIPI_JAKARTA = {
	lat: -6.1857,
	lon: 106.8044,
	label: "Slipi Jaya, Jakarta Barat",
} as const;

export interface SlipiWeatherSnapshot {
	/** Precipitation probability (%) for the hourly slot closest to now, Jakarta tz. */
	precipProbNow: number | null;
	currentTempC: number | null;
	fetchedAt: number;
}

function pickClosestHourlyPrecipProb(
	times: string[],
	probs: (number | null)[],
): number | null {
	if (!times.length || times.length !== probs.length) return null;
	const now = Date.now();
	let bestIdx = -1;
	let bestAbs = Infinity;
	for (let i = 0; i < times.length; i++) {
		const t = new Date(times[i]).getTime();
		if (Number.isNaN(t)) continue;
		const diff = Math.abs(t - now);
		if (diff < bestAbs) {
			bestAbs = diff;
			bestIdx = i;
		}
	}
	if (bestIdx < 0) return null;
	const v = probs[bestIdx];
	return typeof v === "number" && !Number.isNaN(v) ? v : null;
}

export async function fetchSlipiWeather(
	signal?: AbortSignal,
): Promise<SlipiWeatherSnapshot> {
	const u = new URL("https://api.open-meteo.com/v1/forecast");
	u.searchParams.set("latitude", String(SLIPI_JAKARTA.lat));
	u.searchParams.set("longitude", String(SLIPI_JAKARTA.lon));
	u.searchParams.set("timezone", "Asia/Jakarta");
	u.searchParams.set("hourly", "precipitation_probability");
	u.searchParams.set("current_weather", "true");
	u.searchParams.set("forecast_days", "1");

	const res = await fetch(u.toString(), { signal });
	if (!res.ok) {
		throw new Error(`Open-Meteo ${res.status}`);
	}
	const j = (await res.json()) as {
		hourly?: {
			time?: string[];
			precipitation_probability?: (number | null)[];
		};
		current_weather?: {
			temperature?: number;
		};
	};

	const times = j.hourly?.time ?? [];
	const probs = j.hourly?.precipitation_probability ?? [];
	const precipProbNow = pickClosestHourlyPrecipProb(times, probs);
	const currentTempC = j.current_weather?.temperature;

	return {
		precipProbNow,
		currentTempC:
			typeof currentTempC === "number" ? currentTempC : null,
		fetchedAt: Date.now(),
	};
}
