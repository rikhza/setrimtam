/**
 * COBOL Copybook Parser (TypeScript port)
 * =========================================
 * Parses COBOL copybook data definitions into structured
 * field descriptors for stream generation.
 *
 * Handles:
 *   - PIC X(n), PIC 9(n), PIC 9(n)V99, PIC S9(n)V99
 *   - Shorthand PIC XXX, PIC 999, etc.
 *   - REDEFINES (keeps last definition)
 *   - 88-level condition names (stored as metadata)
 *   - OCCURS n TIMES (array expansion)
 *   - FILLER fields
 *   - Comment lines (col 7 star or change-control prefixes)
 *   - VALUE clauses
 *   - COMP-3 / COMPUTATIONAL-3 / PACKED-DECIMAL packed decimal encoding
 */

export interface PicInfo {
	length: number; // total digit/char count from PIC clause
	type: "alpha" | "numeric";
	decimals: number;
	signed: boolean;
}

export interface Condition {
	name: string;
	value: string;
}

/**
 * Storage encoding for a field.
 *   'display'  — standard EBCDIC/ASCII text representation (1 byte per digit/char)
 *   'comp3'    — packed decimal: ceil((digits+1)/2) bytes, represented in stream as uppercase hex
 */
export type FieldEncoding = "display" | "comp3";

export interface CobolField {
	name: string;
	pic: string;
	picInfo: PicInfo;
	/** Physical storage byte count. For COMP-3: ceil((picInfo.length+1)/2). For display: picInfo.length. */
	length: number;
	/** Character count in the logical stream string. For COMP-3: length*2 (hex). For display: length. */
	charLength: number;
	type: "alpha" | "numeric";
	decimals: number;
	signed: boolean;
	encoding: FieldEncoding;
	defaultValue: string;
	redefines: string | null;
	occurs: number;
	conditions: Condition[];
	lineNumber: number;
	isFiller: boolean;
	/** Base COBOL name (e.g. array root before `(n)`); for FILLER always `'FILLER'`. */
	originalName?: string;
	occurrenceIndex?: number;
}

/** Label for UI: repeated FILLER rows share the name FILLER in copybooks. */
export function fieldDisplayName(field: CobolField): string {
	if (field.isFiller) return "FILLER";
	return field.name;
}

export interface BreakdownItem {
	field: CobolField;
	/** Formatted value placed into the stream (hex string for COMP-3, padded text for display). */
	value: string;
	/** Character offset in the stream string. */
	position: number;
	/** Physical byte offset (tracks true record layout). */
	byteOffset: number;
}

export interface ParseResult {
	fields: CobolField[];
	warnings: string[];
}

export interface StreamResult {
	stream: string;
	breakdown: BreakdownItem[];
}

// ---------------------------------------------------------------------------
// PIC clause parser
// ---------------------------------------------------------------------------

export function parsePicClause(pic: string): PicInfo {
	if (!pic) return { length: 0, type: "alpha", decimals: 0, signed: false };

	let normalized = pic.toUpperCase().replace(/\s/g, "");
	let signed = false;

	if (normalized.startsWith("S")) {
		signed = true;
		normalized = normalized.substring(1);
	}

	let type: "alpha" | "numeric" = "alpha";
	let decimals = 0;

	const vParts = normalized.split("V");
	const intPart = vParts[0];
	const decPart = vParts.length > 1 ? vParts[1] : "";

	function parseSegment(seg: string): number {
		if (!seg) return 0;

		const parenMatch = seg.match(/^([X9])\((\d+)\)$/);
		if (parenMatch) {
			if (parenMatch[1] === "9") type = "numeric";
			return parseInt(parenMatch[2], 10);
		}

		if (/^X+$/.test(seg)) return seg.length;

		if (/^9+$/.test(seg)) {
			type = "numeric";
			return seg.length;
		}

		let len = 0;
		const parts = seg.matchAll(/([X9])(?:\((\d+)\))?/g);
		for (const m of parts) {
			if (m[1] === "9") type = "numeric";
			len += m[2] ? parseInt(m[2], 10) : 1;
		}
		return len || seg.length;
	}

	let totalLen = parseSegment(intPart);
	if (decPart) {
		decimals = parseSegment(decPart);
		totalLen += decimals;
	}

	if (intPart.includes("X")) type = "alpha";

	return { length: totalLen, type, decimals, signed };
}

// ---------------------------------------------------------------------------
// COMP-3 helpers
// ---------------------------------------------------------------------------

/**
 * Pack a numeric string value into a COMP-3 hex representation.
 * Returns exactly field.charLength uppercase hex characters (2 per byte).
 *
 * Sign nibble convention:
 *   C = positive (or unsigned positive)
 *   D = negative
 *   F = unsigned (COMP-3 on unsigned PIC 9 fields)
 */
export function packComp3(value: string, field: CobolField): string {
	if (field.encoding !== "comp3") {
		throw new Error("packComp3 called on non-COMP-3 field");
	}

	const negative = value.startsWith("-");
	const cleaned = value.replace(/[^0-9.]/g, "");
	const parts = cleaned.split(".");
	const intDigits = parts[0] || "0";
	const decDigits = (parts[1] ?? "")
		.padEnd(field.decimals, "0")
		.slice(0, field.decimals);

	// Combine into a single digit string, length = field.charLength - 1 (sign nibble takes last)
	const digitStr = (intDigits + decDigits).replace(/[^0-9]/g, "");
	const maxDigits = field.charLength - 1; // charLength = byteLength*2, last nibble = sign
	const paddedDigits = digitStr.padStart(maxDigits, "0").slice(-maxDigits);

	// sign nibble: C positive, D negative, F unsigned (PIC 9 without S)
	const signNibble = field.signed ? (negative ? "D" : "C") : "F";

	return (paddedDigits + signNibble).toUpperCase();
}

/**
 * Unpack a COMP-3 hex string back to a human-readable numeric string.
 * Returns something like "123.45" or "-123.45".
 * Returns null if the hex string is malformed.
 */
export function unpackComp3(hexStr: string, field: CobolField): string | null {
	if (!hexStr || hexStr.length !== field.charLength) return null;
	if (!/^[0-9A-Fa-f]+$/.test(hexStr)) return null;

	const upper = hexStr.toUpperCase();
	const signNibble = upper.charAt(upper.length - 1);
	const digitNibbles = upper.slice(0, upper.length - 1);

	// Validate all digit nibbles are 0-9
	if (!/^[0-9]+$/.test(digitNibbles)) return null;

	const negative = signNibble === "D";
	const isValidSign = ["C", "D", "F"].includes(signNibble);
	if (!isValidSign) return null;

	// Insert decimal point
	if (field.decimals > 0 && digitNibbles.length >= field.decimals) {
		const intPart =
			digitNibbles.slice(0, digitNibbles.length - field.decimals) || "0";
		const decPart = digitNibbles.slice(-field.decimals);
		const num = `${negative ? "-" : ""}${intPart}.${decPart}`;
		return num;
	}

	return `${negative ? "-" : ""}${digitNibbles}`;
}

// ---------------------------------------------------------------------------
// Change-control / comment helpers
// ---------------------------------------------------------------------------

interface ChangeControlInfo {
	changeId: string;
	isCommentedOut: boolean;
	content: string;
}

function isCommentLine(line: string): boolean {
	if (line.length >= 7 && line[6] === "*") return true;
	const trimmed = line.trim();
	if (trimmed.match(/^[A-Z]\d{4,5}\*\s/)) return true;
	if (trimmed.startsWith("*")) return true;
	return false;
}

function getChangeControlInfo(line: string): ChangeControlInfo | null {
	const match = line.match(/^([A-Z]\d{4,5})(\*?)\s+(.*)$/);
	if (match) {
		return {
			changeId: match[1],
			isCommentedOut: match[2] === "*",
			content: match[3],
		};
	}
	return null;
}

// ---------------------------------------------------------------------------
// Main parse function
// ---------------------------------------------------------------------------

export function parseCobol(text: string): ParseResult {
	const lines = text.split("\n");
	const fields: CobolField[] = [];
	const warnings: string[] = [];
	let currentField: CobolField | null = null;
	let fillerCounter = 0;

	for (let i = 0; i < lines.length; i++) {
		const rawLine = lines[i];
		let line = rawLine;

		const ccInfo = getChangeControlInfo(line.trim());
		if (ccInfo) {
			if (ccInfo.isCommentedOut) continue;
			line = "       " + ccInfo.content;
		}

		if (isCommentLine(line)) continue;

		const trimmed = line.trim();
		if (!trimmed) continue;
		if (trimmed.startsWith("*")) continue;

		// Skip 01-level record definition
		if (trimmed.match(/^01\s+/)) continue;

		// 66 RENAMES — not part of stream layout here
		if (trimmed.match(/^66\s+/i)) continue;

		// Parse 88-level condition names (must run before numeric level match)
		if (trimmed.match(/^88\s+/i)) {
			const match88 = trimmed.match(
				/^88\s+(\S+)\s+VALUE\s+'?([^'.]+)'?\s*\.?\s*$/i,
			);
			if (match88) {
				if (currentField) {
					currentField.conditions.push({
						name: match88[1],
						value: match88[2].trim(),
					});
				}
			}
			continue;
		}

		// Elementary / leaf items: COBOL levels 02–49 and 77 (skip group lines without PIC)
		const fieldLineMatch = trimmed.match(/^(\d{2,3})\s+(\S+)\s+(.*)/i);
		if (!fieldLineMatch) continue;

		const level = parseInt(fieldLineMatch[1], 10);
		if (level === 66) continue;
		if (level !== 77 && (level < 2 || level > 49)) continue;

		const rawName = fieldLineMatch[2];
		const isFillerField = rawName.toUpperCase() === "FILLER";
		let rest = fieldLineMatch[3].trim();

		let redefinesTarget: string | null = null;
		const redefinesMatch = rest.match(/^REDEFINES\s+(\S+)\s*(.*)/i);
		if (redefinesMatch) {
			redefinesTarget = redefinesMatch[1];
			rest = redefinesMatch[2].trim();
		}

		const picMatch = rest.match(/PIC\s+(\S+)/i);
		if (!picMatch) continue;

		const picRaw = picMatch[1].replace(/\.$/, "");
		const picInfo = parsePicClause(picRaw);

		// Detect COMP-3 / COMPUTATIONAL-3 / PACKED-DECIMAL encoding
		const isComp3 = /\b(COMP-3|COMPUTATIONAL-3|PACKED-DECIMAL)\b/i.test(
			rest,
		);
		const encoding: FieldEncoding = isComp3 ? "comp3" : "display";

		// Physical byte length
		const byteLength = isComp3
			? Math.ceil((picInfo.length + 1) / 2)
			: picInfo.length;

		// Stream character length (hex pairs for COMP-3)
		const charLength = isComp3 ? byteLength * 2 : byteLength;

		let defaultValue = "";
		const valueMatch =
			rest.match(/VALUE\s+'([^']+)'/i) || rest.match(/VALUE\s+(\S+)/i);
		if (valueMatch) {
			defaultValue = valueMatch[1].replace(/\.$/, "");
		}

		let occurs = 1;
		const occursMatch = rest.match(/OCCURS\s+(\d+)/i);
		if (occursMatch) {
			occurs = parseInt(occursMatch[1], 10);
		}

		const shared = {
			pic: picRaw,
			picInfo,
			length: byteLength,
			charLength,
			type: picInfo.type,
			decimals: picInfo.decimals,
			signed: picInfo.signed,
			encoding,
			defaultValue,
			redefines: redefinesTarget,
			conditions: [] as Condition[],
			lineNumber: i + 1,
		};

		if (redefinesTarget) {
			const nm = isFillerField ? `FILLER__${++fillerCounter}` : rawName;
			const field: CobolField = {
				...shared,
				name: nm,
				occurs,
				isFiller: isFillerField,
				originalName: isFillerField ? "FILLER" : undefined,
			};
			const targetIdx = fields.findIndex(
				(f) => f.name === redefinesTarget,
			);
			if (targetIdx >= 0) {
				fields[targetIdx] = {
					...fields[targetIdx],
					...shared,
					redefines: redefinesTarget,
					name: nm,
					isFiller: isFillerField,
					originalName: isFillerField
						? "FILLER"
						: (fields[targetIdx].originalName ??
							fields[targetIdx].name),
				};
			}
			currentField = field;
			continue;
		}

		const existingIdx = isFillerField
			? -1
			: fields.findIndex((f) => f.name === rawName);
		if (existingIdx >= 0) {
			const field: CobolField = {
				...shared,
				name: rawName,
				occurs,
				isFiller: isFillerField,
				originalName: undefined,
			};
			fields[existingIdx] = field;
			currentField = field;
		} else {
			if (occurs > 1) {
				for (let o = 1; o <= occurs; o++) {
					if (isFillerField) {
						const occField: CobolField = {
							...shared,
							name: `FILLER__${++fillerCounter}`,
							occurs: 1,
							isFiller: true,
							originalName: "FILLER",
							occurrenceIndex: o,
						};
						fields.push(occField);
						currentField = occField;
					} else {
						const occField: CobolField = {
							...shared,
							name: `${rawName}(${o})`,
							occurs: 1,
							isFiller: false,
							originalName: rawName,
							occurrenceIndex: o,
						};
						fields.push(occField);
						currentField = occField;
					}
				}
			} else {
				const nm = isFillerField
					? `FILLER__${++fillerCounter}`
					: rawName;
				const field: CobolField = {
					...shared,
					name: nm,
					occurs: 1,
					isFiller: isFillerField,
					originalName: isFillerField ? "FILLER" : undefined,
				};
				fields.push(field);
				currentField = field;
			}
		}
	}

	return { fields, warnings };
}

// ---------------------------------------------------------------------------
// Example data generator
// ---------------------------------------------------------------------------

export function generateExample(field: CobolField): string {
	// For COMP-3, return a human-readable numeric string; formatValue will pack it.
	if (field.defaultValue) return field.defaultValue;

	if (field.type === "numeric") {
		if (field.decimals > 0) {
			const intLen = field.picInfo.length - field.decimals;
			return (
				"0".repeat(Math.max(intLen - 4, 0)) +
				"1000" +
				"." +
				"0".repeat(field.decimals)
			);
		}
		return "0".repeat(field.picInfo.length);
	}

	return " ".repeat(field.length);
}

// ---------------------------------------------------------------------------
// Value formatter
// ---------------------------------------------------------------------------

export function formatValue(value: string, field: CobolField): string {
	// COMP-3: pack into hex representation
	if (field.encoding === "comp3") {
		try {
			return packComp3(value || "0", field);
		} catch {
			// Fallback to all-zeros packed with positive sign
			const zeros = "0".repeat(field.charLength - 1);
			return zeros + (field.signed ? "C" : "F");
		}
	}

	const len = field.length;

	if (!value) {
		return field.type === "numeric" ? "0".repeat(len) : " ".repeat(len);
	}

	if (field.type === "numeric") {
		let cleaned = value.replace(/[^0-9.\-]/g, "");
		const negative = cleaned.startsWith("-");
		cleaned = cleaned.replace("-", "");

		if (field.decimals > 0) {
			const parts = cleaned.split(".");
			let intPart = parts[0] || "0";
			let decPart = parts[1] || "";

			const intLen = len - field.decimals;
			intPart = intPart.padStart(intLen, "0").substring(0, intLen);
			decPart = decPart
				.padEnd(field.decimals, "0")
				.substring(0, field.decimals);

			const result = intPart + decPart;
			// Prepend sign for signed fields (overpunch is simplified here)
			return field.signed && negative ? result : result;
		}

		cleaned = cleaned.replace(".", "");
		return cleaned.padStart(len, "0").substring(0, len);
	}

	return value.padEnd(len, " ").substring(0, len);
}

// ---------------------------------------------------------------------------
// Stream builder
// ---------------------------------------------------------------------------

export function buildStream(
	fields: CobolField[],
	values: Record<string, string>,
): StreamResult {
	let stream = "";
	const breakdown: BreakdownItem[] = [];
	let charPos = 0;
	let byteOffset = 0;

	for (const field of fields) {
		if (field.isFiller) {
			const fillerVal = " ".repeat(field.charLength);
			breakdown.push({
				field,
				value: fillerVal,
				position: charPos,
				byteOffset,
			});
			stream += fillerVal;
			charPos += field.charLength;
			byteOffset += field.length;
			continue;
		}

		const rawValue = values[field.name] ?? field.defaultValue ?? "";
		const formatted = formatValue(rawValue, field);
		breakdown.push({
			field,
			value: formatted,
			position: charPos,
			byteOffset,
		});
		stream += formatted;
		charPos += field.charLength;
		byteOffset += field.length;
	}

	return { stream, breakdown };
}

/**
 * Slice a captured raw stream string into per-field segments using the same
 * character positions as {@link buildStream}. Use this to inspect pasted
 * dumps without building from form values.
 */
export function sliceRawStreamToBreakdown(
	raw: string,
	fields: CobolField[],
): { breakdown: BreakdownItem[]; warnings: string[] } {
	const warnings: string[] = [];
	const breakdown: BreakdownItem[] = [];
	let charPos = 0;
	let byteOffset = 0;

	const expectedCharLen = fields.reduce((sum, f) => sum + f.charLength, 0);

	if (fields.length === 0) {
		return { breakdown: [], warnings: [] };
	}

	if (raw.length < expectedCharLen) {
		warnings.push(
			`Raw data shorter than layout: ${raw.length} characters, expected ${expectedCharLen}.`,
		);
	} else if (raw.length > expectedCharLen) {
		warnings.push(
			`${raw.length - expectedCharLen} extra character(s) after position ${expectedCharLen} (ignored for mapping).`,
		);
	}

	for (const field of fields) {
		const need = field.charLength;
		const slice = raw.slice(charPos, charPos + need);
		const value =
			slice.length < need
				? slice + " ".repeat(need - slice.length)
				: slice.slice(0, need);

		breakdown.push({
			field,
			value,
			position: charPos,
			byteOffset,
		});
		charPos += need;
		byteOffset += field.length;
	}

	return { breakdown, warnings };
}

/**
 * Strip line breaks from a fixed-screen paste (e.g. 24×80 rows with CRLF)
 * so character indices match the contiguous logical stream used by {@link buildStream}.
 * Streams pasted without CRLF are unchanged (aside from removed CR/LF characters).
 */
export function normalizeRawStreamForLayout(raw: string): string {
	if (!raw) return "";
	return raw.replace(/\r\n/g, "").replace(/\r/g, "").replace(/\n/g, "");
}

/** Map a fixed-width stream segment to a value suitable for the form / storage. */
function streamSegmentToEditableValue(
	field: CobolField,
	segment: string,
): string {
	if (field.encoding === "comp3") {
		return segment.replace(/\s+/g, "").toUpperCase();
	}
	if (field.type === "numeric") {
		return segment.replace(/\s+$/g, "");
	}
	return segment.replace(/\s+$/g, "");
}

/**
 * Parse a pasted raw message (with or without CRLF between screen rows) into
 * per-field values aligned to the copybook layout.
 */
export function rawStreamToFieldValues(
	raw: string,
	fields: CobolField[],
): { values: Record<string, string>; warnings: string[] } {
	const normalized = normalizeRawStreamForLayout(raw);
	const { breakdown, warnings } = sliceRawStreamToBreakdown(
		normalized,
		fields,
	);
	const values: Record<string, string> = {};
	for (const item of breakdown) {
		if (item.field.isFiller) continue;
		values[item.field.name] = streamSegmentToEditableValue(
			item.field,
			item.value,
		);
	}
	return { values, warnings };
}

// ---------------------------------------------------------------------------
// Hex utilities
// ---------------------------------------------------------------------------

export function stringToHex(str: string): string {
	return Array.from(str)
		.map((c) => c.charCodeAt(0).toString(16).padStart(2, "0").toUpperCase())
		.join(" ");
}

/**
 * Build a hex string for the entire stream, aware of field encodings.
 * COMP-3 segments are already hex — reformat as spaced hex bytes.
 * Display segments are encoded as ASCII char codes.
 */
export function buildStreamHex(
	stream: string,
	breakdown: BreakdownItem[],
): string {
	const parts: string[] = [];

	for (const item of breakdown) {
		const seg = stream.slice(
			item.position,
			item.position + item.field.charLength,
		);
		if (item.field.encoding === "comp3") {
			// seg is already uppercase hex (e.g. "01234C") — split into spaced bytes
			const bytes: string[] = [];
			for (let i = 0; i < seg.length; i += 2) {
				bytes.push(seg.slice(i, i + 2));
			}
			parts.push(bytes.join(" "));
		} else {
			// Convert each char to ASCII hex
			for (const ch of seg) {
				parts.push(
					ch
						.charCodeAt(0)
						.toString(16)
						.padStart(2, "0")
						.toUpperCase(),
				);
			}
		}
	}

	return parts.join(" ");
}
