// Monaco Editor initialization and configuration
let editor = null;
let currentFindings = [];
let decorations = [];

// Initialize Monaco Editor
function initializeMonacoEditor() {
    // Configure Monaco loader to use CDN
    require.config({ 
        paths: { 
            'vs': 'https://cdn.jsdelivr.net/npm/monaco-editor@0.44.0/min/vs' 
        }
    });

    require(['vs/editor/editor.main'], function() {
        // Register custom themes matching Catppuccin
        defineCustomThemes();
        
        // Create the editor instance
        createEditor();
        
        // Set up event listeners
        setupEditorListeners();
    });
}

// Define Catppuccin themes for Monaco
function defineCustomThemes() {
    monaco.editor.defineTheme('catppuccin-mocha', {
        base: 'vs-dark',
        inherit: true,
        rules: [
            { token: 'comment', foreground: '6c7086' },
            { token: 'keyword', foreground: 'cba6f7' },
            { token: 'string', foreground: 'a6e3a1' },
            { token: 'number', foreground: 'fab387' },
            { token: 'type', foreground: '89b4fa' },
            { token: 'variable', foreground: 'cdd6f4' },
            { token: 'delimiter', foreground: '9399b2' },
            { token: 'tag', foreground: 'f38ba8' }
        ],
        colors: {
            'editor.background': '#1e1e2e',
            'editor.foreground': '#cdd6f4',
            'editor.lineHighlightBackground': '#313244',
            'editor.selectionBackground': '#45475a',
            'editorCursor.foreground': '#cba6f7',
            'editorWhitespace.foreground': '#45475a',
            'editorIndentGuide.background': '#313244',
            'editorIndentGuide.activeBackground': '#45475a',
            'editor.findMatchBackground': '#585b70',
            'editor.findMatchHighlightBackground': '#45475a',
            'editorBracketMatch.background': '#45475a',
            'editorBracketMatch.border': '#cba6f7',
            'editorGutter.background': '#181825',
            'editorLineNumber.foreground': '#6c7086',
            'editorLineNumber.activeForeground': '#cba6f7',
            'editorOverviewRuler.background': '#181825',
            'scrollbar.shadow': '#11111b',
            'scrollbarSlider.background': '#45475a',
            'scrollbarSlider.hoverBackground': '#585b70',
            'scrollbarSlider.activeBackground': '#6c7086'
        }
    });

    monaco.editor.defineTheme('catppuccin-latte', {
        base: 'vs',
        inherit: true,
        rules: [
            { token: 'comment', foreground: '9ca0b0' },
            { token: 'keyword', foreground: '8839ef' },
            { token: 'string', foreground: '40a02b' },
            { token: 'number', foreground: 'fe640b' },
            { token: 'type', foreground: '1e66f5' },
            { token: 'variable', foreground: '4c4f69' },
            { token: 'delimiter', foreground: '7c7f93' },
            { token: 'tag', foreground: 'd20f39' }
        ],
        colors: {
            'editor.background': '#eff1f5',
            'editor.foreground': '#4c4f69',
            'editor.lineHighlightBackground': '#dce0e8',
            'editor.selectionBackground': '#ccd0da',
            'editorCursor.foreground': '#8839ef',
            'editorWhitespace.foreground': '#ccd0da',
            'editorIndentGuide.background': '#dce0e8',
            'editorIndentGuide.activeBackground': '#ccd0da',
            'editor.findMatchBackground': '#bcc0cc',
            'editor.findMatchHighlightBackground': '#ccd0da',
            'editorBracketMatch.background': '#ccd0da',
            'editorBracketMatch.border': '#8839ef',
            'editorGutter.background': '#e6e9ef',
            'editorLineNumber.foreground': '#9ca0b0',
            'editorLineNumber.activeForeground': '#8839ef',
            'editorOverviewRuler.background': '#e6e9ef',
            'scrollbar.shadow': '#dce0e8',
            'scrollbarSlider.background': '#ccd0da',
            'scrollbarSlider.hoverBackground': '#bcc0cc',
            'scrollbarSlider.activeBackground': '#acb0be'
        }
    });

    monaco.editor.defineTheme('catppuccin-frappe', {
        base: 'vs-dark',
        inherit: true,
        rules: [
            { token: 'comment', foreground: '737994' },
            { token: 'keyword', foreground: 'ca9ee6' },
            { token: 'string', foreground: 'a6d189' },
            { token: 'number', foreground: 'ef9f76' },
            { token: 'type', foreground: '8caaee' },
            { token: 'variable', foreground: 'c6d0f5' },
            { token: 'delimiter', foreground: '949cbb' },
            { token: 'tag', foreground: 'e78284' }
        ],
        colors: {
            'editor.background': '#303446',
            'editor.foreground': '#c6d0f5',
            'editor.lineHighlightBackground': '#414559',
            'editor.selectionBackground': '#51576d',
            'editorCursor.foreground': '#ca9ee6',
            'editorWhitespace.foreground': '#51576d',
            'editorIndentGuide.background': '#414559',
            'editorIndentGuide.activeBackground': '#51576d',
            'editor.findMatchBackground': '#626880',
            'editor.findMatchHighlightBackground': '#51576d',
            'editorBracketMatch.background': '#51576d',
            'editorBracketMatch.border': '#ca9ee6',
            'editorGutter.background': '#292c3c',
            'editorLineNumber.foreground': '#737994',
            'editorLineNumber.activeForeground': '#ca9ee6',
            'editorOverviewRuler.background': '#292c3c',
            'scrollbar.shadow': '#232634',
            'scrollbarSlider.background': '#51576d',
            'scrollbarSlider.hoverBackground': '#626880',
            'scrollbarSlider.activeBackground': '#737994'
        }
    });

    monaco.editor.defineTheme('catppuccin-macchiato', {
        base: 'vs-dark',
        inherit: true,
        rules: [
            { token: 'comment', foreground: '6e738d' },
            { token: 'keyword', foreground: 'c6a0f6' },
            { token: 'string', foreground: 'a6da95' },
            { token: 'number', foreground: 'f5a97f' },
            { token: 'type', foreground: '8aadf4' },
            { token: 'variable', foreground: 'cad3f5' },
            { token: 'delimiter', foreground: '939ab7' },
            { token: 'tag', foreground: 'ed8796' }
        ],
        colors: {
            'editor.background': '#24273a',
            'editor.foreground': '#cad3f5',
            'editor.lineHighlightBackground': '#363a4f',
            'editor.selectionBackground': '#494d64',
            'editorCursor.foreground': '#c6a0f6',
            'editorWhitespace.foreground': '#494d64',
            'editorIndentGuide.background': '#363a4f',
            'editorIndentGuide.activeBackground': '#494d64',
            'editor.findMatchBackground': '#5b6078',
            'editor.findMatchHighlightBackground': '#494d64',
            'editorBracketMatch.background': '#494d64',
            'editorBracketMatch.border': '#c6a0f6',
            'editorGutter.background': '#1e2030',
            'editorLineNumber.foreground': '#6e738d',
            'editorLineNumber.activeForeground': '#c6a0f6',
            'editorOverviewRuler.background': '#1e2030',
            'scrollbar.shadow': '#181926',
            'scrollbarSlider.background': '#494d64',
            'scrollbarSlider.hoverBackground': '#5b6078',
            'scrollbarSlider.activeBackground': '#6e738d'
        }
    });
}

// Create the Monaco Editor instance
function createEditor() {
    const container = document.getElementById('monaco-container');
    if (!container) return;

    editor = monaco.editor.create(container, {
        value: '# Upload or paste your service mesh configuration here\n# Supports Istio, Consul, and Linkerd configurations\n# YAML and JSON formats are supported\n',
        language: 'yaml',
        theme: 'catppuccin-mocha',
        automaticLayout: true,
        fontSize: 14,
        minimap: {
            enabled: true
        },
        scrollBeyondLastLine: false,
        wordWrap: 'on',
        lineNumbers: 'on',
        glyphMargin: true,
        folding: true,
        lineDecorationsWidth: 10,
        lineNumbersMinChars: 3,
        renderWhitespace: 'selection',
        quickSuggestions: {
            other: true,
            comments: false,
            strings: true
        },
        parameterHints: {
            enabled: true
        },
        suggestOnTriggerCharacters: true,
        acceptSuggestionOnEnter: 'on',
        tabCompletion: 'on',
        wordBasedSuggestions: true
    });

    // Make editor available globally for debugging
    window.editor = editor;

    // Add custom actions
    addEditorActions();
}

// Add custom actions to the editor
function addEditorActions() {
    // Format Document action
    editor.addAction({
        id: 'format-document',
        label: 'Format Document',
        keybindings: [
            monaco.KeyMod.Shift | monaco.KeyMod.Alt | monaco.KeyCode.KeyF
        ],
        precondition: null,
        keybindingContext: null,
        contextMenuGroupId: 'navigation',
        contextMenuOrder: 1.5,
        run: function(ed) {
            ed.getAction('editor.action.formatDocument').run();
        }
    });

    // Jump to next issue
    editor.addAction({
        id: 'next-issue',
        label: 'Go to Next Issue',
        keybindings: [
            monaco.KeyCode.F8
        ],
        run: function(ed) {
            navigateToNextIssue();
        }
    });

    // Jump to previous issue
    editor.addAction({
        id: 'prev-issue',
        label: 'Go to Previous Issue',
        keybindings: [
            monaco.KeyMod.Shift | monaco.KeyCode.F8
        ],
        run: function(ed) {
            navigateToPreviousIssue();
        }
    });
}

// Setup event listeners for the editor
function setupEditorListeners() {
    // Listen for content changes
    editor.onDidChangeModelContent(() => {
        // Debounce the analysis
        clearTimeout(window.analysisTimeout);
        window.analysisTimeout = setTimeout(() => {
            analyzeContent();
        }, 1000);
    });

    // Listen for theme changes
    document.addEventListener('themeChanged', (event) => {
        const theme = event.detail.theme;
        const monacoTheme = `catppuccin-${theme}`;
        monaco.editor.setTheme(monacoTheme);
    });
}

// Analyze content and update decorations
function analyzeContent() {
    console.log('analyzeContent called');
    if (!editor) {
        console.error('Editor not initialized');
        return;
    }
    
    const content = editor.getValue();
    console.log('Content length:', content.length);
    if (!content || content.trim().length === 0) {
        console.log('No content to analyze');
        return;
    }

    console.log('Sending analysis request...');
    // Send content for analysis
    fetch('/analyze-content', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ content })
    })
    .then(response => response.json())
    .then(data => {
        console.log('Analysis response:', data);
        if (data.success) {
            updateEditorDecorations(data.findings);
            currentFindings = data.findings;
            updateResultsPanel(data);
        } else {
            console.error('Analysis failed:', data.message);
        }
    })
    .catch(error => {
        console.error('Analysis failed:', error);
    });
}

// Make analyzeContent globally available
window.analyzeContent = analyzeContent;

// Escape text before it goes into innerHTML. index.html has its own copy, but
// that one is scoped inside a DOMContentLoaded handler and isn't visible here.
function esc(value) {
    if (value === null || value === undefined) return '';
    return String(value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

// Update results panel
function updateResultsPanel(data) {
    console.log('Updating results panel with:', data);
    
    // No longer showing summary counts - go straight to findings list
    const findingsList = document.getElementById('findings-list');
    if (data.findings.length === 0) {
        findingsList.innerHTML = '<p class="text-center text-muted">No issues found! Configuration follows security best practices.</p>';
        return;
    }
    
    findingsList.innerHTML = '';

    // Most severe first, so the things that matter are read first.
    const severityRank = { Critical: 0, High: 1, Medium: 2, Low: 3 };
    const findings = [...data.findings].sort(
        (a, b) => (severityRank[a.severity] ?? 9) - (severityRank[b.severity] ?? 9)
    );

    findings.forEach(finding => {
        const div = document.createElement('div');
        div.className = 'finding-item';
        // data-severity is what the Critical/High/Medium/Low filter buttons match on.
        div.setAttribute('data-severity', finding.severity);

        const color = getSeverityColor(finding.severity);
        div.style.borderLeft = `4px solid ${color}`;
        div.style.backgroundColor = 'rgba(203, 166, 247, 0.05)';

        // nistControls arrive resolved to {id, title, description}; show the id
        // and put the human-readable title in the tooltip.
        let nistControlsHtml = '';
        if (finding.nistControls && finding.nistControls.length > 0) {
            nistControlsHtml = '<div style="margin-top: 0.5rem;">';
            finding.nistControls.forEach(control => {
                const id = esc(control.id || control);
                const title = esc(control.title || '');
                nistControlsHtml += `<span title="${title}" style="display: inline-block; font-size: 0.65rem; padding: 2px 6px; margin: 2px; border-radius: 3px; background-color: rgba(137, 180, 250, 0.2); color: var(--ctp-blue); border: 1px solid var(--ctp-blue);">${id}</span>`;
            });
            nistControlsHtml += '</div>';
        }

        div.innerHTML = `
            <div style="display: flex; justify-content: space-between; align-items: start; gap: 0.5rem;">
                <h4 style="font-size: 0.875rem; font-weight: 600; margin: 0; color: var(--ctp-text);">
                    ${esc(finding.issue)}
                </h4>
                <span style="flex-shrink: 0; font-size: 0.7rem; padding: 2px 8px; border-radius: 4px; background-color: ${color}33; color: ${color}; font-weight: 600;">
                    ${esc(finding.severity)}
                </span>
            </div>
            <p style="font-size: 0.7rem; margin: 0.25rem 0; color: var(--ctp-subtext0);">
                ${esc(finding.category)}${finding.nistDocument ? ` &middot; ${esc(finding.nistDocument)}` : ''}${finding.section ? `, ${esc(finding.section)}` : ''}
            </p>
            ${finding.requirement ? `<p style="font-size: 0.75rem; margin: 0.5rem 0; color: var(--ctp-text); font-style: italic;">${esc(finding.requirement)}</p>` : ''}
            ${finding.impact ? `<p style="font-size: 0.75rem; margin: 0.5rem 0; color: var(--ctp-yellow);">⚠️ ${esc(finding.impact)}</p>` : ''}
            ${finding.remediation ? `<p style="font-size: 0.75rem; margin: 0.5rem 0; color: var(--ctp-green);">✅ ${esc(finding.remediation)}</p>` : ''}
            ${nistControlsHtml}
            ${finding.location ? `<p style="font-size: 0.75rem; margin: 0.25rem 0 0 0; color: var(--ctp-blue); cursor: pointer;">📍 ${esc(finding.location)}</p>` : ''}
        `;
        
        if (finding.location) {
            div.style.cursor = 'pointer';
            div.onclick = () => {
                const lineMatch = finding.location.match(/line (\d+)/i);
                if (lineMatch) {
                    jumpToLine(parseInt(lineMatch[1]));
                }
            };
        }
        
        findingsList.appendChild(div);
    });
}

// Update editor decorations based on findings
function updateEditorDecorations(findings) {
    console.log('Updating decorations with findings:', findings);
    const newDecorations = [];
    const model = editor.getModel();
    
    if (!model) {
        console.error('No model available for decorations');
        return;
    }

    findings.forEach(finding => {
        if (finding.location) {
            // Parse location (e.g., "line 15" or "defaultConfig.mtls")
            const lineMatch = finding.location.match(/line (\d+)/i);
            if (lineMatch) {
                const lineNumber = parseInt(lineMatch[1]);
                console.log(`Adding decoration for line ${lineNumber}: ${finding.issue}`);
                
                // Make sure line number is valid
                if (lineNumber > 0 && lineNumber <= model.getLineCount()) {
                    const range = new monaco.Range(lineNumber, 1, lineNumber, model.getLineMaxColumn(lineNumber));
                    
                    // Determine decoration style based on NIST document
                    let className = 'squiggly-medium';
                    let glyphClass = 'glyph-medium';
                    let color = '#cba6f7'; // Mauve for NIST
                    
                    if (finding.nistDocument) {
                        if (finding.nistDocument.includes('800-207')) {
                            // Zero Trust Architecture - critical
                            className = 'squiggly-critical';
                            glyphClass = 'glyph-critical';
                            color = '#f38ba8'; // Red
                        } else if (finding.nistDocument.includes('800-204')) {
                            // Service Mesh Security - high
                            className = 'squiggly-high';
                            glyphClass = 'glyph-high';
                            color = '#fab387'; // Peach
                        } else if (finding.nistDocument.includes('800-57')) {
                            // Key Management - medium
                            className = 'squiggly-medium';
                            glyphClass = 'glyph-medium';
                            color = '#f9e2af'; // Yellow
                        }
                    }
                    
                    newDecorations.push({
                        range: range,
                        options: {
                            isWholeLine: true,
                            className: className,
                            glyphMarginClassName: glyphClass,
                            glyphMarginHoverMessage: {
                                value: formatHoverMessage(finding)
                            },
                            hoverMessage: {
                                value: formatHoverMessage(finding)
                            },
                            minimap: {
                                color: color,
                                position: monaco.editor.MinimapPosition.Inline
                            },
                            overviewRuler: {
                                color: color,
                                position: monaco.editor.OverviewRulerLane.Right
                            },
                            inlineClassName: className,
                            linesDecorationsClassName: 'line-decoration-' + className
                        }
                    });
                } else {
                    console.warn(`Invalid line number ${lineNumber} for finding: ${finding.issue}`);
                }
            }
        }
    });

    console.log(`Applying ${newDecorations.length} decorations`);
    // Apply decorations
    decorations = editor.deltaDecorations(decorations, newDecorations);
}

// Get decoration class based on severity
function getSeverityDecorationClass(severity) {
    const classes = {
        'Critical': 'squiggly-critical',
        'High': 'squiggly-high',
        'Medium': 'squiggly-medium',
        'Low': 'squiggly-low'
    };
    return classes[severity] || 'squiggly-medium';
}

// Get color for severity
function getSeverityColor(severity) {
    const colors = {
        'Critical': '#f38ba8',
        'High': '#fab387',
        'Medium': '#f9e2af',
        'Low': '#a6e3a1'
    };
    return colors[severity] || '#f9e2af';
}

// Format hover message for findings
function formatHoverMessage(finding) {
    let message = `**${finding.nistDocument || 'Security Issue'}**\n`;
    if (finding.section) {
        message += `*${finding.section}*\n\n`;
    }
    
    message += `**Issue:** ${finding.issue || finding.message || 'Configuration problem'}\n\n`;
    
    if (finding.requirement) {
        message += `**NIST Requirement:**\n"${finding.requirement}"\n\n`;
    }
    
    if (finding.impact) {
        message += `**Impact:** ${finding.impact}\n\n`;
    }
    
    if (finding.remediation) {
        message += `**Remediation:** ${finding.remediation}\n\n`;
    }
    
    // Add NIST 800-53 Rev 5 controls if present
    if (finding.nistControls && finding.nistControls.length > 0) {
        message += `**NIST 800-53 Rev 5 Controls:** ${finding.nistControls.join(', ')}\n\n`;
    }
    
    return message;
}

// Navigate to next issue
function navigateToNextIssue() {
    const position = editor.getPosition();
    const currentLine = position.lineNumber;
    
    for (const decoration of decorations) {
        const range = editor.getModel().getDecorationRange(decoration);
        if (range && range.startLineNumber > currentLine) {
            editor.setPosition({ lineNumber: range.startLineNumber, column: 1 });
            editor.revealLineInCenter(range.startLineNumber);
            return;
        }
    }
    
    // Wrap to first issue
    if (decorations.length > 0) {
        const range = editor.getModel().getDecorationRange(decorations[0]);
        if (range) {
            editor.setPosition({ lineNumber: range.startLineNumber, column: 1 });
            editor.revealLineInCenter(range.startLineNumber);
        }
    }
}

// Navigate to previous issue
function navigateToPreviousIssue() {
    const position = editor.getPosition();
    const currentLine = position.lineNumber;
    
    for (let i = decorations.length - 1; i >= 0; i--) {
        const range = editor.getModel().getDecorationRange(decorations[i]);
        if (range && range.startLineNumber < currentLine) {
            editor.setPosition({ lineNumber: range.startLineNumber, column: 1 });
            editor.revealLineInCenter(range.startLineNumber);
            return;
        }
    }
    
    // Wrap to last issue
    if (decorations.length > 0) {
        const range = editor.getModel().getDecorationRange(decorations[decorations.length - 1]);
        if (range) {
            editor.setPosition({ lineNumber: range.startLineNumber, column: 1 });
            editor.revealLineInCenter(range.startLineNumber);
        }
    }
}

// Load content into editor
function loadContent(content, language = 'yaml') {
    if (editor) {
        editor.setValue(content);
        monaco.editor.setModelLanguage(editor.getModel(), language);
    }
}

// Get editor content
function getEditorContent() {
    return editor ? editor.getValue() : '';
}

// Jump to line from findings list
function jumpToLine(lineNumber) {
    if (editor) {
        editor.setPosition({ lineNumber: lineNumber, column: 1 });
        editor.revealLineInCenter(lineNumber);
        editor.focus();
    }
}

// Export annotated configuration
function exportAnnotatedConfig() {
    const content = getEditorContent();
    const lines = content.split('\n');
    
    currentFindings.forEach(finding => {
        if (finding.location) {
            const lineMatch = finding.location.match(/line (\d+)/i);
            if (lineMatch) {
                const lineNumber = parseInt(lineMatch[1]) - 1;
                if (lines[lineNumber]) {
                    lines[lineNumber] = `${lines[lineNumber]} # ${finding.nistDocument}: ${finding.issue}`;
                }
            }
        }
    });
    
    return lines.join('\n');
}

// Make functions globally available
window.loadContent = loadContent;
window.getEditorContent = getEditorContent;
window.jumpToLine = jumpToLine;
window.exportAnnotatedConfig = exportAnnotatedConfig;

// Initialize on page load
window.addEventListener('load', initializeMonacoEditor);