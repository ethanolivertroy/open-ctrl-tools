const $ = (selector, root = document) => root.querySelector(selector);

const token = new URLSearchParams(location.search).get('token') ?? '';
const CONTROL_STATUS = {
  OK: { label: 'Operating', tone: 'success' },
  NEEDS_ATTENTION: { label: 'Needs attention', tone: 'warning' },
  UNMAPPED: { label: 'Not yet mapped', tone: 'neutral' }
};

function element(tag, options = {}, children = []) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(options)) {
    if (key === 'className') node.className = value;
    else if (key === 'text') node.textContent = value;
    else if (key === 'href' || key === 'type') node.setAttribute(key, value);
    else node[key] = value;
  }
  for (const child of children) if (child) node.append(child);
  return node;
}

function formatDate(value) {
  if (!value) return '';
  const date = new Date(value.includes('T') ? value : `${value}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' }).format(date);
}

let toastTimer;
function toast(message) {
  const node = $('#toast');
  node.textContent = message;
  node.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { node.hidden = true; }, 4200);
}

async function api(path, options = {}) {
  const response = await fetch(path, options);
  const contentType = response.headers.get('content-type') ?? '';
  const body = contentType.includes('application/json') ? await response.json() : null;
  if (!response.ok) throw new Error(body?.error ?? `Request failed (${response.status})`);
  return body;
}

function renderIdentity(site) {
  document.documentElement.style.setProperty('--company-accent', site.accent);
  document.title = `${site.companyName}: shared security materials`;
  $('#header-company').textContent = site.companyName;
  $('#footer-company').textContent = site.companyName;
  $('#contact-link').href = `mailto:${site.securityEmail}`;
  const favicon = $('#favicon-link');
  if (favicon && site.faviconUrl) {
    favicon.href = site.faviconUrl;
    favicon.removeAttribute('type');
  }
  const mark = $('#header-logo');
  if (site.logoUrl) {
    mark.classList.add('kumo-brand-mark-image');
    mark.replaceChildren(element('img', { src: site.logoUrl, alt: '' }));
  }
}

function lockMark() {
  const mark = element('span', { className: 'kumo-lock' });
  mark.setAttribute('aria-hidden', 'true');
  mark.innerHTML = '<svg width="12" height="12" viewBox="0 0 12 12" fill="none"><rect x="3" y="5.5" width="6" height="5" rx="1" stroke="currentColor" stroke-width="1.2"/><path d="M4.2 5.5V4.2a1.8 1.8 0 0 1 3.6 0V5.5" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/></svg>';
  return mark;
}

function renderDocuments(documents, ndaBlocked) {
  const root = $('#access-document-list');
  root.replaceChildren();
  if (!documents.length) {
    root.append(element('div', { className: 'halted-row', text: 'No documents are published yet.' }));
    return;
  }
  for (const item of documents) {
    let action;
    let badge;
    if (item.accessible || item.visibility === 'public') {
      action = element('a', { className: 'kumo-btn kumo-btn-secondary kumo-btn-sm', text: 'Download', href: `/api/viewer/${encodeURIComponent(token)}/documents/${encodeURIComponent(item.id)}` });
      badge = element('span', { className: `kumo-badge ${item.visibility === 'public' ? 'kumo-badge-success' : 'kumo-badge-info'}`, text: item.visibility === 'public' ? 'Public' : 'Shared with you' });
    } else {
      action = element('span', { className: 'kumo-record-location' }, [lockMark(), document.createTextNode(ndaBlocked ? ' Accept the agreement first' : ' Not included')]);
      badge = element('span', { className: 'kumo-badge kumo-badge-neutral', text: 'By request' });
    }
    root.append(element('article', { className: 'kumo-record' }, [
      element('div', { className: 'kumo-record-body' }, [
        element('div', { className: 'kumo-record-topline' }, [
          element('h3', {}, [document.createTextNode(item.title), item.category ? element('span', { className: 'kumo-record-role', text: ` • ${item.category}` }) : null]),
          badge
        ]),
        element('p', { text: item.description || 'No description provided.' }),
        element('p', { className: 'kumo-record-meta', text: `v${item.version} · ${formatDate(item.publishedAt)}` })
      ]),
      element('div', { className: 'kumo-record-actions' }, [action])
    ]));
  }
}

function renderControls(categories) {
  const section = $('#access-controls-section');
  const root = $('#access-control-list');
  const shareable = categories.filter((category) => category.visibility === 'SHAREABLE' && category.controls.length);
  section.hidden = shareable.length === 0;
  root.replaceChildren();
  for (const category of shareable) {
    const showStatus = category.statusVisibilityMode !== 'SHOW_ALL_WITHOUT_STATUS';
    const list = element('div', { className: 'kumo-control-list' });
    for (const control of category.controls) {
      const status = showStatus && control.status ? CONTROL_STATUS[control.status] : null;
      list.append(element('article', { className: 'kumo-control' }, [
        element('div', { className: 'kumo-record-body' }, [
          element('div', { className: 'kumo-record-topline' }, [
            element('h3', { text: control.name }),
            status ? element('span', { className: `kumo-badge kumo-badge-${status.tone}`, text: status.label }) : null
          ]),
          control.description ? element('p', { text: control.description }) : null
        ])
      ]));
    }
    root.append(element('section', { className: 'kumo-control-group' }, [
      element('div', { className: 'kumo-section-head' }, [element('h3', { text: category.name })]),
      element('div', { className: 'kumo-panel' }, [list])
    ]));
  }
}

function renderUpdates(updates) {
  const section = $('#access-updates-section');
  const root = $('#access-update-list');
  const privateUpdates = updates.filter((update) => update.visibilityType === 'PRIVATE');
  section.hidden = privateUpdates.length === 0;
  root.replaceChildren();
  for (const item of privateUpdates) {
    const time = element('time', { text: formatDate(item.publishedAt) });
    time.dateTime = item.publishedAt;
    root.append(element('li', { className: 'kumo-update' }, [
      time,
      element('div', {}, [
        element('div', { className: 'kumo-record-topline' }, [
          element('h3', { text: item.title }),
          element('span', { className: 'kumo-badge kumo-badge-info', text: 'Viewers only' })
        ]),
        element('p', { text: item.body })
      ])
    ]));
  }
}

function render(data) {
  renderIdentity(data.site);
  const { viewer } = data;
  const ndaBlocked = viewer.ndaRequired && !viewer.ndaAcceptedAt;
  $('#access-heading').textContent = viewer.name ? `Hello ${viewer.name}, here are the materials shared with you.` : 'Materials shared with you';
  $('#access-summary').textContent = viewer.accessLevel === 'FULL_ACCESS'
    ? `${data.site.companyName} has granted you access to every published resource on this trust center, including request-only reports.`
    : `${data.site.companyName} has granted you access to selected request-only resources in addition to everything public.`;
  const meta = [viewer.email, viewer.companyName, viewer.expiresAt ? `Access expires ${formatDate(viewer.expiresAt)}` : 'Access does not expire on its own'].filter(Boolean);
  $('#access-meta').textContent = meta.join(' · ');
  $('#nda-card').hidden = !ndaBlocked;
  renderDocuments(data.documents ?? [], ndaBlocked);
  renderControls(data.controlCategories ?? []);
  renderUpdates(data.updates ?? []);
  $('#access-loading').hidden = true;
  $('#access-content').hidden = false;
}

async function load() {
  if (!token) {
    $('#access-loading').hidden = true;
    $('#access-error').hidden = false;
    return;
  }
  try {
    render(await api(`/api/viewer/${encodeURIComponent(token)}`));
  } catch (error) {
    $('#access-loading').hidden = true;
    $('#access-error').hidden = false;
    $('#access-error-message').textContent = error.message;
  }
}

$('#accept-nda').addEventListener('click', async () => {
  const status = $('#nda-status');
  status.classList.remove('error');
  status.textContent = 'Recording your acceptance…';
  try {
    await api(`/api/viewer/${encodeURIComponent(token)}/nda`, { method: 'POST' });
    toast('Thank you. Your downloads are unlocked.');
    await load();
  } catch (error) {
    status.classList.add('error');
    status.textContent = error.message;
  }
});

load();
