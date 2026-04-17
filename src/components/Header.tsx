import { Link, NavLink, useLocation } from "react-router-dom";

interface HeaderProps {
	onClearAll: () => void;
}

export default function Header({ onClearAll }: HeaderProps) {
	const { pathname } = useLocation();
	const onTools = pathname.startsWith("/tools");

	let subtitle = "For Mainframe";
	if (pathname.startsWith("/tools/stream")) {
		subtitle = "COBOL copybook → VTAM stream";
	} else if (
		pathname.startsWith("/tools/fmv") ||
		pathname.startsWith("/tools/inspect")
	) {
		subtitle = "FMV";
	} else if (pathname.startsWith("/tools/julian")) {
		subtitle = "YYDDD · YYYYDDD";
	}

	return (
		<header className="app-header">
			<div className="header-content">
				<Link
					to="/"
					className="logo-group logo-link"
					aria-label="Setrimtam home"
				>
					<div className="logo-mark" aria-hidden="true">
						<svg
							viewBox="0 0 20 20"
							fill="none"
							xmlns="http://www.w3.org/2000/svg"
							width="18"
							height="18"
						>
							<rect
								x="2"
								y="4"
								width="16"
								height="2"
								rx="1"
								fill="currentColor"
								opacity="0.9"
							/>
							<rect
								x="2"
								y="9"
								width="11"
								height="2"
								rx="1"
								fill="currentColor"
								opacity="0.7"
							/>
							<rect
								x="2"
								y="14"
								width="7"
								height="2"
								rx="1"
								fill="currentColor"
								opacity="0.5"
							/>
						</svg>
					</div>
					<div>
						<h1>Setrimtam</h1>
						<p className="subtitle">{subtitle}</p>
					</div>
				</Link>

				<nav className="header-nav" aria-label="Main">
					<NavLink
						to="/"
						end
						className={({ isActive }) =>
							`nav-link${isActive ? " nav-link-active" : ""}`
						}
					>
						Home
					</NavLink>
					<NavLink
						to="/tools/stream"
						className={({ isActive }) =>
							`nav-link${isActive ? " nav-link-active" : ""}`
						}
					>
						Stream builder
					</NavLink>
					<NavLink
						to="/tools/fmv"
						className={({ isActive }) =>
							`nav-link${isActive ? " nav-link-active" : ""}`
						}
					>
						FMV
					</NavLink>
					<NavLink
						to="/tools/julian"
						className={({ isActive }) =>
							`nav-link${isActive ? " nav-link-active" : ""}`
						}
					>
						Julian
					</NavLink>
				</nav>

				<div className="header-actions">
					{onTools && (
						<button
							type="button"
							className="btn btn-ghost-danger"
							title="Clear everything"
							onClick={onClearAll}
						>
							<svg
								viewBox="0 0 24 24"
								fill="none"
								stroke="currentColor"
								strokeWidth="2"
								width="16"
								height="16"
								aria-hidden="true"
							>
								<polyline points="3 6 5 6 21 6" />
								<path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
							</svg>
							<span>Clear</span>
						</button>
					)}
				</div>
			</div>
		</header>
	);
}
