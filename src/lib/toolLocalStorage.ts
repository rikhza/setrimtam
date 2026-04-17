const STREAM_KEY = 'setrimtam:v1:stream-builder';
const FMV_KEY = 'setrimtam:v1:fmv';
const STREAM_SAVES_KEY = 'setrimtam:v1:stream-builder-saves';
const FMV_SAVES_KEY = 'setrimtam:v1:fmv-saves';

const MAX_NAMED_SAVES = 40;

export type StreamBuilderSnapshot = {
  copybookText: string;
  fieldValues: Record<string, string>;
};

export type FmvSnapshot = {
  copybookText: string;
  rawText: string;
};

export type NamedSaveBase = {
  id: string;
  name: string;
  savedAt: number;
};

export type StreamNamedSave = NamedSaveBase & { payload: StreamBuilderSnapshot };
export type FmvNamedSave = NamedSaveBase & { payload: FmvSnapshot };

const emptyStream: StreamBuilderSnapshot = { copybookText: '', fieldValues: {} };
const emptyFmv: FmvSnapshot = { copybookText: '', rawText: '' };

function newId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
}

function defaultSaveName(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `Save ${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function loadStreamBuilder(): StreamBuilderSnapshot {
  try {
    const raw = localStorage.getItem(STREAM_KEY);
    if (!raw) return { ...emptyStream };
    const parsed = JSON.parse(raw) as Partial<StreamBuilderSnapshot>;
    return {
      copybookText: typeof parsed.copybookText === 'string' ? parsed.copybookText : '',
      fieldValues:
        parsed.fieldValues && typeof parsed.fieldValues === 'object' && parsed.fieldValues !== null
          ? parsed.fieldValues
          : {},
    };
  } catch {
    return { ...emptyStream };
  }
}

export function saveStreamBuilder(snapshot: StreamBuilderSnapshot): void {
  try {
    localStorage.setItem(STREAM_KEY, JSON.stringify(snapshot));
  } catch {
    /* quota or private mode */
  }
}

export function clearStreamBuilderStorage(): void {
  try {
    localStorage.removeItem(STREAM_KEY);
  } catch {
    /* ignore */
  }
}

export function listStreamSaves(): StreamNamedSave[] {
  try {
    const raw = localStorage.getItem(STREAM_SAVES_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw) as unknown;
    if (!Array.isArray(arr)) return [];
    return arr
      .filter(
        (x): x is StreamNamedSave =>
          x &&
          typeof x === 'object' &&
          typeof (x as StreamNamedSave).id === 'string' &&
          typeof (x as StreamNamedSave).name === 'string' &&
          typeof (x as StreamNamedSave).savedAt === 'number' &&
          (x as StreamNamedSave).payload &&
          typeof (x as StreamNamedSave).payload.copybookText === 'string'
      )
      .map((x) => ({
        ...x,
        payload: {
          copybookText: x.payload.copybookText,
          fieldValues:
            x.payload.fieldValues && typeof x.payload.fieldValues === 'object'
              ? x.payload.fieldValues
              : {},
        },
      }));
  } catch {
    return [];
  }
}

export function addStreamSave(name: string, payload: StreamBuilderSnapshot): StreamNamedSave | null {
  const trimmed = name.trim() || defaultSaveName();
  const entry: StreamNamedSave = {
    id: newId(),
    name: trimmed,
    savedAt: Date.now(),
    payload: {
      copybookText: payload.copybookText,
      fieldValues: { ...payload.fieldValues },
    },
  };
  try {
    const prev = listStreamSaves();
    const next = [entry, ...prev].slice(0, MAX_NAMED_SAVES);
    localStorage.setItem(STREAM_SAVES_KEY, JSON.stringify(next));
    return entry;
  } catch {
    return null;
  }
}

export function removeStreamSave(id: string): void {
  try {
    const next = listStreamSaves().filter((s) => s.id !== id);
    localStorage.setItem(STREAM_SAVES_KEY, JSON.stringify(next));
  } catch {
    /* ignore */
  }
}

export function loadFmv(): FmvSnapshot {
  try {
    const raw = localStorage.getItem(FMV_KEY);
    if (!raw) return { ...emptyFmv };
    const parsed = JSON.parse(raw) as Partial<FmvSnapshot>;
    return {
      copybookText: typeof parsed.copybookText === 'string' ? parsed.copybookText : '',
      rawText: typeof parsed.rawText === 'string' ? parsed.rawText : '',
    };
  } catch {
    return { ...emptyFmv };
  }
}

export function saveFmv(snapshot: FmvSnapshot): void {
  try {
    localStorage.setItem(FMV_KEY, JSON.stringify(snapshot));
  } catch {
    /* ignore */
  }
}

export function clearFmvStorage(): void {
  try {
    localStorage.removeItem(FMV_KEY);
  } catch {
    /* ignore */
  }
}

export function listFmvSaves(): FmvNamedSave[] {
  try {
    const raw = localStorage.getItem(FMV_SAVES_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw) as unknown;
    if (!Array.isArray(arr)) return [];
    return arr.filter(
      (x): x is FmvNamedSave =>
        x &&
        typeof x === 'object' &&
        typeof (x as FmvNamedSave).id === 'string' &&
        typeof (x as FmvNamedSave).name === 'string' &&
        typeof (x as FmvNamedSave).savedAt === 'number' &&
        (x as FmvNamedSave).payload &&
        typeof (x as FmvNamedSave).payload.copybookText === 'string' &&
        typeof (x as FmvNamedSave).payload.rawText === 'string'
    );
  } catch {
    return [];
  }
}

export function addFmvSave(name: string, payload: FmvSnapshot): FmvNamedSave | null {
  const trimmed = name.trim() || defaultSaveName();
  const entry: FmvNamedSave = {
    id: newId(),
    name: trimmed,
    savedAt: Date.now(),
    payload: {
      copybookText: payload.copybookText,
      rawText: payload.rawText,
    },
  };
  try {
    const prev = listFmvSaves();
    const next = [entry, ...prev].slice(0, MAX_NAMED_SAVES);
    localStorage.setItem(FMV_SAVES_KEY, JSON.stringify(next));
    return entry;
  } catch {
    return null;
  }
}

export function removeFmvSave(id: string): void {
  try {
    const next = listFmvSaves().filter((s) => s.id !== id);
    localStorage.setItem(FMV_SAVES_KEY, JSON.stringify(next));
  } catch {
    /* ignore */
  }
}
