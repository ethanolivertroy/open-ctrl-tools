const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

const TAB_IDS = ['overview', 'resources', 'controls', 'media', 'faq', 'subprocessors', 'updates'];
const TAB_ALIASES = {
  documents: 'resources',
  video: 'media',
  assurance: 'overview',
  certifications: 'overview',
  compliance: 'overview'
};
const FILTERABLE_TABS = {
  resources: { input: '#search-resources', root: '#document-list', row: '.kumo-record' },
  controls: { input: '#search-controls', root: '#control-list', row: '.kumo-control' },
  faq: { input: '#search-faq', root: '#faq-list', row: '.kumo-faq-item' },
  subprocessors: { input: '#search-subprocessors', root: '#subprocessor-list', row: '.kumo-record' },
  updates: { input: '#search-updates', root: '#update-list', row: '.kumo-update' }
};
const UPDATE_CATEGORY_LABELS = {
  GENERAL: 'General',
  COMPLIANCE: 'Compliance',
  SECURITY: 'Security',
  PRIVACY: 'Privacy',
  INCIDENT: 'Incident',
  ROADMAP: 'Roadmap'
};
const CONTROL_STATUS = {
  OK: { label: 'Operating', tone: 'success' },
  NEEDS_ATTENTION: { label: 'Needs attention', tone: 'warning' },
  UNMAPPED: { label: 'Not yet mapped', tone: 'neutral' }
};

let siteData = null;
let hasGatedDocuments = false;

function element(tag, options = {}, children = []) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(options)) {
    if (key === 'className') node.className = value;
    else if (key === 'text') node.textContent = value;
    else if (key === 'dataset') Object.assign(node.dataset, value);
    else if (key.startsWith('aria-')) node.setAttribute(key, value);
    else if (key === 'href') node.setAttribute('href', value);
    else if (key === 'type') node.setAttribute('type', value);
    else node[key] = value;
  }
  for (const child of children) {
    if (child) node.append(child);
  }
  return node;
}

function formatDate(value, style = 'long') {
  if (!value) return 'Not specified';
  const date = new Date(value.includes('T') ? value : `${value}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat('en-US', style === 'short'
    ? { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' }
    : { month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC' }
  ).format(date);
}

async function api(path, options = {}) {
  const response = await fetch(path, options);
  const contentType = response.headers.get('content-type') ?? '';
  const body = contentType.includes('application/json') ? await response.json() : null;
  if (!response.ok) throw new Error(body?.error ?? `Request failed (${response.status})`);
  return body;
}

function empty(message) {
  return element('div', { className: 'halted-row', text: message });
}

function initialsFor(name) {
  return String(name || '')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase() || '?';
}

const VENDOR_MARKS = {
  cloudflare: '/vendor-marks/cloudflare.svg',
  'cloudflare.com': '/vendor-marks/cloudflare.svg',
  aws: '/vendor-marks/aws.svg',
  'amazon web services': '/vendor-marks/aws.svg',
  'amazonaws.com': '/vendor-marks/aws.svg',
  'aws.amazon.com': '/vendor-marks/aws.svg'
};

function vendorHost(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, '').toLowerCase();
  } catch {
    return '';
  }
}

function vendorMarkSrc(item) {
  const name = String(item.name || '').trim().toLowerCase();
  const id = String(item.id || '').trim().toLowerCase();
  const host = vendorHost(item.url);
  for (const key of [id, name, host]) {
    if (VENDOR_MARKS[key]) return VENDOR_MARKS[key];
  }
  if (host.endsWith('amazonaws.com') || host.endsWith('aws.amazon.com')) return VENDOR_MARKS.aws;
  if (host.endsWith('cloudflare.com')) return VENDOR_MARKS.cloudflare;
  return null;
}

function recordMark(name, src) {
  const mark = element('div', { className: 'kumo-mark', text: initialsFor(name), 'aria-hidden': 'true' });
  if (!src) return mark;
  const img = document.createElement('img');
  img.alt = '';
  img.decoding = 'async';
  img.referrerPolicy = 'no-referrer';
  img.addEventListener('load', () => {
    mark.replaceChildren(img);
    mark.classList.add('kumo-mark-logo');
  });
  img.src = src;
  return mark;
}

function searchBlob(...parts) {
  return parts.filter(Boolean).join(' ').toLowerCase();
}

function visibleTabs() {
  return $$('.kumo-tab').filter((tab) => !tab.hidden);
}

function getRequestedTab() {
  const raw = (location.hash || '#overview').replace('#', '').toLowerCase();
  return TAB_ALIASES[raw] || (TAB_IDS.includes(raw) ? raw : 'overview');
}

function revealTab(tab) {
  const rail = tab.closest('.kumo-tabs');
  if (!rail) return;
  const left = tab.offsetLeft;
  const right = left + tab.offsetWidth;
  const viewLeft = rail.scrollLeft;
  const viewRight = viewLeft + rail.clientWidth;
  if (left < viewLeft) rail.scrollLeft = left;
  else if (right > viewRight) rail.scrollLeft = right - rail.clientWidth;
}

function setActiveTab(tabId, { updateHash = true } = {}) {
  const requested = $(`#tab-${tabId}`);
  const resolved = requested && !requested.hidden && TAB_IDS.includes(tabId) ? tabId : 'overview';

  for (const id of TAB_IDS) {
    const tab = $(`#tab-${id}`);
    const panel = $(`#panel-${id}`);
    if (!tab || !panel) continue;
    const selected = id === resolved;
    tab.setAttribute('aria-selected', String(selected));
    tab.tabIndex = selected ? 0 : -1;
    panel.hidden = !selected;
    if (selected) revealTab(tab);
  }

  if (updateHash) {
    const next = `#${resolved}`;
    if (location.hash !== next) history.replaceState(null, '', next);
  }
}

function bindTabs() {
  $$('.kumo-tab').forEach((tab) => {
    tab.addEventListener('click', () => setActiveTab(tab.dataset.tab));
    tab.addEventListener('keydown', (event) => {
      const tabs = visibleTabs();
      const current = tabs.indexOf(tab);
      if (current < 0) return;
      if (event.key === 'ArrowRight' || event.key === 'ArrowLeft') {
        event.preventDefault();
        const delta = event.key === 'ArrowRight' ? 1 : -1;
        const next = tabs[(current + delta + tabs.length) % tabs.length];
        next.focus();
        setActiveTab(next.dataset.tab);
      }
      if (event.key === 'Home') {
        event.preventDefault();
        tabs[0].focus();
        setActiveTab(tabs[0].dataset.tab);
      }
      if (event.key === 'End') {
        event.preventDefault();
        tabs.at(-1).focus();
        setActiveTab(tabs.at(-1).dataset.tab);
      }
    });
  });

  $$('[data-open-tab]').forEach((button) => {
    button.addEventListener('click', () => setActiveTab(button.dataset.openTab));
  });

  const brand = $('.kumo-brand');
  if (brand) {
    brand.addEventListener('click', (event) => {
      if (brand.getAttribute('href') === '#overview') {
        event.preventDefault();
        setActiveTab('overview');
      }
    });
  }

  window.addEventListener('hashchange', () => setActiveTab(getRequestedTab(), { updateHash: false }));
  window.addEventListener('resize', () => {
    const selected = $('.kumo-tab[aria-selected="true"]');
    if (selected) revealTab(selected);
  });
}

function bindSearch() {
  for (const tabId of Object.keys(FILTERABLE_TABS)) {
    const input = $(FILTERABLE_TABS[tabId].input);
    if (!input) continue;
    input.addEventListener('input', () => applySearch(tabId));
  }
}

function applySearch(tabId) {
  const config = FILTERABLE_TABS[tabId];
  if (!config) return;
  const root = $(config.root);
  if (!root) return;
  const query = ($(config.input)?.value || '').trim().toLowerCase();
  const rows = $$(config.row, root);
  let shown = 0;
  for (const row of rows) {
    const haystack = (row.dataset.search || row.textContent || '').toLowerCase();
    const match = !query || haystack.includes(query);
    row.hidden = !match;
    if (match) shown += 1;
  }
  for (const group of $$('[data-group]', root)) {
    group.hidden = Boolean(query) && !$$(config.row, group).some((row) => !row.hidden);
  }
  root.querySelector('.kumo-filter-empty')?.remove();
  if (query && shown === 0 && rows.length) {
    root.append(element(root.tagName === 'OL' ? 'li' : 'div', { className: 'kumo-filter-empty halted-row', text: 'No matching results.' }));
  }
}

let toastTimer;
function toast(message) {
  const node = $('#toast');
  node.textContent = message;
  node.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { node.hidden = true; }, 4200);
}

const DEFAULT_MARK = '<svg width="12" height="12" viewBox="0 0 16 16" fill="none"><path d="M2 10.5 8 4l6 6.5" stroke="currentColor" stroke-width="1.75" stroke-linejoin="round"/></svg>';

function renderBrandMark(target, logoUrl) {
  if (!target) return;
  target.replaceChildren();
  if (logoUrl) {
    target.classList.add('kumo-brand-mark-image');
    const image = document.createElement('img');
    image.src = logoUrl;
    image.alt = '';
    target.append(image);
    return;
  }
  target.classList.remove('kumo-brand-mark-image');
  target.innerHTML = DEFAULT_MARK;
}

function renderBanner(site) {
  const banner = $('#site-banner');
  if (!banner) return;
  const setting = site.bannerSetting?.setting || 'MINIMAL';
  banner.className = 'kumo-banner kumo-shell';
  banner.style.removeProperty('--banner-start');
  banner.style.removeProperty('--banner-end');
  banner.style.removeProperty('--banner-image');
  if (setting === 'GRADIENT') {
    banner.hidden = false;
    banner.classList.add('kumo-banner-gradient');
    banner.style.setProperty('--banner-start', site.bannerSetting.startColor || site.accent);
    banner.style.setProperty('--banner-end', site.bannerSetting.endColor || site.customTheme?.secondary || site.accent);
  } else if (setting === 'CUSTOM_IMAGE' && site.bannerSetting.imageUrl) {
    banner.hidden = false;
    banner.classList.add('kumo-banner-image');
    banner.style.setProperty('--banner-image', `url("${site.bannerSetting.imageUrl}")`);
  } else {
    banner.hidden = true;
  }
}

function renderSiteIdentity(site) {
  document.documentElement.style.setProperty('--accent', site.accent);
  document.documentElement.style.setProperty('--company-accent', site.accent);
  document.documentElement.style.setProperty('--company-secondary', site.customTheme?.secondary || site.accent);
  document.title = site.title || `${site.companyName} Trust Center`;
  renderBrandMark($('#header-logo'), site.logoUrl);
  $('#header-company').textContent = site.companyName;
  $('#header-title').textContent = site.title && site.title !== `${site.companyName} Trust Center` ? site.title : 'Trust center';
  $('#footer-company').textContent = site.companyName;
  const favicon = $('#favicon-link');
  if (favicon && site.faviconUrl) {
    favicon.href = site.faviconUrl;
    favicon.removeAttribute('type');
  }
  for (const link of [$('#contact-link')].filter(Boolean)) {
    link.href = `mailto:${site.securityEmail}`;
  }
  renderBanner(site);
}

function renderSite(data) {
  const { site } = data;
  renderSiteIdentity(site);
  $('#hero-heading').textContent = site.headline;
  $('#hero-summary').textContent = site.summary;
  $('#hero-location').textContent = site.location;
  $('#last-reviewed').textContent = formatDate(site.updatedAt);
  const contact = $('#hero-contact');
  contact.textContent = site.securityEmail;
  contact.href = `mailto:${site.securityEmail}`;
  const description = document.querySelector('meta[name="description"]');
  if (description) description.content = `${site.companyName}: ${site.summary}`;
  for (const [selector, value] of [
    ['meta[property="og:title"]', `${site.companyName} Trust Center`],
    ['meta[property="og:site_name"]', `${site.companyName} Trust Center`],
    ['meta[property="og:description"]', `${site.companyName}: ${site.summary}`]
  ]) {
    const tag = document.querySelector(selector);
    if (tag) tag.content = value;
  }
  renderFooterLinks(site);
}

// Turnstile is only loaded when the Worker reports a site key; without one the
// slots stay hidden and the forms submit exactly as before.
const TURNSTILE_SCRIPT = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
const turnstileWidgets = { subscribe: null, request: null };
let turnstileSiteKey = null;

function loadTurnstile() {
  if (window.turnstile) return Promise.resolve(window.turnstile);
  return new Promise((resolve, reject) => {
    const existing = document.querySelector(`script[src="${TURNSTILE_SCRIPT}"]`);
    const script = existing ?? element('script', { src: TURNSTILE_SCRIPT, async: true, defer: true });
    script.addEventListener('load', () => resolve(window.turnstile));
    script.addEventListener('error', () => reject(new Error('Turnstile failed to load')));
    if (!existing) document.head.append(script);
  });
}

async function setupTurnstile(protection) {
  turnstileSiteKey = protection?.turnstileSiteKey || null;
  if (!turnstileSiteKey) return;
  try {
    const turnstile = await loadTurnstile();
    for (const [name, slotId] of [['subscribe', '#subscribe-turnstile'], ['request', '#request-turnstile']]) {
      const slot = $(slotId);
      if (!slot || turnstileWidgets[name] !== null) continue;
      slot.hidden = false;
      turnstileWidgets[name] = turnstile.render(slot, { sitekey: turnstileSiteKey, size: 'flexible', appearance: 'always' });
    }
  } catch (error) {
    console.error(error);
  }
}

function turnstileToken(name) {
  if (!turnstileSiteKey) return undefined;
  const id = turnstileWidgets[name];
  return id === null || !window.turnstile ? '' : window.turnstile.getResponse(id) || '';
}

function resetTurnstile(name) {
  const id = turnstileWidgets[name];
  if (id !== null && window.turnstile) window.turnstile.reset(id);
}

function renderFooterLinks(site) {
  const root = $('#footer-links');
  if (!root) return;
  root.replaceChildren();
  const links = [];
  if (site.privacyPolicyUrl) links.push(element('a', { text: 'Privacy policy', href: site.privacyPolicyUrl, target: '_blank', rel: 'noopener noreferrer' }));
  root.hidden = links.length === 0;
  links.forEach((link, index) => {
    if (index) root.append(element('span', { text: ' · ', 'aria-hidden': 'true' }));
    root.append(link);
  });
}

function lockMark() {
  const mark = element('span', { className: 'kumo-lock', 'aria-hidden': 'true' });
  mark.innerHTML = '<svg width="12" height="12" viewBox="0 0 12 12" fill="none"><rect x="3" y="5.5" width="6" height="5" rx="1" stroke="currentColor" stroke-width="1.2"/><path d="M4.2 5.5V4.2a1.8 1.8 0 0 1 3.6 0V5.5" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/></svg>';
  return mark;
}

function renderCertifications(items) {
  const root = $('#certification-list');
  root.replaceChildren();
  if (!items.length) {
    root.append(empty('No compliance signals are published yet.'));
    return;
  }
  for (const item of items) {
    const badge = item.badgeUrl
      ? element('img', { className: 'kumo-compliance-badge', src: item.badgeUrl, alt: '', loading: 'lazy' })
      : null;
    root.append(element('article', { className: 'kumo-compliance-item' }, [
      badge,
      element('h3', { text: item.name, title: item.description || item.name }),
      item.status ? element('span', { className: 'kumo-compliance-status', text: item.status }) : null
    ]));
  }
}

function groupDocuments(items, categories) {
  const groups = new Map();
  const order = new Map(categories.map((category, index) => [category.id, index]));
  for (const item of items) {
    const key = item.categoryId && order.has(item.categoryId) ? item.categoryId : `label:${item.category || 'Resources'}`;
    if (!groups.has(key)) groups.set(key, { name: item.category || 'Resources', items: [] });
    groups.get(key).items.push(item);
  }
  return [...groups.entries()]
    .sort(([a], [b]) => (order.get(a) ?? 9999) - (order.get(b) ?? 9999))
    .map(([, group]) => group);
}

function renderOverviewDocuments(items, categories) {
  const root = $('#overview-document-list');
  if (!root) return;
  root.replaceChildren();
  if (!items.length) {
    root.append(empty('No documents are published yet.'));
    return;
  }
  for (const group of groupDocuments(items, categories)) {
    const node = element('div', { className: 'kumo-resource-group' }, [element('h3', { text: group.name })]);
    for (const item of group.items) {
      const row = item.visibility === 'public'
        ? element('a', { className: 'kumo-resource-link', text: item.title, href: `/api/documents/${encodeURIComponent(item.id)}` })
        : element('button', { className: 'kumo-resource-link', type: 'button', text: item.title });
      if (item.visibility === 'request') {
        row.append(lockMark());
        row.addEventListener('click', () => openRequest(item));
      }
      node.append(row);
    }
    root.append(node);
  }
}

function renderOverviewFaqs(items) {
  const root = $('#overview-faq-list');
  if (!root) return;
  root.replaceChildren();
  if (!items.length) {
    root.append(empty('No frequently asked questions are published yet.'));
    return;
  }
  for (const item of items.slice(0, 4)) {
    root.append(element('details', { className: 'kumo-faq-item' }, [
      element('summary', { text: item.question }),
      element('p', { className: 'kumo-faq-answer', text: item.answer })
    ]));
  }
}

function renderOverviewSubprocessors(items) {
  const root = $('#overview-subprocessor-list');
  if (!root) return;
  root.replaceChildren();
  if (!items.length) {
    root.append(empty('No subprocessors are currently published.'));
    return;
  }
  for (const item of items.slice(0, 4)) {
    const nameNode = item.url
      ? element('a', { text: item.name, href: item.url, target: '_blank', rel: 'noopener noreferrer' })
      : document.createTextNode(item.name);
    root.append(element('article', { className: 'kumo-record' }, [
      recordMark(item.name, vendorMarkSrc(item)),
      element('div', { className: 'kumo-record-body' }, [
        element('div', { className: 'kumo-record-topline' }, [
          element('h3', {}, [
            nameNode,
            item.purpose ? element('span', { className: 'kumo-record-role', text: ` • ${item.purpose}` }) : null
          ]),
          element('span', { className: 'kumo-record-location', text: item.location || '' })
        ])
      ])
    ]));
  }
}

function updateCategoryBadge(item) {
  const label = UPDATE_CATEGORY_LABELS[item.category] || null;
  if (!label) return null;
  const tone = item.category === 'INCIDENT' ? 'warning' : item.category === 'ROADMAP' ? 'info' : 'neutral';
  return element('span', { className: `kumo-badge kumo-badge-${tone}`, text: label });
}

function renderOverviewUpdates(items) {
  const root = $('#overview-update-list');
  if (!root) return;
  root.replaceChildren();
  if (!items.length) {
    root.append(element('li', { className: 'halted-row', text: 'No trust center changes are published yet.' }));
    return;
  }
  for (const item of items.slice(0, 3)) {
    const time = element('time', { text: formatDate(item.publishedAt, 'short') });
    time.dateTime = item.publishedAt;
    root.append(element('li', { className: 'kumo-update' }, [
      time,
      element('div', {}, [
        element('h3', { text: item.title }),
        element('p', { text: item.body })
      ])
    ]));
  }
}

function renderOverviewControls(categories) {
  const wrapper = $('#overview-controls');
  const root = $('#overview-control-list');
  if (!wrapper || !root) return;
  const total = categories.reduce((sum, category) => sum + category.controls.length, 0);
  wrapper.hidden = total === 0;
  root.replaceChildren();
  for (const category of categories.slice(0, 5)) {
    root.append(element('div', { className: 'kumo-control-summary-row' }, [
      element('span', { text: category.name }),
      element('span', { className: 'kumo-record-location', text: `${category.controls.length} control${category.controls.length === 1 ? '' : 's'}` })
    ]));
  }
}

function renderControls(categories) {
  const tab = $('#tab-controls');
  const root = $('#control-list');
  if (!root) return;
  root.replaceChildren();
  const total = categories.reduce((sum, category) => sum + category.controls.length, 0);
  if (tab) tab.hidden = total === 0;
  if (!total) return;
  for (const category of categories) {
    if (!category.controls.length) continue;
    const showStatus = category.statusVisibilityMode !== 'SHOW_ALL_WITHOUT_STATUS';
    const list = element('div', { className: 'kumo-control-list' });
    for (const control of category.controls) {
      const status = showStatus && control.status ? CONTROL_STATUS[control.status] : null;
      const tags = Object.values(control.tags || {}).flat();
      list.append(element('article', {
        className: 'kumo-control',
        dataset: { search: searchBlob(control.name, control.description, category.name, ...tags) }
      }, [
        element('div', { className: 'kumo-record-body' }, [
          element('div', { className: 'kumo-record-topline' }, [
            element('h3', { text: control.name }),
            status ? element('span', { className: `kumo-badge kumo-badge-${status.tone}`, text: status.label }) : null
          ]),
          control.description ? element('p', { text: control.description }) : null,
          tags.length ? element('p', { className: 'kumo-record-meta', text: tags.join(' · ') }) : null
        ])
      ]));
    }
    root.append(element('section', { className: 'kumo-control-group', dataset: { group: category.id } }, [
      element('div', { className: 'kumo-section-head' }, [
        element('h2', { text: category.name }),
        category.visibility === 'SHAREABLE' ? element('span', { className: 'kumo-badge kumo-badge-info', text: 'Shared with you' }) : null
      ]),
      element('div', { className: 'kumo-panel' }, [list])
    ]));
  }
  applySearch('controls');
}

function renderDataCollected(data) {
  const wrapper = $('#overview-data-collected');
  const root = $('#data-collected-list');
  if (!wrapper || !root) return;
  const items = data?.items ?? [];
  wrapper.hidden = items.length === 0;
  root.replaceChildren();
  if (!items.length) return;
  $('#data-collected-heading').textContent = data.heading || 'Data collected';
  for (const item of items) {
    const collected = item.status === 'COLLECTED';
    root.append(element('div', { className: 'kumo-data-row' }, [
      element('span', { text: item.dataCollected }),
      element('span', { className: `kumo-badge kumo-badge-${collected ? 'neutral' : 'success'}`, text: collected ? 'Collected' : 'Not collected' })
    ]));
  }
}

function openRequest(documentRecord) {
  $('#request-document-id').value = documentRecord ? documentRecord.id : '';
  $('#request-access-level').value = documentRecord ? 'PARTIAL_ACCESS' : 'FULL_ACCESS';
  $('#request-document-name').textContent = documentRecord
    ? `${documentRecord.title} is reviewed before sharing. Tell the security team who needs it and why.`
    : 'Tell the security team who needs access to the request-only materials and why.';
  $('#access-status').textContent = '';
  $('#request-dialog').showModal();
  setTimeout(() => $('#access-request-form input[name="name"]')?.focus(), 0);
}

function renderDocuments(items) {
  const root = $('#document-list');
  root.replaceChildren();
  hasGatedDocuments = items.some((item) => item.visibility === 'request');
  if (!items.length) {
    root.append(empty('No documents are published yet.'));
    return;
  }
  for (const item of items) {
    const visibilityClass = item.visibility === 'public' ? 'kumo-badge kumo-badge-success' : 'kumo-badge kumo-badge-warning';
    const action = item.visibility === 'public'
      ? element('a', { className: 'kumo-btn kumo-btn-secondary kumo-btn-sm', text: 'Open', href: `/api/documents/${encodeURIComponent(item.id)}` })
      : element('button', { className: 'kumo-btn kumo-btn-secondary kumo-btn-sm', text: 'Request access', type: 'button' });
    if (item.visibility === 'request') action.addEventListener('click', () => openRequest(item));
    root.append(element('article', {
      className: 'kumo-record',
      dataset: { search: searchBlob(item.title, item.description, item.category, item.visibility) }
    }, [
      element('div', { className: 'kumo-record-body' }, [
        element('div', { className: 'kumo-record-topline' }, [
          element('h3', {}, [
            document.createTextNode(item.title),
            item.category ? element('span', { className: 'kumo-record-role', text: ` • ${item.category}` }) : null
          ]),
          element('span', { className: visibilityClass, text: item.visibility === 'public' ? 'Public' : 'By request' })
        ]),
        element('p', { text: item.description || 'No description provided.' }),
        element('p', { className: 'kumo-record-meta', text: `v${item.version} · ${formatDate(item.publishedAt, 'short')}` })
      ]),
      element('div', { className: 'kumo-record-actions' }, [action])
    ]));
  }
  applySearch('resources');
}

function videoEmbedUrl(value) {
  if (!value) return null;
  try {
    const url = new URL(value);
    const hostname = url.hostname.toLowerCase();
    if (hostname === 'youtu.be') {
      const id = url.pathname.split('/').filter(Boolean)[0] ?? '';
      return /^[a-zA-Z0-9_-]{11}$/.test(id) ? `https://www.youtube-nocookie.com/embed/${id}` : null;
    }
    if (['youtube.com', 'www.youtube.com', 'm.youtube.com'].includes(hostname)) {
      const id = url.searchParams.get('v') ?? url.pathname.match(/^\/embed\/([a-zA-Z0-9_-]{11})/)?.[1] ?? '';
      return /^[a-zA-Z0-9_-]{11}$/.test(id) ? `https://www.youtube-nocookie.com/embed/${id}` : null;
    }
    if (hostname === 'vimeo.com' || hostname === 'www.vimeo.com') {
      const id = url.pathname.match(/^\/(\d+)(?:\/|$)/)?.[1];
      return id ? `https://player.vimeo.com/video/${id}` : null;
    }
  } catch {
    return null;
  }
  return null;
}

function renderVideos(videos, site) {
  const tab = $('#tab-media');
  const overviewMedia = $('#overview-media');
  const root = $('#video-list');
  if (!videos.length) {
    if (tab) tab.hidden = true;
    if (overviewMedia) overviewMedia.hidden = true;
    return;
  }
  if (tab) tab.hidden = false;
  if (overviewMedia) overviewMedia.hidden = false;
  $('#overview-media-label').textContent = videos.length === 1 ? videos[0].title : `${videos.length} videos about the security program`;
  root.replaceChildren();
  for (const video of videos) {
    const frame = element('div', { className: 'video-frame' });
    const embedUrl = videoEmbedUrl(video.url);
    if (embedUrl) {
      const iframe = document.createElement('iframe');
      iframe.src = embedUrl;
      iframe.title = `${site.companyName}: ${video.title}`;
      iframe.loading = 'lazy';
      iframe.referrerPolicy = 'no-referrer';
      iframe.setAttribute('sandbox', 'allow-scripts allow-same-origin allow-presentation');
      iframe.setAttribute('allow', 'fullscreen; picture-in-picture');
      iframe.setAttribute('allowfullscreen', '');
      frame.append(iframe);
    } else {
      frame.classList.add('video-link-panel');
      const watch = element('a', { className: 'kumo-btn kumo-btn-primary', text: 'Watch video', href: video.url, target: '_blank', rel: 'noreferrer' });
      frame.append(element('p', { text: 'This video is hosted externally.' }), watch);
    }
    root.append(element('article', { className: 'kumo-video' }, [
      element('div', { className: 'kumo-section-head' }, [
        element('h2', { text: video.title })
      ]),
      video.description ? element('p', { className: 'kumo-lede', text: video.description }) : null,
      element('div', { className: 'kumo-panel' }, [frame])
    ]));
  }
}

function renderFaqs(items, categories) {
  const root = $('#faq-list');
  root.replaceChildren();
  if (!items.length) {
    root.append(element('div', { className: 'kumo-panel' }, [empty('No frequently asked questions are published yet.')]));
    return;
  }
  const groups = new Map();
  const order = new Map(categories.map((category, index) => [category.id, index]));
  for (const item of items) {
    const key = item.categoryId && order.has(item.categoryId) ? item.categoryId : 'uncategorized';
    if (!groups.has(key)) groups.set(key, { name: item.category || (categories.length ? 'General' : ''), items: [] });
    groups.get(key).items.push(item);
  }
  const ordered = [...groups.entries()].sort(([a], [b]) => (order.get(a) ?? 9999) - (order.get(b) ?? 9999));
  let first = true;
  for (const [key, group] of ordered) {
    const list = element('div', { className: 'kumo-faq' });
    for (const item of group.items) {
      const details = element('details', {
        className: 'kumo-faq-item',
        dataset: { search: searchBlob(item.question, item.answer, group.name) }
      }, [
        element('summary', { text: item.question }),
        element('p', { className: 'kumo-faq-answer', text: item.answer })
      ]);
      if (first) details.open = true;
      first = false;
      list.append(details);
    }
    root.append(element('section', { className: 'kumo-faq-group', dataset: { group: key } }, [
      group.name ? element('div', { className: 'kumo-section-head' }, [element('h2', { text: group.name })]) : null,
      element('div', { className: 'kumo-panel' }, [list])
    ]));
  }
  applySearch('faq');
}

function renderSubprocessors(items) {
  const root = $('#subprocessor-list');
  root.replaceChildren();
  if (!items.length) {
    root.append(empty('No subprocessors are currently published.'));
    return;
  }
  for (const item of items) {
    const nameNode = item.url
      ? element('a', { text: item.name, href: item.url, target: '_blank', rel: 'noopener noreferrer' })
      : document.createTextNode(item.name);
    const description = [];
    const summary = [item.purpose, item.description].filter(Boolean).join(' ');
    if (summary) description.push(document.createTextNode(summary));
    if (item.url) {
      if (description.length) description.push(document.createTextNode(' '));
      description.push(element('a', { text: 'Vendor site', href: item.url, target: '_blank', rel: 'noopener noreferrer' }));
    }
    if (!description.length) description.push(document.createTextNode('Used in the published trust program.'));
    root.append(element('article', {
      className: 'kumo-record',
      dataset: { search: searchBlob(item.name, item.purpose, item.description, item.location) }
    }, [
      recordMark(item.name, vendorMarkSrc(item)),
      element('div', { className: 'kumo-record-body' }, [
        element('div', { className: 'kumo-record-topline' }, [
          element('h3', {}, [nameNode]),
          element('span', { className: 'kumo-record-location', text: item.location || 'Location unpublished' })
        ]),
        element('p', {}, description)
      ])
    ]));
  }
  applySearch('subprocessors');
}

function renderUpdates(items) {
  const root = $('#update-list');
  root.replaceChildren();
  if (!items.length) {
    root.append(element('li', { className: 'halted-row', text: 'No trust center changes are published yet.' }));
    return;
  }
  for (const item of items) {
    const time = element('time', { text: formatDate(item.publishedAt, 'short') });
    time.dateTime = item.publishedAt;
    root.append(element('li', {
      className: 'kumo-update',
      dataset: { search: searchBlob(item.title, item.body, UPDATE_CATEGORY_LABELS[item.category]) }
    }, [
      time,
      element('div', {}, [
        element('div', { className: 'kumo-record-topline' }, [
          element('h3', { text: item.title }),
          updateCategoryBadge(item)
        ]),
        element('p', { text: item.body })
      ])
    ]));
  }
  applySearch('updates');
}

function renderPrivate(data) {
  renderSiteIdentity(data.site);
  $('#public-content').hidden = true;
  $('#private-state').hidden = false;
  $('#header-subscribe').hidden = true;
  $('#private-heading').textContent = `${data.site.companyName} shares security materials with approved viewers.`;
  $('#private-request').addEventListener('click', () => openRequest(null));
}

async function loadTrustCenter() {
  try {
    const data = await api('/api/site');
    siteData = data;
    setupTurnstile(data.protection);
    if (data.private) {
      renderPrivate(data);
      return;
    }
    renderSite(data);
    renderCertifications(data.certifications ?? []);
    renderDocuments(data.documents ?? []);
    renderOverviewDocuments(data.documents ?? [], data.resourceCategories ?? []);
    renderControls(data.controlCategories ?? []);
    renderOverviewControls(data.controlCategories ?? []);
    renderDataCollected(data.dataCollected);
    renderVideos(data.videos ?? [], data.site);
    renderFaqs(data.faqs ?? [], data.faqCategories ?? []);
    renderOverviewFaqs(data.faqs ?? []);
    renderSubprocessors(data.subprocessors ?? []);
    renderOverviewSubprocessors(data.subprocessors ?? []);
    renderUpdates(data.updates ?? []);
    renderOverviewUpdates(data.updates ?? []);
    $('#open-chat').hidden = false;
    setActiveTab(getRequestedTab());
  } catch (error) {
    console.error(error);
    toast('The trust center could not be loaded. Please try again.');
    $('#certification-list').replaceChildren(empty('Trust data is temporarily unavailable.'));
    $('#document-list').replaceChildren(empty('Trust data is temporarily unavailable.'));
    $('#subprocessor-list').replaceChildren(empty('Trust data is temporarily unavailable.'));
  }
}

$('#subscribe-form').addEventListener('submit', async (event) => {
  event.preventDefault();
  const form = event.currentTarget;
  const status = $('#subscribe-status');
  const button = form.querySelector('button');
  status.classList.remove('error');
  status.textContent = 'Subscribing…';
  button.disabled = true;
  try {
    const result = await api('/api/subscribe', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: new FormData(form).get('email'), turnstileToken: turnstileToken('subscribe') })
    });
    status.textContent = result.message;
    form.reset();
  } catch (error) {
    status.classList.add('error');
    status.textContent = error.message;
  } finally {
    resetTurnstile('subscribe');
    button.disabled = false;
  }
});

$('#access-request-form').addEventListener('submit', async (event) => {
  event.preventDefault();
  const form = event.currentTarget;
  const status = $('#access-status');
  const button = form.querySelector('button');
  status.classList.remove('error');
  status.textContent = 'Sending request…';
  button.disabled = true;
  const values = Object.fromEntries(new FormData(form).entries());
  if (!values.documentId) delete values.documentId;
  values.turnstileToken = turnstileToken('request');
  try {
    const result = await api('/api/access-requests', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(values)
    });
    form.reset();
    $('#request-dialog').close();
    toast(result.message);
  } catch (error) {
    status.classList.add('error');
    status.textContent = error.message;
  } finally {
    resetTurnstile('request');
    button.disabled = false;
  }
});

let conversationId = null;
function appendChat(role, text, references = []) {
  const log = $('#chat-log');
  const bubble = element('div', { className: `kumo-chat-message kumo-chat-${role}` }, [
    element('p', { text })
  ]);
  if (references.length) {
    bubble.append(element('p', { className: 'kumo-record-meta', text: `Based on ${references.length} published item${references.length === 1 ? '' : 's'}.` }));
  }
  log.append(bubble);
  log.scrollTop = log.scrollHeight;
}

$('#open-chat').addEventListener('click', () => {
  const dialog = $('#chat-dialog');
  if (!$('#chat-log').children.length) {
    appendChat('assistant', `Ask about ${siteData?.site.companyName ?? 'our'} security program. I only answer from what is published here.`);
  }
  dialog.showModal();
  setTimeout(() => $('#chat-input').focus(), 0);
});

$('#chat-form').addEventListener('submit', async (event) => {
  event.preventDefault();
  const form = event.currentTarget;
  const input = $('#chat-input');
  const status = $('#chat-status');
  const button = form.querySelector('button');
  const message = input.value.trim();
  if (!message) return;
  appendChat('user', message);
  input.value = '';
  status.classList.remove('error');
  status.textContent = 'Thinking…';
  button.disabled = true;
  try {
    const result = await api('/api/chat', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ message, conversationId })
    });
    conversationId = result.conversationId;
    appendChat('assistant', result.reply, result.references || []);
    status.textContent = '';
  } catch (error) {
    status.classList.add('error');
    status.textContent = error.message;
  } finally {
    button.disabled = false;
    input.focus();
  }
});

bindTabs();
bindSearch();
setActiveTab(getRequestedTab(), { updateHash: false });
loadTrustCenter();
