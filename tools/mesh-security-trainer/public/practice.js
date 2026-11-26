/* Practice mode: hunt-then-reveal.
 *
 * The server owns the answers. This client shows a config, collects one
 * {line, category} flag per line the learner clicks, and POSTs them to be
 * graded. It never receives the answer key until the grade response comes back.
 */
(function () {
  'use strict';

  const $ = (id) => document.getElementById(id);
  const SEV_COLOR = { Critical: 'var(--ctp-red)', High: 'var(--ctp-peach)', Medium: 'var(--ctp-yellow)', Low: 'var(--ctp-green)' };
  const esc = (s) => String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');

  // Per-hunt state.
  let current = null;          // { exercise, config, categories }
  const flags = new Map();     // line number -> category

  // ---- screen switching ------------------------------------------------------
  function show(screen) {
    ['picker', 'hunt', 'reveal'].forEach((s) => $(s).classList.toggle('hidden', s !== screen));
    window.scrollTo(0, 0);
  }

  // ---- screen 1: exercise picker --------------------------------------------
  async function loadPicker() {
    const res = await fetch('/api/exercises');
    const { exercises } = await res.json();
    const list = $('exercise-list');
    list.innerHTML = '';

    for (const ex of exercises) {
      const card = document.createElement('button');
      card.className = 'bg-card rounded-lg p-4 text-left';
      card.style.cssText = 'display:block; transition:.15s;';
      card.onmouseenter = () => (card.style.borderColor = 'var(--ctp-mauve)');
      card.onmouseleave = () => (card.style.borderColor = 'var(--ctp-surface0)');
      const diffColor = ex.difficulty === 'Advanced' ? 'var(--ctp-peach)' : 'var(--ctp-green)';
      card.innerHTML =
        `<div class="flex justify-between items-center mb-2">
           <span class="pill" style="background:var(--ctp-surface0); color:var(--ctp-lavender);">${esc(ex.mesh)}</span>
           <span class="pill" style="background:transparent; color:${diffColor};">${esc(ex.difficulty)}</span>
         </div>
         <h3 class="font-semibold mb-1">${esc(ex.title)}</h3>
         <p class="text-sm text-muted">${esc(ex.brief)}</p>`;
      card.onclick = () => startHunt(ex.id);
      list.appendChild(card);
    }
    show('picker');
  }

  // ---- screen 2: the hunt ----------------------------------------------------
  async function startHunt(id) {
    const res = await fetch('/api/exercises/' + encodeURIComponent(id));
    if (!res.ok) return;
    current = await res.json();
    flags.clear();

    $('hunt-title').textContent = current.exercise.title;
    $('hunt-brief').textContent = current.exercise.brief;
    $('hint-text').classList.add('hidden');
    $('hint-btn').classList.remove('hidden');

    renderConfig();
    renderFlags();
    show('hunt');
  }

  function renderConfig() {
    const view = $('config-view');
    view.innerHTML = '';
    current.config.split('\n').forEach((text, i) => {
      const lineNo = i + 1;
      const row = document.createElement('div');
      row.className = 'code-line';
      row.dataset.line = String(lineNo);
      row.innerHTML = `<span class="ln">${lineNo}</span><span class="lc">${esc(text) || ' '}</span><span class="flag-dot"></span>`;
      row.onclick = () => onLineClick(lineNo, row);
      view.appendChild(row);
    });
  }

  // Clicking a line opens an inline category chooser. Picking a category flags
  // the line; picking the blank option clears it.
  function onLineClick(lineNo, row) {
    const existing = row.querySelector('select');
    if (existing) { existing.focus(); return; }

    const sel = document.createElement('select');
    sel.innerHTML = '<option value="">— what\'s wrong here? —</option>' +
      current.categories.map((c) => `<option ${flags.get(lineNo) === c ? 'selected' : ''}>${esc(c)}</option>`).join('') +
      '<option value="__none">Nothing — this line is fine</option>';
    sel.onclick = (e) => e.stopPropagation();
    sel.onchange = () => {
      const v = sel.value;
      if (v && v !== '__none') flags.set(lineNo, v);
      else flags.delete(lineNo);
      sel.remove();
      renderConfig();
      restoreFlagClasses();
      renderFlags();
    };
    row.appendChild(sel);
    sel.focus();
  }

  function restoreFlagClasses() {
    flags.forEach((cat, line) => {
      const row = $('config-view').querySelector(`[data-line="${line}"]`);
      if (row) {
        row.classList.add('flagged');
        row.querySelector('.flag-dot').textContent = '🚩';
      }
    });
  }

  function renderFlags() {
    restoreFlagClasses();
    const list = $('flag-list');
    $('flag-count').textContent = String(flags.size);
    $('submit-btn').disabled = flags.size === 0;

    if (flags.size === 0) {
      list.innerHTML = '<p class="text-muted">Click a line in the config to flag it.</p>';
      return;
    }
    list.innerHTML = '';
    [...flags.entries()].sort((a, b) => a[0] - b[0]).forEach(([line, cat]) => {
      const row = document.createElement('div');
      row.className = 'flex justify-between items-center';
      row.innerHTML =
        `<span>line <b>${line}</b> — ${esc(cat)}</span>
         <button class="text-xs" style="color:var(--ctp-red);">remove</button>`;
      row.querySelector('button').onclick = () => { flags.delete(line); renderConfig(); renderFlags(); };
      list.appendChild(row);
    });
  }

  $('hint-btn').onclick = async () => {
    // Hints live with the findings, so ask the grader for a no-flags peek is not
    // possible without leaking answers; instead the first missed finding's hint
    // is surfaced only after a real submit. Here we show a generic nudge by
    // grading an empty submission and reading one hint.
    const res = await fetch(`/api/exercises/${current.exercise.id}/grade`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ flags: [] })
    });
    const data = await res.json();
    const withHint = [...data.missed, ...data.absent].find((f) => f.lesson && f.lesson.hint);
    $('hint-text').textContent = withHint ? withHint.lesson.hint : 'Look closely at anything set to a permissive or "off" value.';
    $('hint-text').classList.remove('hidden');
    $('hint-btn').classList.add('hidden');
  };

  $('submit-btn').onclick = submitHunt;
  $('back-to-picker').onclick = loadPicker;
  $('reveal-back').onclick = loadPicker;
  $('retry-btn').onclick = () => startHunt(current.exercise.id);

  // ---- screen 3: reveal ------------------------------------------------------
  async function submitHunt() {
    const payload = { flags: [...flags.entries()].map(([line, category]) => ({ line, category })) };
    const res = await fetch(`/api/exercises/${current.exercise.id}/grade`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload)
    });
    renderReveal(await res.json());
  }

  function findingCard(finding, outcomeLabel, outcomeColor) {
    const sev = SEV_COLOR[finding.severity] || 'var(--ctp-overlay1)';
    const ref = finding.references || {};
    const lesson = finding.lesson || {};

    const links = [];
    if (ref.document && ref.document.url) {
      links.push(`<a href="${esc(ref.document.url)}" target="_blank" rel="noopener">${esc(ref.document.name)}${ref.document.section ? ', ' + esc(ref.document.section) : ''} ↗</a>`);
    }
    if (ref.controlCatalog) {
      links.push(`<a href="${esc(ref.controlCatalog.url)}" target="_blank" rel="noopener">800-53 controls ↗</a>`);
    }
    if (ref.vendor && ref.vendor.url) {
      links.push(`<a href="${esc(ref.vendor.url)}" target="_blank" rel="noopener">${esc(ref.vendor.title)} ↗</a>`);
    }

    const controls = (finding.nistControls || [])
      .map((c) => `<span class="pill" style="background:var(--ctp-surface0); color:var(--ctp-blue); margin-right:4px;" title="${esc(c.title || '')}">${esc(c.id || c)}</span>`)
      .join('');

    const diff = lesson.fix
      ? `<div class="diff mt-3 rounded overflow-hidden text-sm">
           <div class="diff-before"><pre>${esc(lesson.fix.before)}</pre></div>
           <div class="diff-after"><pre>${esc(lesson.fix.after)}</pre></div>
         </div>` : '';

    const attack = lesson.attack
      ? `<div class="mt-3"><span class="pill" style="background:rgba(243,139,168,.15); color:var(--ctp-red);">How it's exploited</span>
         <p class="text-sm mt-1">${esc(lesson.attack)}</p></div>` : '';

    return `
      <div class="bg-card rounded-lg p-4">
        <div class="flex items-center justify-between gap-3 flex-wrap">
          <div class="flex items-center gap-2">
            <span class="pill" style="background:${outcomeColor}22; color:${outcomeColor};">${outcomeLabel}</span>
            <span class="pill" style="background:${sev}22; color:${sev};">${esc(finding.severity)}</span>
            <h3 class="font-semibold">${esc(finding.issue)}</h3>
          </div>
          <span class="text-sm text-muted">${esc(finding.category)}${finding.location ? ' · ' + esc(finding.location) : ''}</span>
        </div>
        ${finding.impact ? `<p class="text-sm text-muted mt-2">${esc(finding.impact)}</p>` : ''}
        ${attack}
        ${diff}
        <div class="mt-3 text-sm"><span class="text-muted">Fix:</span> ${esc(finding.remediation)}</div>
        ${controls ? `<div class="mt-2">${controls}</div>` : ''}
        ${links.length ? `<div class="mt-2 text-sm space-x-3">${links.join(' ')}</div>` : ''}
      </div>`;
  }

  function section(title, subtitle, findings, label, color) {
    if (!findings.length) return '';
    return `<div>
      <h2 class="text-lg font-semibold mt-6 mb-1" style="color:${color};">${esc(title)} <span class="text-muted font-normal text-sm">(${findings.length})</span></h2>
      <p class="text-sm text-muted mb-3">${esc(subtitle)}</p>
      <div class="space-y-3">${findings.map((f) => findingCard(f, label, color)).join('')}</div>
    </div>`;
  }

  function renderReveal(data) {
    $('reveal-title').textContent = data.exercise.title;
    $('score-percent').textContent = data.score.percent + '%';
    $('score-breakdown').innerHTML =
      `<div><span style="color:var(--ctp-green);">✔ ${data.caught.length}</span> caught</div>
       <div><span style="color:var(--ctp-yellow);">◐ ${data.partial.length}</span> right line, wrong type</div>
       <div><span style="color:var(--ctp-red);">✘ ${data.missed.length}</span> missed${data.precision != null ? ` · ${data.precision}% of your flags were on target` : ''}</div>`;

    // Mark the config lines with their outcomes so the learner sees where they stood.
    const body = $('reveal-body');
    body.innerHTML =
      section('You caught these', 'Right line, right category. This is the instinct you\'re building.', data.caught, 'caught', 'var(--ctp-green)') +
      section('You were close', 'Right line, but you named the wrong category. You saw the smell — sharpen the diagnosis.', data.partial, 'right line, wrong type', 'var(--ctp-yellow)') +
      section('You missed these', 'Real issues on lines you didn\'t flag. Read how each one is exploited.', data.missed, 'missed', 'var(--ctp-red)') +
      (data.falsePositives.length
        ? `<div><h2 class="text-lg font-semibold mt-6 mb-1" style="color:var(--ctp-overlay1);">False alarms <span class="text-muted font-normal text-sm">(${data.falsePositives.length})</span></h2>
             <p class="text-sm text-muted mb-3">You flagged these lines, but they're fine. Over-flagging has a cost too.</p>
             <div class="space-y-2">${data.falsePositives.map((f) => `<div class="bg-card rounded p-3 text-sm">line <b>${f.line}</b> — you said <em>${esc(f.category)}</em></div>`).join('')}</div></div>`
        : '') +
      section('You couldn\'t have clicked these', 'The most dangerous problems are often what\'s MISSING from a config — there\'s no line to point at. Learning to notice absence is the hardest skill of all.', data.absent, 'absent', 'var(--ctp-lavender)');
    show('reveal');
  }

  loadPicker();
})();
