const STORAGE_KEY = "setrimtam-operator-console-v1";
const SCHEMA_VERSION = 1 as const;
const MAX_PERSISTED_LINES = 120;

export type PersistedLineKind = "sys" | "out" | "err" | "cmd";

export interface PersistedLine {
	kind: PersistedLineKind;
	text: string;
}

export interface PersistedTimer {
	endAt: number;
	label: string;
	startedAt: number;
	totalMs: number;
}

interface StoredShape {
	v: typeof SCHEMA_VERSION;
	lines: PersistedLine[];
	timer: PersistedTimer | null;
}

const KINDS = new Set<PersistedLineKind>(["sys", "out", "err", "cmd"]);

/** Avoid redundant localStorage writes (same serialized payload). */
let lastSerializedFingerprint = "";

function isPersistedLine(x: unknown): x is PersistedLine {
	if (!x || typeof x !== "object") return false;
	const o = x as Record<string, unknown>;
	return (
		KINDS.has(o.kind as PersistedLineKind) &&
		typeof o.text === "string" &&
		o.text.length < 50_000
	);
}

function isTimer(x: unknown): x is PersistedTimer {
	if (!x || typeof x !== "object") return false;
	const o = x as Record<string, unknown>;
	return (
		typeof o.endAt === "number" &&
		typeof o.label === "string" &&
		typeof o.startedAt === "number" &&
		typeof o.totalMs === "number"
	);
}

export function loadOperatorConsolePersisted(): {
	lines: PersistedLine[] | null;
	timer: PersistedTimer | null;
} {
	try {
		const raw = globalThis.localStorage?.getItem(STORAGE_KEY);
		if (!raw) return { lines: null, timer: null };
		const j = JSON.parse(raw) as unknown;
		if (!j || typeof j !== "object") return { lines: null, timer: null };
		const o = j as Partial<StoredShape>;
		if (o.v !== SCHEMA_VERSION || !Array.isArray(o.lines)) {
			return { lines: null, timer: null };
		}
		const lines = o.lines
			.filter(isPersistedLine)
			.slice(-MAX_PERSISTED_LINES);
		let timer: PersistedTimer | null = null;
		if (isTimer(o.timer) && o.timer.endAt > Date.now()) {
			timer = o.timer;
		}
		lastSerializedFingerprint = raw;
		return { lines: lines.length ? lines : null, timer };
	} catch {
		return { lines: null, timer: null };
	}
}

export function saveOperatorConsolePersisted(payload: {
	lines: PersistedLine[];
	timer: PersistedTimer | null;
}): void {
	try {
		const lines = payload.lines
			.filter(isPersistedLine)
			.slice(-MAX_PERSISTED_LINES);
		let timer: PersistedTimer | null = null;
		if (
			payload.timer &&
			isTimer(payload.timer) &&
			payload.timer.endAt > Date.now()
		) {
			timer = payload.timer;
		}
		const body: StoredShape = {
			v: SCHEMA_VERSION,
			lines,
			timer,
		};
		const serialized = JSON.stringify(body);
		if (serialized === lastSerializedFingerprint) return;
		lastSerializedFingerprint = serialized;
		globalThis.localStorage?.setItem(STORAGE_KEY, serialized);
	} catch {
		/* quota / private mode */
	}
}
