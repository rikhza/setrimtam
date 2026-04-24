/**
 * COBOL Copybook Parser
 * ======================
 * Parses COBOL copybook data definitions into a structured
 * array of field descriptors for stream generation.
 *
 * Handles:
 *   - PIC X(n), PIC 9(n), PIC 9(n)V99, PIC S9(n)V99
 *   - Shorthand PIC XXX, PIC 999, etc.
 *   - REDEFINES (keeps last definition)
 *   - 88-level condition names (stored as metadata, not fields)
 *   - OCCURS n TIMES (array expansion)
 *   - FILLER fields
 *   - Comment lines (lines with * in col 7 or change-control prefixes ending with *)
 *   - VALUE clauses
 */

const CobolParser = (() => {

    /**
     * Calculate the byte length of a PIC clause.
     * @param {string} pic - Raw PIC string, e.g. "X(04)", "9(13)V99", "S9(07)V99", "XXX"
     * @returns {{ length: number, type: 'alpha'|'numeric', decimals: number, signed: boolean }}
     */
    function parsePicClause(pic) {
        if (!pic) return { length: 0, type: 'alpha', decimals: 0, signed: false };

        let normalized = pic.toUpperCase().replace(/\s/g, '');
        let signed = false;

        // Check for sign
        if (normalized.startsWith('S')) {
            signed = true;
            normalized = normalized.substring(1);
        }

        let type = 'alpha';
        let totalLen = 0;
        let decimals = 0;

        // Split on V (implied decimal point)
        const vParts = normalized.split('V');
        const intPart = vParts[0];
        const decPart = vParts.length > 1 ? vParts[1] : '';

        // Parse a PIC segment like "X(04)", "9(13)", "XXX", "99"
        function parseSegment(seg) {
            if (!seg) return 0;

            // Pattern: X(n) or 9(n)
            const parenMatch = seg.match(/^([X9])\((\d+)\)$/);
            if (parenMatch) {
                if (parenMatch[1] === '9') type = 'numeric';
                return parseInt(parenMatch[2], 10);
            }

            // Repeated shorthand: XXX, 999, XX, etc.
            if (/^X+$/.test(seg)) {
                return seg.length;
            }
            if (/^9+$/.test(seg)) {
                type = 'numeric';
                return seg.length;
            }

            // Mixed or complex — attempt generic parse
            let len = 0;
            const parts = seg.matchAll(/([X9])(?:\((\d+)\))?/g);
            for (const m of parts) {
                if (m[1] === '9') type = 'numeric';
                len += m[2] ? parseInt(m[2], 10) : 1;
            }
            return len || seg.length;
        }

        totalLen = parseSegment(intPart);
        if (decPart) {
            decimals = parseSegment(decPart);
            totalLen += decimals;
        }

        // If the PIC starts with X anywhere, it's alphanumeric
        if (intPart.includes('X')) type = 'alpha';

        return { length: totalLen, type, decimals, signed };
    }

    /**
     * Determine if a line is a comment.
     * COBOL comments have * in column 7 (0-indexed col 6).
     * Also handle change-control prefixes like "A03055*"
     */
    function isCommentLine(line) {
        // Standard COBOL: * in column 7
        if (line.length >= 7 && line[6] === '*') return true;

        // Change-control prefix ending with * before actual code
        // e.g. "A03055*    05  FILLER ..."
        const trimmed = line.trim();
        if (trimmed.match(/^[A-Z]\d{4,5}\*\s/)) return true;

        // Pure comment lines
        if (trimmed.startsWith('*')) return true;

        return false;
    }

    /**
     * Check if a line is a change-control line that comments out previous definitions.
     * Lines like "A03055*    05  MY-FIELD ..." indicate the OLD definition is commented.
     * Lines like "A03055     05  MY-FIELD ..." are the NEW (active) definition.
     */
    function getChangeControlInfo(line) {
        const match = line.match(/^([A-Z]\d{4,5})(\*?)\s+(.*)$/);
        if (match) {
            return {
                changeId: match[1],
                isCommentedOut: match[2] === '*',
                content: match[3]
            };
        }
        return null;
    }

    /**
     * Parse the raw copybook text into an array of field descriptors.
     * @param {string} text - Raw COBOL copybook text
     * @returns {Array<Object>} Array of field objects
     */
    function parse(text) {
        const lines = text.split('\n');
        const fields = [];
        const fieldMap = new Map(); // Track by name for REDEFINES handling
        const warnings = [];
        let currentField = null;

        for (let i = 0; i < lines.length; i++) {
            const rawLine = lines[i];
            let line = rawLine;

            // Check change control
            const ccInfo = getChangeControlInfo(line.trim());
            if (ccInfo) {
                if (ccInfo.isCommentedOut) {
                    // This line is commented out by a change control
                    continue;
                }
                // Active change-control line — use the content after the prefix
                line = '       ' + ccInfo.content;
            }

            // Skip comment lines
            if (isCommentLine(line)) continue;

            // Skip pure comment blocks
            const trimmed = line.trim();
            if (!trimmed) continue;
            if (trimmed.startsWith('*')) continue;

            if (trimmed.match(/^01\s+/)) {
                continue;
            }

            if (trimmed.match(/^66\s+/i)) {
                continue;
            }

            if (trimmed.match(/^88\s+/i)) {
                const match88 = trimmed.match(/^88\s+(\S+)\s+VALUE\s+'?([^'.]+)'?\s*\.?\s*$/i);
                if (match88) {
                    if (currentField) {
                        if (!currentField.conditions) currentField.conditions = [];
                        currentField.conditions.push({
                            name: match88[1],
                            value: match88[2].trim()
                        });
                    }
                }
                continue;
            }

            const fieldLineMatch = trimmed.match(/^(\d{2,3})\s+(\S+)\s+(.*)/i);
            if (!fieldLineMatch) continue;

            const level = parseInt(fieldLineMatch[1], 10);
            if (level === 66) continue;
            if (level !== 77 && (level < 2 || level > 49)) continue;

            const fieldName = fieldLineMatch[2];
            let rest = fieldLineMatch[3].trim();

            // Handle REDEFINES — skip the redefined field, this one replaces it
            let redefinesTarget = null;
            const redefinesMatch = rest.match(/^REDEFINES\s+(\S+)\s*(.*)/i);
            if (redefinesMatch) {
                redefinesTarget = redefinesMatch[1];
                rest = redefinesMatch[2].trim();
            }

            // Extract PIC clause
            const picMatch = rest.match(/PIC\s+(\S+)/i);
            if (!picMatch) {
                // Might be a group-level or REDEFINES without PIC
                continue;
            }

            let picRaw = picMatch[1].replace(/\.$/, ''); // Remove trailing period

            // Parse PIC
            const picInfo = parsePicClause(picRaw);

            // Extract VALUE clause
            let defaultValue = '';
            const valueMatch = rest.match(/VALUE\s+'([^']+)'/i) || rest.match(/VALUE\s+(\S+)/i);
            if (valueMatch) {
                defaultValue = valueMatch[1].replace(/\.$/, '');
            }

            // Extract OCCURS
            let occurs = 1;
            const occursMatch = rest.match(/OCCURS\s+(\d+)/i);
            if (occursMatch) {
                occurs = parseInt(occursMatch[1], 10);
            }

            // Build field descriptor
            const field = {
                name: fieldName,
                pic: picRaw,
                picInfo: picInfo,
                length: picInfo.length,
                type: picInfo.type,
                decimals: picInfo.decimals,
                signed: picInfo.signed,
                defaultValue: defaultValue,
                redefines: redefinesTarget,
                occurs: occurs,
                conditions: [],
                lineNumber: i + 1
            };

            // Handle REDEFINES — replace the target
            if (redefinesTarget) {
                // This field redefines another; skip it as a separate field
                // but update the existing field's PIC info
                const targetIdx = fields.findIndex(f => f.name === redefinesTarget);
                if (targetIdx >= 0) {
                    fields[targetIdx] = {
                        ...fields[targetIdx],
                        pic: picRaw,
                        picInfo: picInfo,
                        length: picInfo.length,
                        type: picInfo.type,
                        decimals: picInfo.decimals,
                        signed: picInfo.signed,
                        redefines: redefinesTarget,
                        name: fieldName
                    };
                }
                currentField = field;
                continue;
            }

            // Check for duplicate field names (multiple definitions due to change control)
            const existingIdx = fields.findIndex(f => f.name === fieldName);
            if (existingIdx >= 0) {
                // Replace with the latest definition
                fields[existingIdx] = field;
                currentField = field;
            } else {
                // Handle OCCURS — expand into multiple fields
                if (occurs > 1) {
                    for (let o = 1; o <= occurs; o++) {
                        const occField = {
                            ...field,
                            name: `${fieldName}(${o})`,
                            originalName: fieldName,
                            occurrenceIndex: o,
                            occurs: 1 // expanded
                        };
                        fields.push(occField);
                    }
                } else {
                    fields.push(field);
                }
                currentField = field;
            }
        }

        // Filter out FILLER fields (they still need to take space in the stream)
        // But mark them so the UI knows
        fields.forEach(f => {
            f.isFiller = f.name === 'FILLER';
        });

        return { fields, warnings };
    }

    /**
     * Generate example data for a field based on its PIC type.
     */
    function generateExample(field) {
        if (field.defaultValue) return field.defaultValue;

        if (field.type === 'numeric') {
            if (field.decimals > 0) {
                const intLen = field.length - field.decimals;
                return '0'.repeat(Math.max(intLen - 4, 0)) + '1000' + '0'.repeat(field.decimals);
            }
            return '0'.repeat(field.length);
        }

        return ' '.repeat(field.length);
    }

    /**
     * Format a field value according to its PIC clause.
     * @param {string} value - User-entered value
     * @param {Object} field - Field descriptor
     * @returns {string} - Formatted value, padded/truncated to exact length
     */
    function formatValue(value, field) {
        const len = field.length;

        if (!value) {
            // Default: spaces for alpha, zeros for numeric
            return field.type === 'numeric' ? '0'.repeat(len) : ' '.repeat(len);
        }

        if (field.type === 'numeric') {
            // Strip non-numeric except decimal point and sign
            let cleaned = value.replace(/[^0-9.\-]/g, '');
            let isNeg = cleaned.startsWith('-');
            cleaned = cleaned.replace('-', '');

            if (field.decimals > 0) {
                const parts = cleaned.split('.');
                let intPart = parts[0] || '0';
                let decPart = parts[1] || '';

                const intLen = len - field.decimals;
                intPart = intPart.padStart(intLen, '0').substring(0, intLen);
                decPart = decPart.padEnd(field.decimals, '0').substring(0, field.decimals);

                let result = intPart + decPart;
                if (field.signed && isNeg) {
                    // For signed fields, the last byte encodes the sign in EBCDIC
                    // For stream purposes, we'll prefix with a sign representation
                    // Simplification: use the sign in the stream
                    result = result; // Keep as is for stream
                }
                return result;
            }

            // Integer numeric
            cleaned = cleaned.replace('.', '');
            return cleaned.padStart(len, '0').substring(0, len);
        }

        // Alphanumeric — left-justify, pad with spaces, truncate
        return value.padEnd(len, ' ').substring(0, len);
    }

    /**
     * Build the complete stream from field values.
     * @param {Array<Object>} fields - Parsed field descriptors
     * @param {Object} values - Map of field name → value
     * @returns {{ stream: string, breakdown: Array<{ field: Object, value: string, position: number }> }}
     */
    function buildStream(fields, values) {
        let stream = '';
        const breakdown = [];
        let pos = 0;

        for (const field of fields) {
            if (field.isFiller) {
                const fillerVal = ' '.repeat(field.length);
                breakdown.push({ field, value: fillerVal, position: pos });
                stream += fillerVal;
                pos += field.length;
                continue;
            }

            const rawValue = values[field.name] || field.defaultValue || '';
            const formatted = formatValue(rawValue, field);
            breakdown.push({ field, value: formatted, position: pos });
            stream += formatted;
            pos += field.length;
        }

        return { stream, breakdown };
    }

    return {
        parse,
        parsePicClause,
        generateExample,
        formatValue,
        buildStream
    };

})();
