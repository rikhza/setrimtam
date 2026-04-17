import { Link } from "react-router-dom";
import MainframeZosHero from "../components/mainframe/MainframeZosHero";

export default function HomePage() {
	return (
		<main className="home-page">
			<section className="home-hero-section">
				<div className="home-intro">
					<h2 className="home-title">Setrimtam</h2>
					<p className="home-lead">
						Client-side helpers MF dev, runs in your browser only.
					</p>
					<div className="home-actions">
						<Link
							to="/tools/stream"
							className="btn btn-primary home-cta"
						>
							Stream builder
						</Link>
						<Link
							to="/tools/fmv"
							className="btn btn-ghost home-cta-secondary"
						>
							FMV
						</Link>
						<Link
							to="/tools/julian"
							className="btn btn-ghost home-cta-secondary"
						>
							Julian date
						</Link>
					</div>
				</div>
				<MainframeZosHero />
			</section>
		</main>
	);
}
