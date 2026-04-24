import {
	type FormEvent,
	useCallback,
	useEffect,
	useId,
	useRef,
	useState,
} from "react";
import {
	loadOperatorConsolePersisted,
	saveOperatorConsolePersisted,
} from "../../lib/operatorConsoleStorage";

type LineKind = "sys" | "out" | "err" | "cmd";

interface TerminalLine {
	id: string;
	kind: LineKind;
	text: string;
}

interface TimerState {
	endAt: number;
	label: string;
	startedAt: number;
	totalMs: number;
}

const MAX_LINES = 120;
const PROMPT = "OP$";
const NOTIFY_LS_KEY = "setrimtam-op-notify";

const WELCOME: Omit<TerminalLine, "id">[] = [
	{
		kind: "sys",
		text: "OPENMVS OPERATOR CONSOLE — LOCAL SESSION (NO HOST I/O)",
	},
	{
		kind: "out",
		text: "Session ready. All processing is in this browser.",
	},
	{ kind: "sys", text: "Type HELP for operator commands." },
];

const ROLL_TIPS = [
	"Stretch shoulders — circulation beats any protocol.",
	"One screen break beats one midnight Sev-1.",
	"Copybook length is not a personality trait.",
	"Hydrate before you escalate.",
	"grep is cheaper than a bridge call.",
	"If it works in batch, don't touch the JCL comments.",
	"Your backlog is not a linked list — pick one head.",
	"Terminal green is calming; production red is not.",
];

function readNotifyPref(): boolean {
	try {
		return globalThis.localStorage?.getItem(NOTIFY_LS_KEY) === "1";
	} catch {
		return false;
	}
}

function writeNotifyPref(on: boolean) {
	try {
		globalThis.localStorage?.setItem(NOTIFY_LS_KEY, on ? "1" : "0");
	} catch {
		/* ignore */
	}
}

function formatClock(d: Date) {
	return d.toLocaleString(undefined, {
		weekday: "short",
		hour: "2-digit",
		minute: "2-digit",
		second: "2-digit",
		day: "2-digit",
		month: "short",
		year: "numeric",
	});
}

function pad2(n: number) {
	return n.toString().padStart(2, "0");
}

function formatDuration(totalSec: number) {
	const s = Math.max(0, Math.floor(totalSec));
	const h = Math.floor(s / 3600);
	const m = Math.floor((s % 3600) / 60);
	const r = s % 60;
	if (h > 0) return `${h}:${pad2(m)}:${pad2(r)}`;
	return `${m}:${pad2(r)}`;
}

function newLineId(): string {
	if (
		typeof crypto !== "undefined" &&
		typeof crypto.randomUUID === "function"
	) {
		return crypto.randomUUID();
	}
	return `tl-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function readInitialFromDisk(): {
	lines: TerminalLine[];
	timer: TimerState | null;
} {
	const { lines: rawLines, timer } = loadOperatorConsolePersisted();
	if (rawLines?.length) {
		return {
			lines: rawLines.map((l) => ({
				kind: l.kind as LineKind,
				text: l.text,
				id: newLineId(),
			})),
			timer:
				timer && timer.endAt > Date.now()
					? {
							endAt: timer.endAt,
							label: timer.label,
							startedAt: timer.startedAt,
							totalMs: timer.totalMs,
						}
					: null,
		};
	}
	return {
		lines: WELCOME.map((l) => ({ ...l, id: newLineId() })),
		timer:
			timer && timer.endAt > Date.now()
				? {
						endAt: timer.endAt,
						label: timer.label,
						startedAt: timer.startedAt,
						totalMs: timer.totalMs,
					}
				: null,
	};
}

function tryBrowserNotify(title: string, body: string) {
	if (typeof Notification === "undefined") return;
	if (Notification.permission !== "granted") return;
	try {
		new Notification(title, {
			body,
			tag: "setrimtam-pomo",
		});
	} catch {
		/* ignore */
	}
}

export default function OperatorConsoleTerminal() {
	const labelId = useId();
	const scrollRef = useRef<HTMLDivElement>(null);
	const inputRef = useRef<HTMLInputElement>(null);
	const timerRef = useRef<TimerState | null>(null);
	const toastClearRef = useRef<ReturnType<typeof setTimeout> | null>(null);
	const initialRef = useRef<ReturnType<typeof readInitialFromDisk> | null>(
		null,
	);
	if (initialRef.current === null) {
		initialRef.current = readInitialFromDisk();
	}
	const boot = initialRef.current;

	const [lines, setLines] = useState<TerminalLine[]>(() => boot.lines);
	const [draft, setDraft] = useState("");
	const [timer, setTimer] = useState<TimerState | null>(() => boot.timer);
	const [, setTick] = useState(0);
	const [toast, setToast] = useState<string | null>(null);
	const [notifyWanted, setNotifyWanted] = useState(readNotifyPref);
	const [desktopFocus, setDesktopFocus] = useState(false);

	useEffect(() => {
		timerRef.current = timer;
	}, [timer]);

	useEffect(() => {
		const mq = globalThis.matchMedia?.("(min-width: 768px)");
		if (!mq) return;
		const apply = () => setDesktopFocus(mq.matches);
		apply();
		mq.addEventListener("change", apply);
		return () => mq.removeEventListener("change", apply);
	}, []);

	useEffect(() => {
		const id = window.setTimeout(() => {
			saveOperatorConsolePersisted({
				lines: lines.map(({ kind, text }) => ({ kind, text })),
				timer,
			});
		}, 400);
		return () => window.clearTimeout(id);
	}, [lines, timer]);

	const appendLines = useCallback((incoming: Omit<TerminalLine, "id">[]) => {
		setLines((prev) => {
			const next = [
				...prev,
				...incoming.map((l) => ({ ...l, id: newLineId() })),
			];
			return next.length > MAX_LINES
				? next.slice(-MAX_LINES)
				: next;
		});
	}, []);

	const showToast = useCallback((message: string) => {
		if (toastClearRef.current) clearTimeout(toastClearRef.current);
		setToast(message);
		toastClearRef.current = setTimeout(() => {
			setToast(null);
			toastClearRef.current = null;
		}, 5200);
	}, []);

	const applyCommand = useCallback(
		(raw: string, opts?: { skipEcho?: boolean }) => {
			const trimmed = raw.trim();
			if (!trimmed) return;

			const parts = trimmed.split(/\s+/);
			const cmd = parts[0].toUpperCase();
			const rest = parts.slice(1);

			if (!opts?.skipEcho) {
				appendLines([{ kind: "cmd", text: `${PROMPT} ${trimmed}` }]);
			}

			const helpText = [
				"HELP          This list",
				"CLEAR         Reset console output",
				"TIME          Local date & time",
				"POMO          Pomodoro usage",
				"POMO 25       Start 25 min focus timer",
				"POMO 5        Start 5 min break timer",
				"POMO 15       Start 15 min break timer",
				"STOP          Cancel active timer",
				"STATUS        Timer remaining",
				"TOOLS         Links to Setrimtam tools",
				"ROLL          Random developer tip",
				"ECHO <text>   Echo text",
				"",
				"Browser alerts: use the bar below the log (not a command).",
			].join("\n");

			switch (cmd) {
				case "HELP":
				case "?":
					appendLines([{ kind: "out", text: helpText }]);
					return;
				case "CLEAR": {
					setLines(WELCOME.map((l) => ({ ...l, id: newLineId() })));
					return;
				}
				case "TIME":
					appendLines([
						{ kind: "out", text: formatClock(new Date()) },
					]);
					return;
				case "STOP":
					if (!timerRef.current) {
						appendLines([
							{ kind: "err", text: "No active timer." },
						]);
						return;
					}
					setTimer(null);
					appendLines([{ kind: "sys", text: "Timer cancelled." }]);
					return;
				case "STATUS": {
					const t = timerRef.current;
					if (!t) {
						appendLines([
							{ kind: "out", text: "No timer running." },
						]);
						return;
					}
					const left = Math.max(0, (t.endAt - Date.now()) / 1000);
					appendLines([
						{
							kind: "out",
							text: `${t.label} — ${formatDuration(left)} left`,
						},
					]);
					return;
				}
				case "NOTIFY": {
					const sub = (rest[0] || "").toUpperCase();
					if (sub === "ON") {
						if (typeof Notification === "undefined") {
							appendLines([
								{
									kind: "err",
									text: "Notifications are not supported in this browser.",
								},
							]);
							return;
						}
						if (Notification.permission === "denied") {
							appendLines([
								{
									kind: "err",
									text: "Notifications are blocked. Enable them in browser site settings.",
								},
							]);
							return;
						}
						if (Notification.permission === "granted") {
							writeNotifyPref(true);
							setNotifyWanted(true);
							appendLines([
								{
									kind: "sys",
									text: "Browser alerts ON — you will get a notification when a timer ends.",
								},
							]);
							return;
						}
						Notification.requestPermission().then((p) => {
							if (p === "granted") {
								writeNotifyPref(true);
								setNotifyWanted(true);
								appendLines([
									{
										kind: "sys",
										text: "Browser alerts ON — granted.",
									},
								]);
							} else {
								writeNotifyPref(false);
								setNotifyWanted(false);
								appendLines([
									{
										kind: "err",
										text: "Permission not granted. Alerts stay OFF.",
									},
								]);
							}
						});
						return;
					}
					if (sub === "OFF") {
						writeNotifyPref(false);
						setNotifyWanted(false);
						appendLines([
							{
								kind: "sys",
								text: "Browser alerts OFF (in-app banner still shows when a timer ends).",
							},
						]);
						return;
					}
					appendLines([
						{
							kind: "out",
							text:
								"NOTIFY ON  — ask the browser to show alerts when a timer completes.\nNOTIFY OFF — stop browser alerts.\nA short in-app banner always appears on completion.",
						},
					]);
					return;
				}
				case "POMO": {
					const n = rest[0] ? Number.parseInt(rest[0], 10) : NaN;
					if (rest.length === 0 || Number.isNaN(n)) {
						appendLines([
							{
								kind: "out",
								text:
									"POMO <minutes> — countdown (e.g. POMO 25). STOP cancels. STATUS shows remaining.",
							},
						]);
						return;
					}
					if (n < 1 || n > 180) {
						appendLines([
							{
								kind: "err",
								text: "Minutes must be between 1 and 180.",
							},
						]);
						return;
					}
					const label =
						n === 25
							? "FOCUS"
							: n === 5 || n === 15
								? "BREAK"
								: `TIMER ${n}M`;
					const totalMs = n * 60_000;
					const now = Date.now();
					setTimer({
						endAt: now + totalMs,
						label,
						startedAt: now,
						totalMs,
					});
					appendLines([
						{
							kind: "sys",
							text: `${label} started — ${n} min. STOP to cancel.`,
						},
					]);
					return;
				}
				case "TOOLS":
					appendLines([
						{
							kind: "out",
							text:
								"Stream builder  → /tools/stream\nFMV / inspect   → /tools/fmv",
						},
					]);
					return;
				case "ROLL": {
					const tip =
						ROLL_TIPS[Math.floor(Math.random() * ROLL_TIPS.length)];
					appendLines([{ kind: "out", text: tip }]);
					return;
				}
				case "ECHO":
					appendLines([
						{
							kind: "out",
							text: rest.join(" ") || "(empty)",
						},
					]);
					return;
				default:
					appendLines([
						{
							kind: "err",
							text: `Unknown command ${cmd}. Type HELP.`,
						},
					]);
			}
		},
		[appendLines],
	);

	const onTimerComplete = useCallback(
		(label: string) => {
			appendLines([
				{
					kind: "sys",
					text: `*** ${label} COMPLETE ***`,
				},
			]);
			showToast(`${label} finished`);
			if (readNotifyPref()) {
				tryBrowserNotify(
					"Setrimtam — operator console",
					`${label} timer finished.`,
				);
			}
		},
		[appendLines, showToast],
	);

	useEffect(() => {
		if (!timer) return;
		const id = window.setInterval(() => {
			setTick((t) => t + 1);
			const t = timerRef.current;
			if (t && Date.now() >= t.endAt) {
				onTimerComplete(t.label);
				setTimer(null);
			}
		}, 1000);
		return () => window.clearInterval(id);
	}, [timer, onTimerComplete]);

	useEffect(() => {
		const el = scrollRef.current;
		if (el) el.scrollTop = el.scrollHeight;
	}, [lines, timer]);

	useEffect(
		() => () => {
			if (toastClearRef.current) clearTimeout(toastClearRef.current);
		},
		[],
	);

	const remainingSec = timer
		? Math.max(0, Math.ceil((timer.endAt - Date.now()) / 1000))
		: 0;

	const progressPct = timer
		? Math.min(
				100,
				Math.max(
					0,
					(100 * (timer.endAt - Date.now())) / timer.totalMs,
				),
			)
		: 0;

	const onSubmit = (e: FormEvent) => {
		e.preventDefault();
		const v = draft;
		setDraft("");
		applyCommand(v);
		inputRef.current?.focus();
	};

	const notifySupported = typeof Notification !== "undefined";
	const notifyBlocked = notifySupported && Notification.permission === "denied";
	const notifyGranted =
		notifySupported && Notification.permission === "granted";

	const toggleNotify = async () => {
		if (!notifySupported) {
			appendLines([
				{
					kind: "err",
					text: "Notifications are not supported here.",
				},
			]);
			return;
		}
		if (notifyBlocked) {
			appendLines([
				{
					kind: "err",
					text: "Notifications are blocked for this site in the browser.",
				},
			]);
			return;
		}
		if (notifyWanted && notifyGranted) {
			applyCommand("NOTIFY OFF", { skipEcho: true });
			return;
		}
		applyCommand("NOTIFY ON", { skipEcho: true });
	};

	return (
		<div className="zos-console-terminal">
			{toast && (
				<div
					className="zos-terminal-toast"
					role="status"
					aria-live="assertive"
				>
					<span className="zos-terminal-toast-text">{toast}</span>
					<button
						type="button"
						className="zos-terminal-toast-dismiss"
						onClick={() => {
							if (toastClearRef.current)
								clearTimeout(toastClearRef.current);
							setToast(null);
						}}
						aria-label="Dismiss notification"
					>
						×
					</button>
				</div>
			)}

			<div
				ref={scrollRef}
				className="zos-terminal-scroll"
				role="log"
				aria-labelledby={labelId}
			>
				<p id={labelId} className="zos-terminal-sr-only">
					Operator console command history
				</p>
				{lines.map((line) => (
					<div
						key={line.id}
						className={`zos-terminal-line zos-terminal-line--${line.kind}`}
					>
						{line.text}
					</div>
				))}
			</div>

			<div
				className="zos-terminal-alerts-bar"
				role="region"
				aria-label="Browser notifications for timer completion"
			>
				<span className="zos-terminal-alerts-label">Alerts</span>
				<button
					type="button"
					className={`zos-terminal-chip zos-terminal-chip-notify${notifyWanted && notifyGranted ? " zos-terminal-chip-active" : ""}`}
					onClick={() => void toggleNotify()}
					disabled={!notifySupported || notifyBlocked}
					title={
						notifyBlocked
							? "Unblock notifications in browser settings"
							: notifyWanted && notifyGranted
								? "Disable browser notifications"
								: "Enable browser notifications when a timer ends"
					}
				>
					{notifyBlocked
						? "Blocked"
						: notifyWanted && notifyGranted
							? "Browser alerts on"
							: "Browser alerts off"}
				</button>
				<span className="zos-terminal-alerts-hint">
					Pomodoro: type POMO 25, STOP, … — in-app banner always shows
					when a timer ends.
				</span>
			</div>

			{timer && (
				<div className="zos-terminal-status" aria-live="polite">
					<div className="zos-terminal-status-main">
						<span className="zos-terminal-status-label">
							{timer.label}
						</span>
						<span className="zos-terminal-status-time">
							{formatDuration(remainingSec)}
						</span>
					</div>
					<div
						className="zos-terminal-progress"
						aria-hidden="true"
					>
						<div
							className="zos-terminal-progress-fill"
							style={{ width: `${progressPct}%` }}
						/>
					</div>
				</div>
			)}

			<form className="zos-terminal-form" onSubmit={onSubmit}>
				<label htmlFor="zos-op-input" className="zos-terminal-sr-only">
					Operator command
				</label>
				<span className="zos-terminal-prompt" aria-hidden="true">
					{PROMPT}
				</span>
				<input
					id="zos-op-input"
					ref={inputRef}
					className="zos-terminal-input"
					value={draft}
					onChange={(e) => setDraft(e.target.value)}
					autoFocus={desktopFocus}
					autoComplete="off"
					autoCorrect="off"
					spellCheck={false}
					placeholder="HELP"
					enterKeyHint="send"
				/>
			</form>
			<div className="zos-scanline" aria-hidden="true" />
		</div>
	);
}
