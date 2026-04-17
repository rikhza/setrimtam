import { useEffect, useState } from "react";
import { getLparLoadPercentNow } from "../../lib/jakartaLparLoad";
import MainframeWeatherRack from "./MainframeWeatherRack";
import OperatorConsoleTerminal from "./OperatorConsoleTerminal";

const LOAD_TICK_MS = 30_000;

export default function MainframeZosHero() {
	const [loadPercent, setLoadPercent] = useState(() =>
		getLparLoadPercentNow(),
	);

	useEffect(() => {
		const tick = () => setLoadPercent(getLparLoadPercentNow());
		tick();
		const id = window.setInterval(tick, LOAD_TICK_MS);
		return () => window.clearInterval(id);
	}, []);

	return (
		<div className="zos-hero">
			<div className="zos-hero-grid" aria-hidden="true" />

			<div className="zos-hero-main">
				<div className="zos-hardware">
					<div className="zos-rack" aria-hidden="true">
						<div className="zos-rack-top">
							<span className="zos-led zos-led-power" />
							<span className="zos-label">POWER</span>
						</div>
						<div className="zos-rack-body">
							{Array.from({ length: 8 }).map((_, i) => {
								const activity =
									0.28 +
									(loadPercent / 100) *
										0.72 *
										(0.65 + (0.35 * (i + 1)) / 8);
								const durationSec = Math.max(
									0.55,
									1.45 - (loadPercent / 100) * 0.75,
								);
								return (
									<span
										key={i}
										className="zos-led zos-led-row"
										style={{
											opacity: activity,
											animationDuration: `${durationSec}s`,
											animationDelay: `${i * 0.12}s`,
										}}
									/>
								);
							})}
						</div>
						<div className="zos-rack-drives">
							{Array.from({ length: 4 }).map((_, i) => {
								const active = loadPercent > i * 25;
								const pulseSec = Math.max(
									0.85,
									1.35 - (loadPercent / 100) * 0.55,
								);
								return (
									<span
										key={i}
										className={`zos-drive-slot${active ? " zos-drive-slot--lpar" : ""}`}
										style={{
											animationDuration: `${pulseSec}s`,
											animationDelay: `${i * 0.22}s`,
										}}
									/>
								);
							})}
						</div>
					</div>

					<div
						className="zos-hardware-load"
						aria-live="polite"
						aria-label={`Load system ${loadPercent} percent`}
					>
						<span className="zos-load-pct">{loadPercent}%</span>
						<span className="zos-load-label">LOAD SYSTEM</span>
					</div>

					<MainframeWeatherRack />
				</div>

				<div className="zos-console-wrap">
					<div className="zos-console-bar">
						<span className="zos-console-dots" aria-hidden="true">
							<span />
							<span />
							<span />
						</span>
						<span className="zos-console-title">
							Host system — operator console
						</span>
						<span className="zos-console-badge">LPAR</span>
					</div>
					<div className="zos-console-screen">
						<OperatorConsoleTerminal />
					</div>
				</div>
			</div>

			<div className="zos-hero-footer">
				<div className="zos-brand-mark">
					<span className="zos-z">z</span>
					<span className="zos-slash">/</span>
					<span className="zos-os">OS</span>
				</div>
				<p className="zos-tagline">Local tooling</p>
			</div>
		</div>
	);
}
