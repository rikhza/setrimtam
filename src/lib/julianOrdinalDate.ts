/**
 * Mainframe-style ordinal "Julian" date: YYDDD (5 digits) or YYYYDDD (7 digits).
 * DDD = day of year, 001–365 (366 in leap years).
 *
 * Two-digit year YY: 00–69 → 2000–2069, 70–99 → 1970–1999 (common batch convention).
 */

function isLeapYear(y: number): boolean {
  return (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;
}

function daysInYear(y: number): number {
  return isLeapYear(y) ? 366 : 365;
}

/** Parse YYYY-MM-DD as local calendar date at noon (avoids DST edge cases). */
export function parseISODateLocal(s: string): Date | null {
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return null;
  const y = parseInt(m[1], 10);
  const mo = parseInt(m[2], 10) - 1;
  const d = parseInt(m[3], 10);
  const dt = new Date(y, mo, d, 12, 0, 0, 0);
  if (dt.getFullYear() !== y || dt.getMonth() !== mo || dt.getDate() !== d) return null;
  return dt;
}

/** 1-based day of year in local timezone. */
export function dayOfYearLocal(d: Date): number {
  const y = d.getFullYear();
  const start = new Date(y, 0, 0, 12, 0, 0, 0);
  const diff = d.getTime() - start.getTime();
  return Math.floor(diff / (24 * 60 * 60 * 1000));
}

export function yyToFourDigitYear(yy: number): number {
  if (yy < 0 || yy > 99) throw new RangeError('yy must be 0–99');
  return yy < 70 ? 2000 + yy : 1900 + yy;
}

export type CalendarToOrdinalResult = {
  yyddd: string;
  yyyyddd: string;
  dayOfYear: number;
  weekday: string;
  longLabel: string;
};

export function calendarToOrdinal(isoDate: string): CalendarToOrdinalResult | null {
  const d = parseISODateLocal(isoDate);
  if (!d) return null;
  const y = d.getFullYear();
  const doy = dayOfYearLocal(d);
  const yy = y % 100;
  return {
    yyddd: `${String(yy).padStart(2, '0')}${String(doy).padStart(3, '0')}`,
    yyyyddd: `${y}${String(doy).padStart(3, '0')}`,
    dayOfYear: doy,
    weekday: d.toLocaleDateString(undefined, { weekday: 'long' }),
    longLabel: d.toLocaleDateString(undefined, {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    }),
  };
}

export type ParsedOrdinal =
  | { kind: 'YYYYDDD'; year: number; ddd: number }
  | { kind: 'YYDDD'; yy: number; ddd: number; inferredYear: number };

/** Strip to digits; accept 5 (YYDDD) or 7 (YYYYDDD) digit forms only. */
export function parseOrdinalDigits(raw: string): ParsedOrdinal | null {
  const digits = raw.replace(/\D/g, '');
  if (digits.length === 7) {
    const year = parseInt(digits.slice(0, 4), 10);
    const ddd = parseInt(digits.slice(4, 7), 10);
    if (year < 1 || year > 9999) return null;
    if (ddd < 1 || ddd > daysInYear(year)) return null;
    return { kind: 'YYYYDDD', year, ddd };
  }
  if (digits.length === 5) {
    const yy = parseInt(digits.slice(0, 2), 10);
    const ddd = parseInt(digits.slice(2, 5), 10);
    const inferredYear = yyToFourDigitYear(yy);
    if (ddd < 1 || ddd > daysInYear(inferredYear)) return null;
    return { kind: 'YYDDD', yy, ddd, inferredYear };
  }
  return null;
}

/** Build local Date from calendar year and day-of-year (1-based). Jan 1 = DDD 1. */
export function dateFromYearAndOrdinal(year: number, ddd: number): Date | null {
  if (ddd < 1 || ddd > daysInYear(year)) return null;
  const d = new Date(year, 0, 1, 12, 0, 0, 0);
  d.setDate(ddd);
  if (d.getFullYear() !== year || dayOfYearLocal(d) !== ddd) return null;
  return d;
}

export type OrdinalDecodeResult = {
  iso: string;
  longLabel: string;
  weekday: string;
  yyddd: string;
  yyyyddd: string;
  note?: string;
};

export function ordinalToCalendar(parsed: ParsedOrdinal): OrdinalDecodeResult | null {
  const year = parsed.kind === 'YYYYDDD' ? parsed.year : parsed.inferredYear;
  const ddd = parsed.ddd;
  const d = dateFromYearAndOrdinal(year, ddd);
  if (!d) return null;

  const y = d.getFullYear();
  const mo = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const iso = `${y}-${mo}-${day}`;

  let note: string | undefined;
  if (parsed.kind === 'YYDDD') {
    note = `YY ${String(parsed.yy).padStart(2, '0')} interpreted as ${parsed.inferredYear} (00–69 → 20xx, 70–99 → 19xx).`;
  }

  const yy = y % 100;
  return {
    iso,
    longLabel: d.toLocaleDateString(undefined, {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    }),
    weekday: d.toLocaleDateString(undefined, { weekday: 'long' }),
    yyddd: `${String(yy).padStart(2, '0')}${String(ddd).padStart(3, '0')}`,
    yyyyddd: `${y}${String(ddd).padStart(3, '0')}`,
    note,
  };
}
