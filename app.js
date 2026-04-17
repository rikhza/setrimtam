/**
 * CICS Stream Builder - Main App Logic
 * ====================================
 */

document.addEventListener('DOMContentLoaded', () => {

    // ===== UI Elements =====
    const inputTextArea = document.getElementById('copybook-input');
    const parseBtn = document.getElementById('btn-parse');
    const loadSampleBtn = document.getElementById('btn-load-sample');
    const clearAllBtn = document.getElementById('btn-clear-all');

    const formContainer = document.getElementById('form-container');
    const fieldCountEl = document.getElementById('field-count');
    const fillExampleBtn = document.getElementById('btn-fill-example');
    const clearFormBtn = document.getElementById('btn-clear-form');

    const streamRawEl = document.getElementById('stream-raw');
    const streamBreakdownEl = document.getElementById('stream-breakdown');
    const streamLengthEl = document.getElementById('stream-length');
    const terminalPreviewEl = document.getElementById('terminal-preview');
    const cursorInfoEl = document.getElementById('cursor-info');
    
    const copyStreamBtn = document.getElementById('btn-copy-stream');
    const copyHexBtn = document.getElementById('btn-copy-hex');

    // ===== State =====
    let currentFields = [];
    let fieldValues = {};
    let generatedStream = '';

    // ===== Sample Data =====
    const sampleCopybook = `01  INBOUND-MESSAGE.
   4       05  SME-CICS-TRANS                 PIC X(04) VALUE 'SME6'.
   9       05  SME-WSID                       PIC X(05) VALUE '95088'.
  12       05  SME-TXN-CODE                   PIC X(03).
               88 TXN-DOMESTIC-TRANS                    VALUE '802'.
               88 TXN-MFTS-AUTOCR-KU-MP                 VALUE '801'.
               88 TXN-MFTS-AUTOCR-KU-SP                 VALUE '811'.
  23       05  SME-TXN-REF-NO                 PIC 9(11).
  33       05  SME-ACCNO-FR                   PIC 9(10).
A15095*    05  SME-ACCNO-TO                   PIC X(16).
A15095     05  SME-ACCNO-TO                   PIC X(34).
  50       05  SME-LOG-TYPE                   PIC X(01).
               88 SME-WTH-MODE                     VALUE 'L'.
               88 SME-INQ-MODE                     VALUE 'I'.
  65       05  SME-AMT-XCHANGE                PIC 9(13)V99.
  80       05  SME-AMT-INPUT                  PIC 9(13)V99.
  89       05  SME-AMT-KURS                   PIC 9(07)V99.
 104       05  SME-AMT-CHARGES                PIC 9(13)V99.
 107       05  SME-CURR-SYMBL                 PIC X(03).
 115       05  SME-BUSN-DATE                  PIC 9(08).
 119       05  SME-SERV-BRANCH                PIC 9(04).
 149       05  SME-TRF-DESC1                  PIC X(30).
 179       05  SME-TRF-DESC2                  PIC X(30).
A15095     05  SME-RECV-CITY-CODE             PIC 9(04).
 190       05  SME-RECV-BANK-CD-BI            PIC X(07).
 225       05  SME-RECV-BANK-NAME             PIC X(35).
A15095     05  SME-RECV-NAME                  PIC X(70).
 295       05  SME-RECV-ADDR1                 PIC X(35).
A24191     05  SME-REFF-NO                    PIC X(35).`;


    // ===== Toast Notifications =====
    function showToast(message, type = 'info') {
        const container = document.getElementById('toast-container');
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        
        // Icons based on type
        let icon = '';
        if (type === 'success') {
            icon = '<svg class="toast-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>';
        } else if (type === 'error') {
            icon = '<svg class="toast-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><line x1="15" y1="9" x2="9" y2="15"></line><line x1="9" y1="9" x2="15" y2="15"></line></svg>';
        } else if (type === 'warning') {
            icon = '<svg class="toast-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>';
        }
        
        toast.innerHTML = `
            ${icon}
            <span>${message}</span>
        `;
        
        container.appendChild(toast);
        
        // Automatically remove after 3s
        setTimeout(() => {
            toast.style.animation = 'toastOut 0.3s ease forwards';
            setTimeout(() => {
                if(container.contains(toast)) container.removeChild(toast);
            }, 300);
        }, 3000);
    }

    // ===== UI Builders =====

    /**
     * Render the generated form based on parsed fields
     */
    function renderForm(fields) {
        if (!fields || fields.length === 0) {
            formContainer.innerHTML = `
                <div class="empty-state">
                    <p>No valid fields found. Check your copybook format.</p>
                </div>
            `;
            fieldCountEl.textContent = '';
            fieldValues = {};
            currentFields = [];
            updateStream();
            return;
        }

        currentFields = fields;
        formContainer.innerHTML = '';
        
        const nonFillerFields = fields.filter(f => !f.isFiller);
        fieldCountEl.textContent = `${nonFillerFields.length} Fields`;
        
        nonFillerFields.forEach((field, index) => {
            const fieldGroup = document.createElement('div');
            fieldGroup.className = 'field-group';
            fieldGroup.style.animationDelay = `${Math.min(index * 20, 500)}ms`;
            
            // Generate valid input attributes based on type
            let inputType = 'text';
            let inputMode = 'text';
            
            if (field.type === 'numeric') {
                inputMode = 'numeric';
            }
            
            // Build conditions text if any 88 levels exist
            let conditionsHtml = '';
            if (field.conditions && field.conditions.length > 0) {
                const conds = field.conditions.map(c => `<span>${c.value}</span> (${c.name})`).join(', ');
                conditionsHtml = `<div class="field-conditions">Valid: ${conds}</div>`;
            }
            
            // Occurs badge
            let occursHtml = '';
            if (field.occurs > 1 || field.occurrenceIndex > 0) {
                occursHtml = `<span class="field-occurs-badge">OCCURS ${field.occurrenceIndex}</span>`;
            }

            fieldGroup.innerHTML = `
                <div class="field-label">
                    <div style="display: flex; align-items: center; gap: 8px;">
                        <span class="field-name">${field.name}</span>
                        ${occursHtml}
                    </div>
                    <div class="field-meta">
                        <span class="field-type-badge ${field.type}">${field.type}</span>
                        <span class="field-pic">${field.pic}</span>
                        <span class="field-length">${field.length} bytes</span>
                    </div>
                </div>
                <input type="${inputType}" inputmode="${inputMode}" 
                       class="field-input" id="input-${field.name}" 
                       data-name="${field.name}" 
                       placeholder="${field.defaultValue ? `Default: ${field.defaultValue}` : `Enter ${field.type} value...`}">
                <div class="field-input-info">
                    <span class="field-msg"></span>
                    <span class="field-char-count" id="count-${field.name}">0 / ${field.length}</span>
                </div>
                ${conditionsHtml}
            `;
            
            formContainer.appendChild(fieldGroup);
            
            // Add event listeners for realtime stream updates
            const inputEl = fieldGroup.querySelector(`#input-${field.name}`);
            const countEl = fieldGroup.querySelector(`#count-${field.name}`);

            const initial = field.defaultValue != null && field.defaultValue !== ''
                ? String(field.defaultValue)
                : '';
            inputEl.value = initial;
            fieldValues[field.name] = initial;
            countEl.textContent = `${initial.length} / ${field.length}`;
            if (initial.length > field.length) {
                inputEl.classList.add('overflow');
                countEl.classList.add('error');
            }
            
            inputEl.addEventListener('input', (e) => {
                let val = e.target.value;
                
                // Track value
                fieldValues[field.name] = val;
                
                // Update character count
                const currentLen = val.length;
                countEl.textContent = `${currentLen} / ${field.length}`;
                
                // UI feedback for length
                if (currentLen > field.length) {
                    inputEl.classList.add('overflow');
                    countEl.classList.add('error');
                    countEl.classList.remove('warn');
                } else if (field.type === 'alpha' && currentLen === field.length) {
                    inputEl.classList.remove('overflow');
                    countEl.classList.add('warn');
                    countEl.classList.remove('error');
                } else {
                    inputEl.classList.remove('overflow');
                    countEl.classList.remove('error', 'warn');
                }
                
                // Debounce stream generation for better performance
                requestAnimationFrame(() => updateStream());
            });
        });
        
        // Initial stream generation with empty/default values
        updateStream();
    }

    /**
     * Update the stream visualization panels
     */
    function updateStream() {
        if (currentFields.length === 0) return;
        
        const { stream, breakdown } = CobolParser.buildStream(currentFields, fieldValues);
        generatedStream = stream;
        
        // Update lengths
        const totalLen = currentFields.reduce((sum, f) => sum + f.length, 0);
        streamLengthEl.textContent = `${totalLen} bytes`;
        
        // Update raw string
        streamRawEl.textContent = stream;
        
        // Update breakdown
        streamBreakdownEl.innerHTML = '';
        breakdown.forEach(item => {
            const row = document.createElement('div');
            row.className = 'breakdown-row';
            
            let valClass = '';
            if (item.field.isFiller) valClass = 'opacity: 0.3;';
            
            row.innerHTML = `
                <div class="breakdown-pos">+${item.position}</div>
                <div class="breakdown-name" title="${escapeHtml(item.field.name)}">${escapeHtml(item.field.name)}</div>
                <div class="breakdown-len">[ ${item.field.length} ]</div>
                <div class="breakdown-value" style="${valClass}">'${escapeHtml(item.value)}'</div>
            `;
            
            // Highlight corresponding input on hover
            row.addEventListener('mouseenter', () => {
                if(!item.field.isFiller) {
                    const input = document.getElementById(`input-${item.field.name}`);
                    if(input) {
                        input.style.boxShadow = '0 0 0 2px var(--accent-blue)';
                        input.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
                    }
                }
            });
            row.addEventListener('mouseleave', () => {
                if(!item.field.isFiller) {
                    const input = document.getElementById(`input-${item.field.name}`);
                    if(input) input.style.boxShadow = '';
                }
            });
            
            streamBreakdownEl.appendChild(row);
        });
        
        // Render 24x80 Terminal Preview
        renderTerminalPreview(stream);
    }

    /**
     * Render the stream into a 24x80 terminal grid
     */
    function renderTerminalPreview(stream) {
        const COLS = 80;
        const ROWS = 24;
        
        let formatted = '';
        
        // Display as standard 3270 block format
        // Just break at 80 characters
        for (let i = 0; i < stream.length; i += COLS) {
            const line = stream.substring(i, Math.min(i + COLS, stream.length));
            formatted += line + '\n';
        }
        
        terminalPreviewEl.textContent = formatted;
        
        // Add cursor hover tracking
        terminalPreviewEl.onmousemove = function(e) {
            const rect = this.getBoundingClientRect();
            // Estimate char dimensions
            // Font size 11px, line-height 1.3
            const charWidth = 6.6; 
            const charHeight = 14.3;
            
            const x = e.clientX - rect.left - 10; // 10 is padding
            const y = e.clientY - rect.top - 8; // 8 is padding
            
            const col = Math.floor(Math.max(0, x) / charWidth);
            const row = Math.floor(Math.max(0, y) / charHeight);
            
            if(col < COLS && row < ROWS) {
                const streamPos = row * COLS + col;
                if(streamPos < stream.length) {
                    // Find which field owns this position
                    let accPos = 0;
                    for(let f of currentFields) {
                        if(streamPos >= accPos && streamPos < accPos + f.length) {
                            cursorInfoEl.textContent = `[${row+1},${col+1}] Pos:${streamPos} → ${f.name}`;
                            break;
                        }
                        accPos += f.length;
                    }
                } else {
                    cursorInfoEl.textContent = `[${row+1},${col+1}] Empty space`;
                }
            }
        };
        
        terminalPreviewEl.onmouseleave = function() {
            cursorInfoEl.textContent = '';
        }
    }

    // ===== Converters =====
    function escapeHtml(str) {
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }

    function stringToHex(str) {
        let hex = '';
        for(let i = 0; i < str.length; i++) {
            hex += str.charCodeAt(i).toString(16).padStart(2, '0').toUpperCase() + ' ';
        }
        return hex.trim();
    }


    // ===== Event Listeners =====

    // Parse logic
    parseBtn.addEventListener('click', () => {
        const text = inputTextArea.value.trim();
        if (!text) {
            showToast('Please enter or paste a COBOL copybook first.', 'warning');
            return;
        }
        
        try {
            const { fields, warnings } = CobolParser.parse(text);
            
            if (fields.length === 0) {
                showToast('Could not parse any valid fields from the input.', 'error');
                return;
            }
            
            renderForm(fields);
            showToast(`Successfully parsed ${fields.length} fields`, 'success');
            
            if (warnings.length > 0) {
                console.warn("Parse warnings:", warnings);
            }
            
            // Add pulse-glow to form panel to indicate it's ready
            const formPanel = document.getElementById('panel-form');
            formPanel.classList.add('pulse-glow');
            setTimeout(() => {
                formPanel.classList.remove('pulse-glow');
            }, 2000);
            
        } catch (err) {
            console.error(err);
            showToast(`Error parsing copybook: ${err.message}`, 'error');
        }
    });

    // Populate Sample
    loadSampleBtn.addEventListener('click', () => {
        inputTextArea.value = sampleCopybook;
        // Auto parse
        parseBtn.click();
    });

    // Clear everything
    clearAllBtn.addEventListener('click', () => {
        if(confirm('Clear copybook and all generated fields?')) {
            inputTextArea.value = '';
            formContainer.innerHTML = `
                <div class="empty-state">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" width="48" height="48">
                        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                        <polyline points="14 2 14 8 20 8"/>
                        <line x1="16" y1="13" x2="8" y2="13"/>
                        <line x1="16" y1="17" x2="8" y2="17"/>
                        <polyline points="10 9 9 9 8 9"/>
                    </svg>
                    <p>Paste a COBOL copybook on the left and click <strong>Parse</strong></p>
                    <p class="hint">Or click <strong>Load Sample</strong> to try with example data</p>
                </div>
            `;
            fieldCountEl.textContent = '';
            streamRawEl.textContent = '';
            streamBreakdownEl.innerHTML = '';
            streamLengthEl.textContent = '';
            terminalPreviewEl.textContent = '';
            currentFields = [];
            fieldValues = {};
            showToast('All data cleared', 'info');
        }
    });

    // Fill with example data
    fillExampleBtn.addEventListener('click', () => {
        if(currentFields.length === 0) return;
        
        currentFields.forEach(field => {
            if(field.isFiller) return;
            
            const exVal = CobolParser.generateExample(field);
            fieldValues[field.name] = exVal;
            
            const inputEl = document.getElementById(`input-${field.name}`);
            if(inputEl) {
                inputEl.value = exVal;
                // Trigger input event manually so count updates
                inputEl.dispatchEvent(new Event('input'));
            }
        });
        
        updateStream();
        showToast('Form filled with example data', 'success');
    });

    // Clear just the form data
    clearFormBtn.addEventListener('click', () => {
        if(currentFields.length === 0) return;
        
        fieldValues = {};
        
        currentFields.forEach(field => {
            if(field.isFiller) return;
            const inputEl = document.getElementById(`input-${field.name}`);
            if(inputEl) {
                inputEl.value = '';
                inputEl.dispatchEvent(new Event('input'));
            }
        });
        
        updateStream();
        showToast('Form values cleared', 'info');
    });

    // Copy stream string
    copyStreamBtn.addEventListener('click', () => {
        if(!generatedStream) return;
        
        navigator.clipboard.writeText(generatedStream).then(() => {
            showToast('Stream copied to clipboard', 'success');
            
            // Visual feedback
            const rawWrapper = document.querySelector('.stream-raw-wrapper');
            rawWrapper.classList.add('copy-flash');
            setTimeout(() => rawWrapper.classList.remove('copy-flash'), 600);
        }).catch(() => {
            showToast('Could not copy — check clipboard permission', 'error');
        });
    });

    // Copy stream hex
    copyHexBtn.addEventListener('click', () => {
        if(!generatedStream) return;
        
        const hex = stringToHex(generatedStream);
        navigator.clipboard.writeText(hex).then(() => {
            showToast('Hex representation copied to clipboard', 'success');
        }).catch(() => {
            showToast('Could not copy — check clipboard permission', 'error');
        });
    });

    // Keyboard: Cmd/Ctrl+Enter parses copybook
    inputTextArea.addEventListener('keydown', (e) => {
        if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
            e.preventDefault();
            parseBtn.click();
        }
    });

    // Handle initial state — auto focus input
    inputTextArea.focus();
});
