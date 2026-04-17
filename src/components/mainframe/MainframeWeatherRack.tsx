import { useCallback, useEffect, useRef, useState } from "react";
import {
	SLIPI_JAKARTA,
	fetchSlipiWeather,
	type SlipiWeatherSnapshot,
} from "../../lib/fetchSlipiWeather";

const SEGMENTS = 8;
const REFRESH_MS = 15 * 60_000;

function formatRdrk(ts: number) {
	return new Intl.DateTimeFormat("en-GB", {
		timeZone: "Asia/Jakarta",
		hour: "2-digit",
		minute: "2-digit",
		second: "2-digit",
		hour12: false,
	}).format(new Date(ts));
}

function isAbort(e: unknown) {
	return e instanceof DOMException && e.name === "AbortError";
}

export default function MainframeWeatherRack() {
	const [wx, setWx] = useState<SlipiWeatherSnapshot | null>(null);
	const [err, setErr] = useState<string | null>(null);
	const [loading, setLoading] = useState(false);
	const abortRef = useRef<AbortController | null>(null);

	const pull = useCallback(async () => {
		abortRef.current?.abort();
		const ac = new AbortController();
		abortRef.current = ac;
		setLoading(true);
		setErr(null);
		try {
			const data = await fetchSlipiWeather(ac.signal);
			if (abortRef.current !== ac) return;
			setWx(data);
		} catch (e) {
			if (isAbort(e) || abortRef.current !== ac) return;
			setErr(e instanceof Error ? e.message : "ERR");
		} finally {
			if (abortRef.current === ac) {
				setLoading(false);
			}
		}
	}, []);

	useEffect(() => {
		void pull();
		const id = window.setInterval(() => void pull(), REFRESH_MS);
		return () => {
			window.clearInterval(id);
			abortRef.current?.abort();
			abortRef.current = null;
		};
	}, [pull]);

	const popNow = wx?.precipProbNow;
	const driveActive = (i: number) =>
		popNow != null && !Number.isNaN(popNow) && popNow > i * 25;
	const litCount =
		popNow != null && !Number.isNaN(popNow)
			? Math.min(
					SEGMENTS,
					Math.max(0, Math.round((popNow / 100) * SEGMENTS)),
				)
			: 0;

	const strip =
		wx == null
			? loading
				? "POLL OPEN-METEO…"
				: "NO LINE · REFRESH"
			: [
					wx.currentTempC != null
						? `${wx.currentTempC.toFixed(0)}°C`
						: "—",
					popNow != null
						? `${popNow}% rain (now)`
						: "rain % —",
				].join(" · ");

	return (
		<div className="zos-weather-rack">
			<div className="zos-weather-rack-top">
				<span className="zos-led zos-led-power zos-led-wx-pulse" />
				<span className="zos-label">LOCATION</span>
				<button
					type="button"
					className="zos-weather-refresh"
					onClick={() => void pull()}
					disabled={loading}
					aria-label="Refresh weather"
					title="Re-poll Open-Meteo"
				>
					{loading ? "·" : "↻"}
				</button>
			</div>
			<div className="zos-weather-led-grid" aria-hidden="true">
				{Array.from({ length: SEGMENTS }).map((_, i) => {
					const on = wx != null && !err && i < litCount;
					const busy = loading && wx == null;
					const activity = on
						? 0.35 +
							(litCount / SEGMENTS) *
								0.65 *
								(0.55 + (0.45 * (i + 1)) / SEGMENTS)
						: busy
							? 0.24 + (i % 4) * 0.09
							: 0.12;
					const durationSec = on
						? Math.max(0.55, 1.35 - (litCount / SEGMENTS) * 0.65)
						: busy
							? 1.05 + (i % 3) * 0.18
							: 1.55;
					return (
						<span
							key={i}
							className={`zos-led zos-led-row zos-led-wx${on ? " zos-led-wx-on" : ""}`}
							style={{
								opacity: activity,
								animationDuration: `${durationSec}s`,
								animationDelay: `${i * 0.1}s`,
							}}
						/>
					);
				})}
			</div>
			<div
				className={`zos-weather-drives${loading && wx == null ? " zos-weather-drives--busy" : ""}`}
				aria-hidden="true"
			>
				{Array.from({ length: 4 }).map((_, i) => {
					const active = driveActive(i);
					const pulseSec =
						popNow != null && !Number.isNaN(popNow)
							? Math.max(0.85, 1.35 - (popNow / 100) * 0.55)
							: 1.25;
					return (
						<span
							key={i}
							className={`zos-drive-slot${active ? " zos-drive-slot--wx" : ""}`}
							style={{
								animationDuration: `${pulseSec}s`,
								animationDelay: `${i * 0.22}s`,
							}}
						/>
					);
				})}
			</div>
			<p className="zos-weather-strip" title={strip}>
				{strip}
			</p>
			<p className="zos-weather-caption">
				{SLIPI_JAKARTA.label.toUpperCase()}
			</p>
			{err && (
				<p className="zos-weather-err" role="alert">
					{err}
				</p>
			)}
			{wx && !err && (
				<p className="zos-weather-meta">
					RDR/K {formatRdrk(wx.fetchedAt)}
				</p>
			)}
		</div>
	);
}
