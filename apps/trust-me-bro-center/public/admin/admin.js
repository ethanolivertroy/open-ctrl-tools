const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

const TOKEN_KEY = 'trust-me-bro-center-admin-token';
let token = sessionStorage.getItem(TOKEN_KEY) ?? '';
let state = null;
let toastTimer;
let formHandler = null;

const FRAMEWORK_STANDARDS = ['aiact', 'aiuc1', 'aue8', 'awsFTR', 'bsic5', 'ccpa', 'cisv8', 'cjis', 'cmmc2', 'cps234', 'cri', 'dora', 'fedRAMPr5', 'fedramp', 'fedramp20x', 'fedramp20x_2026', 'gdpr', 'hipaa', 'hitruste1', 'iso9001', 'iso27001', 'iso27001_2022', 'iso27017', 'iso27018', 'iso27701', 'iso27701_2025', 'iso42001', 'msftSSPA', 'mvsp', 'nis2d', 'nist53', 'nist171', 'nist171r3', 'nistAiRmf', 'nistCSF', 'nistcsf2', 'ofdss', 'pciDss4', 'pciSaqA', 'pciSaqAEP', 'pciSaqDMerchant', 'pciSaqDSP', 'soc2', 'soxITGC', 't23nycrr500', 'tisax', 'tisax2027', 'iso22301', 'trust', 'ukCyberEssentials', 'ukCyberEssentials33', 'usDataPrivacy', 'fedrampKSI'];
const UPDATE_CATEGORIES = ['GENERAL', 'COMPLIANCE', 'SECURITY', 'PRIVACY', 'INCIDENT', 'ROADMAP'];
const CONTROL_STATUS_LABELS = { OK: 'Operating', NEEDS_ATTENTION: 'Needs attention', UNMAPPED: 'Not yet mapped' };
const VISIBILITY_MODES = [
  ['', 'Follow profile setting'],
  ['SHOW_ALL_WITH_STATUS', 'Show all controls with status'],
  ['SHOW_ALL_WITHOUT_STATUS', 'Show all controls without status'],
  ['SHOW_OK_AND_UNMAPPED', 'Show operating and unmapped'],
  ['SHOW_OK_ONLY', 'Show operating only']
];

const options = (values) => values.map((value) => (Array.isArray(value) ? { value: value[0], label: value[1] } : { value, label: value }));
const categoryOptions = (kind) => () => [{ value: '', label: 'Uncategorized' }, ...(state?.[kind] ?? []).map((category) => ({ value: category.id, label: category.name }))];
const gatedDocumentOptions = () => (state?.documents ?? []).filter((document) => document.visibility === 'request').map((document) => ({ value: document.id, label: `${document.title}${document.lifecycle === 'published' ? '' : ` (${document.lifecycle})`}` }));
const controlCategoryOptions = () => (state?.controlCategories ?? []).map((category) => ({ value: category.id, label: category.name }));

const resourceConfig = {
  certifications: {
    singular: 'compliance framework',
    title: (item) => item.name,
    description: (item) => item.description,
    meta: (item) => [item.status, item.standard ? `Standard ${item.standard}` : 'No standard', item.badgeObjectKey ? 'Badge uploaded' : 'No badge'],
    fields: [
      { name: 'name', label: 'Name', type: 'text', required: true, max: 120 },
      { name: 'status', label: 'Status', type: 'text', required: true, max: 80 },
      { name: 'standard', label: 'Compliance standard', type: 'select', options: () => [{ value: '', label: 'None' }, ...options(FRAMEWORK_STANDARDS)] },
      { name: 'description', label: 'Description', type: 'textarea', max: 500 },
      { name: 'sortOrder', label: 'Sort order', type: 'number' }
    ]
  },
  documents: {
    singular: 'resource',
    title: (item) => item.title,
    description: (item) => item.description,
    meta: (item) => [categoryName('resourceCategories', item.categoryId) || item.category || 'Uncategorized', `v${item.version}`, item.reviewAt ? `Review ${formatDate(item.reviewAt)}` : 'No review date', item.sourceType === 'r2' ? item.fileName || 'Uploaded file' : 'External link'],
    fields: [
      { name: 'title', label: 'Title', type: 'text', required: true, max: 160 },
      { name: 'categoryId', label: 'Category', type: 'select', options: categoryOptions('resourceCategories') },
      { name: 'description', label: 'Description', type: 'textarea', max: 800 },
      { name: 'visibility', label: 'Access', type: 'select', options: () => [{ value: 'public', label: 'Public' }, { value: 'request', label: 'By request' }] },
      { name: 'url', label: 'Public HTTPS URL or /public-documents/ path', type: 'text', max: 500, externalOnly: true },
      { name: 'version', label: 'Version', type: 'text', required: true, max: 40 },
      { name: 'publishedAt', label: 'Published date', type: 'date' },
      { name: 'reviewAt', label: 'Next review date', type: 'date' }
    ],
    defaults: { visibility: 'public', version: '1.0', publishedAt: new Date().toISOString().slice(0, 10) }
  },
  faqs: {
    singular: 'FAQ',
    title: (item) => item.question,
    description: (item) => item.answer,
    meta: (item) => [categoryName('faqCategories', item.categoryId) || 'Uncategorized', `Order ${item.sortOrder}`],
    fields: [
      { name: 'question', label: 'Question', type: 'text', required: true, max: 300 },
      { name: 'answer', label: 'Published answer', type: 'textarea', required: true, max: 2400 },
      { name: 'categoryId', label: 'Category', type: 'select', options: categoryOptions('faqCategories') },
      { name: 'sortOrder', label: 'Sort order', type: 'number' }
    ]
  },
  subprocessors: {
    singular: 'subprocessor',
    title: (item) => item.name,
    description: (item) => [item.purpose, item.description].filter(Boolean).join(' '),
    meta: (item) => [item.location, item.url || 'No website'],
    fields: [
      { name: 'name', label: 'Provider name', type: 'text', required: true, max: 120 },
      { name: 'purpose', label: 'Processing purpose', type: 'textarea', max: 500 },
      { name: 'description', label: 'Description', type: 'textarea', max: 800 },
      { name: 'location', label: 'Location', type: 'text', max: 160 },
      { name: 'url', label: 'Provider website', type: 'url', max: 500 },
      { name: 'sortOrder', label: 'Sort order', type: 'number' }
    ]
  },
  updates: {
    singular: 'update',
    title: (item) => item.title,
    description: (item) => item.body,
    meta: (item) => [item.category, item.visibilityType === 'PRIVATE' ? 'Viewers only' : 'Public', formatDate(item.publishedAt), item.notifiedAt ? `Subscribers notified ${formatDate(item.notifiedAt, true)}` : 'Subscribers not notified yet'],
    fields: [
      { name: 'title', label: 'Title', type: 'text', required: true, max: 160 },
      { name: 'body', label: 'Update summary', type: 'textarea', required: true, max: 2400 },
      { name: 'category', label: 'Category', type: 'select', options: () => options(UPDATE_CATEGORIES) },
      { name: 'visibilityType', label: 'Visibility', type: 'select', options: () => [{ value: 'PUBLIC', label: 'Public' }, { value: 'PRIVATE', label: 'Viewers only' }] },
      { name: 'publishedAt', label: 'Publication date and time', type: 'datetime-local' }
    ],
    defaults: { category: 'GENERAL', visibilityType: 'PUBLIC', publishedAt: new Date().toISOString().slice(0, 16) }
  }
};

const lifecycleLabels = { draft: 'Draft', review: 'In review', published: 'Published', archived: 'Archived' };
const lifecyclePills = { draft: 'draft', review: 'request', published: 'public', archived: 'archived' };
const lifecycleTransitions = { draft: ['review'], review: ['published', 'draft'], published: ['archived'], archived: ['draft'] };

function transitionLabel(from, to) {
  if (to === 'review') return 'Submit for review';
  if (to === 'published') return 'Publish';
  if (to === 'archived') return 'Archive';
  return from === 'archived' ? 'Restore draft' : 'Back to draft';
}

function categoryName(kind, id) {
  return state?.[kind]?.find((category) => category.id === id)?.name ?? '';
}

function node(tag, opts = {}, children = []) {
  const result = document.createElement(tag);
  for (const [key, value] of Object.entries(opts)) {
    if (key === 'className') result.className = value;
    else if (key === 'text') result.textContent = value;
    else if (key === 'dataset') Object.assign(result.dataset, value);
    else if (['type', 'href', 'name', 'rel', 'target', 'title', 'for', 'accept'].includes(key)) result.setAttribute(key, value);
    else result[key] = value;
  }
  for (const child of children) if (child) result.append(child);
  return result;
}

function formatDate(value, withTime = false) {
  if (!value) return 'Not specified';
  const date = new Date(value.includes('T') ? value : `${value}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat('en-US', withTime
    ? { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' }
    : { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' }
  ).format(date);
}

async function api(path, options = {}) {
  const headers = new Headers(options.headers ?? {});
  if (token) headers.set('authorization', `Bearer ${token}`);
  if (options.body && !(options.body instanceof FormData) && !headers.has('content-type')) headers.set('content-type', 'application/json');
  const response = await fetch(path, { ...options, headers });
  const contentType = response.headers.get('content-type') ?? '';
  const body = contentType.includes('application/json') ? await response.json() : null;
  if (response.status === 401) {
    const message = token ? 'The token was not accepted.' : '';
    token = '';
    sessionStorage.removeItem(TOKEN_KEY);
    showLogin(message);
  }
  if (!response.ok) throw new Error(body?.error ?? `Request failed (${response.status})`);
  return body;
}

function toast(message) {
  const target = $('#admin-toast');
  target.textContent = message;
  target.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { target.hidden = true; }, 4200);
}

function showLogin(message = '') {
  const dialog = $('#login-dialog');
  $('#login-status').textContent = message;
  if (!dialog.open) dialog.showModal();
}

async function loadState() {
  try {
    state = await api('/api/admin/state');
    renderAll();
    if ($('#login-dialog').open) $('#login-dialog').close();
  } catch (error) {
    if (error.message !== 'Admin authentication required.') toast(error.message);
  }
}

async function act(work, success) {
  try {
    const result = await work();
    if (success) toast(typeof success === 'function' ? success(result) : success);
    await loadState();
    return result;
  } catch (error) {
    toast(error.message);
    return null;
  }
}

function publishedCount(items) {
  return (items ?? []).filter((item) => item.lifecycle === 'published').length;
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

function badge(text, type = 'draft') {
  const tone = { draft: 'neutral', request: 'warning', public: 'success', archived: 'neutral', approved: 'success', denied: 'danger', info: 'info' }[type] ?? 'neutral';
  return node('span', { className: `kumo-badge kumo-badge-${tone}`, text });
}

function summaryLine(shown, total, noun, detail) {
  if (!total) return '';
  const plural = total === 1 ? noun : `${noun}s`;
  const scope = shown < total ? `Showing the ${shown} most relevant of ${total} ${plural}` : `${total} ${plural}`;
  return `${scope} · ${detail}.`;
}

function renderAll() {
  if (!state) return;
  renderBrandMark($('#admin-logo'), state.site.logoUrl);
  renderBrandMark($('#logo-preview'), state.site.logoUrl);
  $('#admin-company').textContent = state.site.companyName;
  $('#admin-identity').textContent = state.actor && state.actor !== 'admin' ? `Signed in as ${state.actor}` : 'Signed in with the shared admin token';
  for (const kind of Object.keys(resourceConfig)) {
    $(`#nav-${kind}`).textContent = state[kind].length;
    renderResources(kind);
  }
  $('#nav-controls').textContent = state.controls.length;
  $('#nav-data').textContent = state.dataCollected.length;
  $('#nav-videos').textContent = state.videos.length;
  // Totals come from the full tables; the lists themselves are capped.
  const totals = state.totals ?? {
    accessRequests: state.accessRequests.length,
    pendingAccessRequests: state.accessRequests.filter((item) => item.status === 'pending').length,
    subscribers: state.subscribers.length,
    activeSubscribers: state.subscribers.filter((item) => item.status === 'active').length
  };
  $('#nav-requests').textContent = totals.pendingAccessRequests;
  $('#nav-viewers').textContent = state.viewers.filter((item) => !item.removedAt).length;
  $('#nav-subscribers').textContent = totals.activeSubscribers;
  $('#nav-chat').textContent = state.chatbotConversations.length;
  const published = Object.keys(resourceConfig).reduce((sum, kind) => sum + publishedCount(state[kind]), 0);
  $('#metric-published').textContent = published;
  $('#metric-gated').textContent = state.documents.filter((item) => item.lifecycle === 'published' && item.visibility === 'request').length;
  $('#metric-requests').textContent = totals.pendingAccessRequests;
  $('#metric-viewers').textContent = state.viewers.filter((item) => !item.removedAt).length;
  $('#metric-subscribers').textContent = totals.activeSubscribers;
  $('#request-summary').textContent = summaryLine(state.accessRequests.length, totals.accessRequests, 'request', `${totals.pendingAccessRequests} pending`);
  $('#subscriber-summary').textContent = summaryLine(state.subscribers.length, totals.subscribers, 'subscriber', `${totals.activeSubscribers} active`);
  $('#profile-reviewed').textContent = `Saved ${formatDate(state.site.updatedAt, true)}.`;
  fillSiteForm();
  for (const kind of ['resource', 'faq', 'control']) renderCategories(kind);
  renderControls();
  renderDataCollected();
  renderVideos();
  renderRequests();
  renderViewers();
  renderSubscribers();
  renderOutbox();
  renderChat();
  renderAudit();
}

function fillSiteForm() {
  const form = $('#site-form');
  for (const [key, value] of Object.entries(state.site)) {
    const field = form.elements[key];
    if (!field) continue;
    if (field.type === 'checkbox') field.checked = Boolean(value);
    else field.value = value ?? '';
  }
}

// --- Generic editor --------------------------------------------------------

function fieldFor(definition) {
  const wrapper = node('label', { text: definition.label });
  let input;
  if (definition.type === 'textarea') {
    input = node('textarea', { name: definition.name });
    input.rows = 4;
    if (definition.max) input.maxLength = definition.max;
  } else if (definition.type === 'select') {
    input = node('select', { name: definition.name });
    for (const option of definition.options()) input.append(node('option', { value: option.value, text: option.label }));
  } else if (definition.type === 'multiselect') {
    wrapper.className = 'multiselect';
    const list = node('div', { className: 'multiselect-options' });
    const choices = definition.options();
    if (!choices.length) list.append(node('span', { className: 'logo-hint', text: definition.emptyText || 'Nothing to choose from yet.' }));
    for (const option of choices) {
      list.append(node('label', { className: 'checkbox-label' }, [node('input', { name: definition.name, type: 'checkbox', value: option.value }), document.createTextNode(option.label)]));
    }
    wrapper.append(list);
    return wrapper;
  } else if (definition.type === 'checkbox') {
    wrapper.className = 'checkbox-label';
    wrapper.textContent = '';
    input = node('input', { name: definition.name, type: 'checkbox' });
    wrapper.append(input, document.createTextNode(definition.label));
    return wrapper;
  } else {
    input = node('input', { name: definition.name, type: definition.type === 'list' ? 'text' : definition.type });
    if (definition.max) input.maxLength = definition.max;
    if (definition.type === 'number') input.step = '1';
    if (definition.placeholder) input.placeholder = definition.placeholder;
  }
  input.required = Boolean(definition.required);
  wrapper.append(input);
  return wrapper;
}

function openForm({ eyebrow, title, submitLabel = 'Save', fields, values = {}, onSubmit }) {
  $('#editor-eyebrow').textContent = eyebrow;
  $('#editor-heading').textContent = title;
  $('#editor-submit').textContent = submitLabel;
  const root = $('#editor-fields');
  root.replaceChildren();
  for (const definition of fields) {
    const field = fieldFor(definition);
    const value = values[definition.name];
    if (definition.type === 'multiselect') {
      for (const input of $$('input', field)) input.checked = Array.isArray(value) && value.includes(input.value);
    } else if (definition.type === 'checkbox') {
      $('input', field).checked = Boolean(value);
    } else {
      const input = $('input, textarea, select', field);
      if (definition.type === 'datetime-local') input.value = value ? String(value).slice(0, 16) : '';
      else if (definition.type === 'list') input.value = Array.isArray(value) ? value.join(', ') : value ?? '';
      else input.value = value ?? '';
    }
    root.append(field);
  }
  formHandler = (form) => {
    const data = {};
    for (const definition of fields) {
      if (definition.type === 'multiselect') data[definition.name] = $$(`input[name="${definition.name}"]:checked`, form).map((input) => input.value);
      else if (definition.type === 'checkbox') data[definition.name] = form.elements[definition.name].checked;
      else if (definition.type === 'number') data[definition.name] = Number(form.elements[definition.name].value || 0);
      else if (definition.type === 'list') data[definition.name] = form.elements[definition.name].value.split(',').map((part) => part.trim()).filter(Boolean);
      else if (definition.type === 'select') data[definition.name] = form.elements[definition.name].value || null;
      else data[definition.name] = form.elements[definition.name].value;
    }
    return onSubmit(data);
  };
  $('#editor-dialog').showModal();
}

function openEditor(kind, item = null) {
  const config = resourceConfig[kind];
  const fields = config.fields.filter((definition) => !(kind === 'documents' && item?.sourceType === 'r2' && definition.externalOnly));
  openForm({
    eyebrow: item ? 'Review before saving' : 'New structured content',
    title: `${item ? 'Edit' : 'Add'} ${config.singular}`,
    submitLabel: 'Save record',
    fields,
    values: { ...(config.defaults ?? {}), ...(item ?? {}) },
    onSubmit: async (data) => {
      if (kind === 'documents') {
        data.sourceType = item?.sourceType === 'r2' ? 'r2' : 'external';
        if (item?.sourceType === 'r2') data.objectKey = item.objectKey;
        if (data.categoryId) data.category = categoryName('resourceCategories', data.categoryId);
      }
      if (kind === 'updates' && data.publishedAt) data.publishedAt = new Date(data.publishedAt).toISOString();
      const path = item ? `/api/admin/resources/${kind}/${encodeURIComponent(item.id)}` : `/api/admin/resources/${kind}`;
      await api(path, { method: item ? 'PUT' : 'POST', body: JSON.stringify(data) });
      return `${config.singular} saved.`;
    }
  });
}

$('#editor-form').addEventListener('submit', async (event) => {
  event.preventDefault();
  if (!formHandler) return;
  try {
    const message = await formHandler(event.currentTarget);
    $('#editor-dialog').close();
    if (message) toast(message);
    await loadState();
  } catch (error) {
    toast(error.message);
  }
});
$('#close-editor').addEventListener('click', () => $('#editor-dialog').close());
$('#cancel-editor').addEventListener('click', () => $('#editor-dialog').close());

// --- Lifecycle resources ---------------------------------------------------

function renderResources(kind) {
  const root = $(`#list-${kind}`);
  const config = resourceConfig[kind];
  root.replaceChildren();
  const items = state[kind];
  if (!items.length) {
    root.append(node('div', { className: 'empty-state', text: `No ${config.singular} records yet.` }));
    return;
  }
  for (const item of items) {
    const lifecycle = item.lifecycle ?? 'draft';
    const badges = [badge(lifecycleLabels[lifecycle] ?? lifecycle, lifecyclePills[lifecycle] ?? 'draft')];
    if (kind === 'documents') badges.push(badge(item.visibility === 'request' ? 'By request' : 'Public', item.visibility === 'request' ? 'request' : 'public'));
    if (kind === 'updates' && item.visibilityType === 'PRIVATE') badges.push(badge('Viewers only', 'info'));
    const titleLine = node('div', { className: 'resource-topline' }, [node('span', { className: 'resource-title', text: config.title(item) }), ...badges]);
    const meta = node('div', { className: 'resource-meta' });
    for (const value of config.meta(item).filter(Boolean)) meta.append(node('span', { text: String(value) }));
    const actions = [];
    for (const target of lifecycleTransitions[lifecycle] ?? []) {
      const move = node('button', { className: target === 'published' ? 'kumo-btn kumo-btn-primary kumo-btn-sm' : 'kumo-btn kumo-btn-secondary kumo-btn-sm', type: 'button', text: transitionLabel(lifecycle, target) });
      move.addEventListener('click', () => changeLifecycle(kind, item, target));
      actions.push(move);
    }
    if (kind === 'certifications') {
      const fileInput = node('input', { type: 'file', accept: 'image/png,image/jpeg,image/webp,image/svg+xml', hidden: true });
      fileInput.addEventListener('change', () => uploadBadge(item, fileInput));
      const upload = node('button', { className: 'kumo-btn kumo-btn-secondary kumo-btn-sm', type: 'button', text: item.badgeObjectKey ? 'Replace badge' : 'Upload badge' });
      upload.addEventListener('click', () => fileInput.click());
      actions.push(fileInput, upload);
      if (item.badgeObjectKey) {
        const removeBadge = node('button', { className: 'kumo-btn kumo-btn-ghost kumo-btn-sm', type: 'button', text: 'Remove badge' });
        removeBadge.addEventListener('click', () => act(() => api(`/api/admin/resources/certifications/${encodeURIComponent(item.id)}/badge`, { method: 'DELETE' }), 'Badge removed.'));
        actions.push(removeBadge);
      }
    }
    if (kind === 'documents' && item.sourceType === 'r2') {
      actions.push(node('a', { className: 'kumo-btn kumo-btn-ghost kumo-btn-sm', text: 'Preview file', href: `/api/admin/resources/documents/${encodeURIComponent(item.id)}/media`, target: '_blank', rel: 'noopener' }));
    }
    const edit = node('button', { className: 'kumo-btn kumo-btn-secondary kumo-btn-sm', type: 'button', text: 'Edit' });
    edit.addEventListener('click', () => openEditor(kind, item));
    const remove = node('button', { className: 'kumo-btn kumo-btn-danger kumo-btn-sm', type: 'button', text: 'Delete' });
    remove.addEventListener('click', () => deleteResource(kind, item));
    root.append(node('article', { className: 'resource-row' }, [
      node('div', { className: 'resource-main' }, [titleLine, node('p', { className: 'resource-description', text: config.description(item) || 'No description.' }), meta]),
      node('div', { className: 'resource-actions' }, [...actions, edit, remove])
    ]));
  }
}

function publishConfirmMessage(kind, item, title) {
  if (kind !== 'updates') return `Publish “${title}” to the public trust center?`;
  if (item.notifiedAt) return `Republish “${title}”? Subscribers were already notified and will not be emailed again.`;
  const audience = state.subscribers.filter((entry) => entry.status === 'active').length;
  return `Publish “${title}” and email ${audience} subscriber${audience === 1 ? '' : 's'}?`;
}

async function changeLifecycle(kind, item, target) {
  const title = resourceConfig[kind].title(item);
  if (target === 'published' && !window.confirm(publishConfirmMessage(kind, item, title))) return;
  if (target === 'archived' && !window.confirm(`Archive “${title}”? It will be removed from the public trust center.`)) return;
  await act(() => api(`/api/admin/resources/${kind}/${encodeURIComponent(item.id)}/lifecycle`, { method: 'POST', body: JSON.stringify({ lifecycle: target }) }),
    (result) => kind === 'updates' && target === 'published' && result.notified > 0
      ? `Update published. Queued ${result.notified} notification email${result.notified === 1 ? '' : 's'}.`
      : `${resourceConfig[kind].singular} moved to ${lifecycleLabels[target].toLowerCase()}.`);
}

async function deleteResource(kind, item) {
  const title = resourceConfig[kind].title(item);
  if (!window.confirm(`Delete “${title}”? This removes it from the public trust center and cannot be undone from this screen.`)) return;
  await act(() => api(`/api/admin/resources/${kind}/${encodeURIComponent(item.id)}`, { method: 'DELETE' }), `${resourceConfig[kind].singular} deleted.`);
}

async function uploadBadge(item, input) {
  if (!input.files?.[0]) return;
  const form = new FormData();
  form.set('file', input.files[0]);
  await act(() => api(`/api/admin/resources/certifications/${encodeURIComponent(item.id)}/badge`, { method: 'POST', body: form }), 'Badge uploaded.');
}

// --- Categories ------------------------------------------------------------

const CATEGORY_PATHS = { resource: 'resource-categories', faq: 'faq-categories', control: 'control-categories' };
const CATEGORY_STATE = { resource: 'resourceCategories', faq: 'faqCategories', control: 'controlCategories' };

function renderCategories(kind) {
  const root = $(`#categories-${kind}`);
  if (!root) return;
  root.replaceChildren();
  const categories = state[CATEGORY_STATE[kind]];
  if (!categories.length) {
    root.append(node('div', { className: 'empty-state', text: 'No categories yet.' }));
    return;
  }
  categories.forEach((category, index) => {
    const controls = [];
    const up = node('button', { className: 'kumo-btn kumo-btn-ghost kumo-btn-sm', type: 'button', text: '↑', title: 'Move up' });
    up.disabled = index === 0;
    up.addEventListener('click', () => reorderCategory(kind, index, index - 1));
    const down = node('button', { className: 'kumo-btn kumo-btn-ghost kumo-btn-sm', type: 'button', text: '↓', title: 'Move down' });
    down.disabled = index === categories.length - 1;
    down.addEventListener('click', () => reorderCategory(kind, index, index + 1));
    const rename = node('button', { className: 'kumo-btn kumo-btn-secondary kumo-btn-sm', type: 'button', text: 'Rename' });
    rename.addEventListener('click', () => {
      const name = window.prompt('Category name', category.name);
      if (name && name !== category.name) act(() => api(`/api/admin/${CATEGORY_PATHS[kind]}/${encodeURIComponent(category.id)}`, { method: 'PATCH', body: JSON.stringify({ name }) }), 'Category renamed.');
    });
    const remove = node('button', { className: 'kumo-btn kumo-btn-danger kumo-btn-sm', type: 'button', text: 'Delete' });
    remove.addEventListener('click', () => {
      const warning = kind === 'control' ? 'Delete this category and every control in it?' : 'Delete this category? Its items become uncategorized.';
      if (window.confirm(warning)) act(() => api(`/api/admin/${CATEGORY_PATHS[kind]}/${encodeURIComponent(category.id)}`, { method: 'DELETE' }), 'Category deleted.');
    });
    controls.push(up, down);
    if (kind === 'control') {
      const visibility = node('select', { title: 'Visibility' }, [node('option', { value: 'PUBLIC', text: 'Public' }), node('option', { value: 'SHAREABLE', text: 'Shareable (viewers only)' })]);
      visibility.value = category.visibility;
      visibility.addEventListener('change', () => act(() => api(`/api/admin/control-categories/${encodeURIComponent(category.id)}`, { method: 'PATCH', body: JSON.stringify({ visibility: visibility.value }) }), 'Visibility updated.'));
      const override = node('select', { title: 'Status visibility override' }, VISIBILITY_MODES.map(([value, label]) => node('option', { value, text: label })));
      override.value = category.statusVisibilityOverride ?? '';
      override.addEventListener('change', () => act(() => api(`/api/admin/control-categories/${encodeURIComponent(category.id)}`, { method: 'PATCH', body: JSON.stringify({ statusVisibilityOverride: override.value || null }) }), 'Override updated.'));
      controls.push(visibility, override);
    }
    controls.push(rename, remove);
    const count = kind === 'control'
      ? state.controls.filter((control) => control.memberships.some((membership) => membership.categoryId === category.id)).length
      : kind === 'resource'
        ? state.documents.filter((document) => document.categoryId === category.id).length
        : state.faqs.filter((faq) => faq.categoryId === category.id).length;
    root.append(node('div', { className: 'category-row' }, [
      node('div', { className: 'category-name' }, [node('strong', { text: category.name }), node('span', { className: 'resource-meta', text: `${count} item${count === 1 ? '' : 's'}` })]),
      node('div', { className: 'resource-actions' }, controls)
    ]));
  });
}

function reorderCategory(kind, from, to) {
  const ids = state[CATEGORY_STATE[kind]].map((category) => category.id);
  const [moved] = ids.splice(from, 1);
  ids.splice(to, 0, moved);
  act(() => api(`/api/admin/${CATEGORY_PATHS[kind]}/order`, { method: 'PUT', body: JSON.stringify({ orderedCategoryIds: ids }) }));
}

$$('[data-category-form]').forEach((form) => form.addEventListener('submit', async (event) => {
  event.preventDefault();
  const kind = form.dataset.categoryForm;
  const name = new FormData(form).get('name');
  const result = await act(() => api(`/api/admin/${CATEGORY_PATHS[kind]}`, { method: 'POST', body: JSON.stringify({ name }) }), 'Category added.');
  if (result) form.reset();
}));

// --- Controls --------------------------------------------------------------

function controlFields(existing) {
  return [
    { name: 'name', label: 'Control name', type: 'text', required: true, max: 200 },
    { name: 'description', label: 'Description', type: 'textarea', max: 2400 },
    { name: 'status', label: 'Status', type: 'select', options: () => Object.entries(CONTROL_STATUS_LABELS).map(([value, label]) => ({ value, label })) },
    { name: 'externalId', label: 'External control id (from your compliance platform)', type: 'text', max: 120 },
    ...(existing ? [] : [{ name: 'categoryIds', label: 'Categories (at least one)', type: 'multiselect', options: controlCategoryOptions, emptyText: 'Create a control category first.' }]),
    { name: 'tags', label: 'Tags, comma separated as category:tag (for example domain:identity)', type: 'list' }
  ];
}

function tagsFromList(list) {
  const tags = {};
  for (const entry of list) {
    const [category, ...rest] = entry.split(':');
    const tag = rest.join(':').trim();
    if (!category || !tag) continue;
    (tags[category.trim()] ??= []).push(tag);
  }
  return tags;
}

function tagsToList(tags) {
  return Object.entries(tags ?? {}).flatMap(([category, list]) => list.map((tag) => `${category}:${tag}`));
}

function openControlEditor(control = null) {
  openForm({
    eyebrow: control ? 'Review before saving' : 'New control',
    title: control ? 'Edit control' : 'Add control',
    fields: controlFields(Boolean(control)),
    values: control ? { ...control, tags: tagsToList(control.tags) } : { status: 'UNMAPPED' },
    onSubmit: async (data) => {
      const body = { ...data, tags: tagsFromList(data.tags) };
      if (control) await api(`/api/admin/controls/${encodeURIComponent(control.id)}`, { method: 'PATCH', body: JSON.stringify(body) });
      else await api('/api/admin/controls', { method: 'POST', body: JSON.stringify(body) });
      return 'Control saved.';
    }
  });
}

function renderControls() {
  const root = $('#list-controls');
  root.replaceChildren();
  if (!state.controls.length) {
    root.append(node('div', { className: 'empty-state', text: 'No controls yet. Create a control category, then add controls to it.' }));
    return;
  }
  for (const control of state.controls) {
    const categories = control.memberships.map((membership) => categoryName('controlCategories', membership.categoryId)).filter(Boolean);
    const tone = control.status === 'OK' ? 'approved' : control.status === 'NEEDS_ATTENTION' ? 'request' : 'draft';
    const meta = node('div', { className: 'resource-meta' });
    for (const value of [categories.length ? categories.join(', ') : 'No category', control.externalId ? `External ${control.externalId}` : null, ...tagsToList(control.tags)].filter(Boolean)) meta.append(node('span', { text: value }));
    const membership = node('button', { className: 'kumo-btn kumo-btn-secondary kumo-btn-sm', type: 'button', text: 'Categories' });
    membership.addEventListener('click', () => openForm({
      eyebrow: control.name,
      title: 'Control categories',
      fields: [{ name: 'categoryIds', label: 'Categories', type: 'multiselect', options: controlCategoryOptions }],
      values: { categoryIds: control.memberships.map((entry) => entry.categoryId) },
      onSubmit: async (data) => {
        const current = control.memberships.map((entry) => entry.categoryId);
        for (const categoryId of state.controlCategories.map((category) => category.id)) {
          const has = current.includes(categoryId);
          const wants = data.categoryIds.includes(categoryId);
          if (has === wants) continue;
          await api(`/api/admin/control-categories/${encodeURIComponent(categoryId)}/controls`, { method: 'PATCH', body: JSON.stringify({ controlsToAdd: wants ? [control.id] : [], controlsToRemove: wants ? [] : [control.id] }) });
        }
        return 'Categories updated.';
      }
    }));
    const edit = node('button', { className: 'kumo-btn kumo-btn-secondary kumo-btn-sm', type: 'button', text: 'Edit' });
    edit.addEventListener('click', () => openControlEditor(control));
    const remove = node('button', { className: 'kumo-btn kumo-btn-danger kumo-btn-sm', type: 'button', text: 'Delete' });
    remove.addEventListener('click', () => { if (window.confirm(`Delete “${control.name}”?`)) act(() => api(`/api/admin/controls/${encodeURIComponent(control.id)}`, { method: 'DELETE' }), 'Control deleted.'); });
    root.append(node('article', { className: 'resource-row' }, [
      node('div', { className: 'resource-main' }, [
        node('div', { className: 'resource-topline' }, [node('span', { className: 'resource-title', text: control.name }), badge(CONTROL_STATUS_LABELS[control.status] ?? control.status, tone)]),
        node('p', { className: 'resource-description', text: control.description || 'No description.' }),
        meta
      ]),
      node('div', { className: 'resource-actions' }, [membership, edit, remove])
    ]));
  }
}

$('#add-control').addEventListener('click', () => openControlEditor());

// --- Data collected and videos --------------------------------------------

function dataRow(item = { dataCollected: '', status: 'COLLECTED' }) {
  const status = node('select', { name: 'status' }, [['COLLECTED', 'Collected'], ['NOT_COLLECTED', 'Not collected'], ['HIDDEN', 'Hidden']].map(([value, label]) => node('option', { value, text: label })));
  status.value = item.status;
  const remove = node('button', { className: 'kumo-btn kumo-btn-ghost kumo-btn-sm', type: 'button', text: 'Remove' });
  const row = node('tr', {}, [
    node('td', {}, [node('input', { name: 'dataCollected', value: item.dataCollected, maxLength: 200, required: true, placeholder: 'Business contact information' })]),
    node('td', {}, [status]),
    node('td', {}, [remove])
  ]);
  remove.addEventListener('click', () => row.remove());
  return row;
}

function renderDataCollected() {
  $('#data-form').elements.dataCollectedHeading.value = state.site.dataCollectedHeading ?? '';
  const rows = $('#data-rows');
  rows.replaceChildren(...state.dataCollected.map(dataRow));
}

$('#add-data-row').addEventListener('click', () => $('#data-rows').append(dataRow()));
$('#data-form').addEventListener('submit', async (event) => {
  event.preventDefault();
  const status = $('#data-status');
  const dataCollected = $$('tr', $('#data-rows')).map((row) => ({ dataCollected: $('input[name="dataCollected"]', row).value, status: $('select', row).value }));
  status.classList.remove('error');
  try {
    await api('/api/admin/data-collected', { method: 'PUT', body: JSON.stringify({ dataCollected, dataCollectedHeading: event.currentTarget.elements.dataCollectedHeading.value || null }) });
    status.textContent = 'Disclosures saved.';
    toast('Data collected disclosures saved.');
    await loadState();
  } catch (error) {
    status.classList.add('error');
    status.textContent = error.message;
  }
});

function videoRow(video = { title: '', url: '', description: '' }) {
  const remove = node('button', { className: 'kumo-btn kumo-btn-ghost kumo-btn-sm', type: 'button', text: 'Remove' });
  const row = node('tr', {}, [
    node('td', {}, [node('input', { name: 'title', value: video.title, maxLength: 160, required: true })]),
    node('td', {}, [node('input', { name: 'url', type: 'url', value: video.url, maxLength: 500, required: true, placeholder: 'https://www.youtube.com/watch?v=…' })]),
    node('td', {}, [node('input', { name: 'description', value: video.description, maxLength: 800 })]),
    node('td', {}, [remove])
  ]);
  remove.addEventListener('click', () => row.remove());
  return row;
}

function renderVideos() {
  $('#video-rows').replaceChildren(...state.videos.map(videoRow));
}

$('#add-video-row').addEventListener('click', () => $('#video-rows').append(videoRow()));
$('#video-form').addEventListener('submit', async (event) => {
  event.preventDefault();
  const status = $('#video-status');
  const videos = $$('tr', $('#video-rows')).map((row) => ({ title: $('input[name="title"]', row).value, url: $('input[name="url"]', row).value, description: $('input[name="description"]', row).value }));
  status.classList.remove('error');
  try {
    await api('/api/admin/videos', { method: 'PUT', body: JSON.stringify({ videos }) });
    status.textContent = 'Videos saved.';
    toast('Videos saved.');
    await loadState();
  } catch (error) {
    status.classList.add('error');
    status.textContent = error.message;
  }
});

// --- Access requests and viewers ------------------------------------------

function requestedLabel(request) {
  if (request.accessLevel === 'FULL_ACCESS' || !request.requestedResources) return 'Full access';
  return request.requestedResources.map((id) => state.documents.find((document) => document.id === id)?.title ?? id).join(', ');
}

function renderRequests() {
  const root = $('#request-list');
  root.replaceChildren();
  const requests = [...state.accessRequests].sort((a, b) => (a.status === 'pending' ? -1 : 1) - (b.status === 'pending' ? -1 : 1));
  if (!requests.length) {
    const cell = node('td', { text: 'No access requests yet.' });
    cell.colSpan = 5;
    root.append(node('tr', {}, [cell]));
    return;
  }
  for (const request of requests) {
    const statusType = request.status === 'approved' ? 'approved' : request.status === 'denied' ? 'denied' : 'request';
    const actions = node('div', { className: 'request-actions' });
    if (request.status === 'pending') {
      const approve = node('button', { className: 'kumo-btn kumo-btn-primary kumo-btn-sm', type: 'button', text: 'Approve' });
      const deny = node('button', { className: 'kumo-btn kumo-btn-danger kumo-btn-sm', type: 'button', text: 'Deny' });
      approve.addEventListener('click', () => approveRequest(request));
      deny.addEventListener('click', () => denyRequest(request));
      actions.append(approve, deny);
    } else {
      actions.append(node('span', { text: request.status === 'denied' && request.denialReason ? `Denied: ${request.denialReason}` : `Decided ${formatDate(request.updatedAt, true)}` }));
    }
    root.append(node('tr', {}, [
      node('td', {}, [node('strong', { text: request.name }), node('br'), node('a', { text: request.email, href: `mailto:${request.email}` }), node('br'), node('span', { className: 'resource-meta', text: request.company })]),
      node('td', { text: requestedLabel(request) }),
      node('td', { text: request.reason || '—' }),
      node('td', {}, [badge(request.status, statusType)]),
      node('td', {}, [actions])
    ]));
  }
}

function approveRequest(request) {
  openForm({
    eyebrow: `${request.name} · ${request.company}`,
    title: 'Approve access',
    submitLabel: 'Approve and send link',
    fields: [
      { name: 'accessLevel', label: 'Access level', type: 'select', options: () => [{ value: 'PARTIAL_ACCESS', label: 'Partial: public plus selected resources' }, { value: 'FULL_ACCESS', label: 'Full: every published resource' }] },
      { name: 'resourceIds', label: 'Request-only resources (for partial access)', type: 'multiselect', options: gatedDocumentOptions, emptyText: 'No request-only documents exist.' },
      { name: 'expirationDate', label: 'Access expires (leave blank for no expiry)', type: 'datetime-local' },
      { name: 'isNdaRequired', label: 'Require click-through confidentiality agreement before downloads', type: 'checkbox' }
    ],
    values: { accessLevel: request.accessLevel, resourceIds: request.requestedResources ?? [] },
    onSubmit: async (data) => {
      const body = { accessLevel: data.accessLevel, resourceIds: data.resourceIds, isNdaRequired: data.isNdaRequired };
      if (data.expirationDate) body.expirationDate = new Date(data.expirationDate).toISOString();
      const result = await api(`/api/admin/access-requests/${encodeURIComponent(request.id)}/approve`, { method: 'POST', body: JSON.stringify(body) });
      showLinkDialog(result.viewer);
      return 'Request approved. A personal access link was issued.';
    }
  });
}

function denyRequest(request) {
  openForm({
    eyebrow: `${request.name} · ${request.company}`,
    title: 'Deny access',
    submitLabel: 'Deny',
    fields: [{ name: 'reason', label: 'Reason (kept in history, not emailed)', type: 'textarea', max: 800 }],
    onSubmit: async (data) => {
      await api(`/api/admin/access-requests/${encodeURIComponent(request.id)}/deny`, { method: 'POST', body: JSON.stringify({ reason: data.reason }) });
      return 'Request denied.';
    }
  });
}

function showLinkDialog(viewer) {
  $('#link-url').value = viewer.accessUrl;
  $('#link-summary').textContent = `${viewer.email} was emailed this link${viewer.expirationDate ? `; access expires ${formatDate(viewer.expirationDate, true)}` : ''}. The link is shown only once, so copy it now if you plan to share it manually.`;
  $('#link-status').textContent = '';
  $('#link-dialog').showModal();
}

$('#close-link').addEventListener('click', () => $('#link-dialog').close());
$('#copy-link').addEventListener('click', async () => {
  const input = $('#link-url');
  try {
    await navigator.clipboard.writeText(input.value);
    $('#link-status').textContent = 'Link copied.';
  } catch {
    input.select();
    $('#link-status').textContent = 'Copy was blocked. Select the link and copy it manually.';
  }
});

function viewerFields(existing) {
  return [
    ...(existing ? [] : [{ name: 'email', label: 'Email', type: 'email', required: true, max: 254 }]),
    { name: 'name', label: 'Name', type: 'text', required: !existing, max: 120 },
    { name: 'companyName', label: 'Company', type: 'text', required: !existing, max: 160 },
    { name: 'accessLevel', label: 'Access level', type: 'select', options: () => [{ value: 'PARTIAL_ACCESS', label: 'Partial: public plus selected resources' }, { value: 'FULL_ACCESS', label: 'Full: every published resource' }] },
    { name: 'resourceIds', label: 'Request-only resources (for partial access)', type: 'multiselect', options: gatedDocumentOptions, emptyText: 'No request-only documents exist.' },
    { name: 'expirationDate', label: 'Access expires (leave blank for no expiry)', type: 'datetime-local' },
    { name: 'isNdaRequired', label: 'Require click-through confidentiality agreement before downloads', type: 'checkbox' }
  ];
}

function openViewerEditor(viewer = null) {
  openForm({
    eyebrow: viewer ? viewer.email : 'New viewer',
    title: viewer ? 'Edit viewer access' : 'Add viewer',
    submitLabel: viewer ? 'Save' : 'Add and send link',
    fields: viewerFields(Boolean(viewer)),
    values: viewer ? { ...viewer, resourceIds: viewer.resourceIds ?? [], isNdaRequired: Boolean(viewer.ndaInfo) } : { accessLevel: 'PARTIAL_ACCESS' },
    onSubmit: async (data) => {
      const body = { ...data, expirationDate: data.expirationDate ? new Date(data.expirationDate).toISOString() : null };
      if (viewer) {
        await api(`/api/admin/viewers/${encodeURIComponent(viewer.id)}`, { method: 'PATCH', body: JSON.stringify(body) });
        return 'Viewer updated.';
      }
      const result = await api('/api/admin/viewers', { method: 'POST', body: JSON.stringify(body) });
      showLinkDialog(result);
      return 'Viewer added and access link sent.';
    }
  });
}

function renderViewers() {
  const root = $('#viewer-list');
  root.replaceChildren();
  const showRemoved = $('#show-removed-viewers').checked;
  const viewers = state.viewers.filter((viewer) => showRemoved || !viewer.removedAt);
  if (!viewers.length) {
    const cell = node('td', { text: 'No viewers yet. Approve an access request or add a viewer.' });
    cell.colSpan = 5;
    root.append(node('tr', {}, [cell]));
    return;
  }
  const now = Date.now();
  for (const viewer of viewers) {
    const expired = viewer.expiresAt && new Date(viewer.expiresAt).getTime() <= now;
    const access = viewer.accessLevel === 'FULL_ACCESS' ? 'Full access' : `${(viewer.resourceIds ?? []).length} resource${(viewer.resourceIds ?? []).length === 1 ? '' : 's'}`;
    const nda = !viewer.ndaRequired ? 'Not required' : viewer.ndaAcceptedAt ? `Accepted ${formatDate(viewer.ndaAcceptedAt, true)}` : 'Pending';
    const actions = node('div', { className: 'request-actions' });
    if (!viewer.removedAt) {
      const edit = node('button', { className: 'kumo-btn kumo-btn-secondary kumo-btn-sm', type: 'button', text: 'Edit' });
      edit.addEventListener('click', () => openViewerEditor(viewer));
      const remove = node('button', { className: 'kumo-btn kumo-btn-danger kumo-btn-sm', type: 'button', text: 'Remove' });
      remove.addEventListener('click', () => { if (window.confirm(`Revoke access for ${viewer.email}?`)) act(() => api(`/api/admin/viewers/${encodeURIComponent(viewer.id)}`, { method: 'DELETE' }), 'Viewer removed.'); });
      actions.append(edit, remove);
    } else {
      actions.append(node('span', { text: `Removed ${formatDate(viewer.removedAt, true)}` }));
    }
    root.append(node('tr', {}, [
      node('td', {}, [node('strong', { text: viewer.name || viewer.email }), node('br'), node('a', { text: viewer.email, href: `mailto:${viewer.email}` }), viewer.companyName ? node('span', { className: 'resource-meta', text: ` · ${viewer.companyName}` }) : null]),
      node('td', {}, [badge(access, viewer.accessLevel === 'FULL_ACCESS' ? 'approved' : 'info')]),
      node('td', { text: nda }),
      node('td', {}, [viewer.removedAt ? badge('Removed', 'denied') : expired ? badge('Expired', 'denied') : node('span', { text: viewer.expiresAt ? formatDate(viewer.expiresAt, true) : 'Never' })]),
      node('td', {}, [actions])
    ]));
  }
}

$('#add-viewer').addEventListener('click', () => openViewerEditor());
$('#show-removed-viewers').addEventListener('change', renderViewers);

// --- Subscribers -----------------------------------------------------------

function renderSubscribers() {
  const root = $('#subscriber-list');
  root.replaceChildren();
  if (!state.subscribers.length) {
    const cell = node('td', { text: 'No subscribers yet.' });
    cell.colSpan = 4;
    root.append(node('tr', {}, [cell]));
    return;
  }
  for (const subscriber of state.subscribers) {
    const pillType = subscriber.status === 'active' ? 'approved' : subscriber.status === 'pending' ? 'request' : 'draft';
    const remove = node('button', { className: 'kumo-btn kumo-btn-danger kumo-btn-sm', type: 'button', text: 'Delete' });
    remove.addEventListener('click', () => { if (window.confirm(`Delete ${subscriber.email}?`)) act(() => api(`/api/admin/subscribers/${encodeURIComponent(subscriber.id)}`, { method: 'DELETE' }), 'Subscriber deleted.'); });
    root.append(node('tr', {}, [
      node('td', { text: subscriber.email }),
      node('td', {}, [badge(subscriber.status === 'active' ? 'verified' : subscriber.status, pillType)]),
      node('td', { text: formatDate(subscriber.createdAt, true) }),
      node('td', {}, [node('div', { className: 'request-actions' }, [remove])])
    ]));
  }
}

async function exportSubscribers() {
  const headers = new Headers();
  if (token) headers.set('authorization', `Bearer ${token}`);
  try {
    const response = await fetch('/api/admin/subscribers/export', { headers });
    if (response.status === 401) {
      showLogin('The token was not accepted.');
      return;
    }
    if (!response.ok) throw new Error(`Export failed (${response.status})`);
    const blob = await response.blob();
    const filename = response.headers.get('content-disposition')?.match(/filename="([^"]+)"/)?.[1] ?? 'subscribers.csv';
    const url = URL.createObjectURL(blob);
    const link = node('a', { href: url });
    link.download = filename;
    document.body.append(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    toast('Subscriber export downloaded.');
  } catch (error) { toast(error.message); }
}

$('#export-subscribers').addEventListener('click', exportSubscribers);
$('#add-subscriber').addEventListener('click', () => openForm({
  eyebrow: 'New subscriber',
  title: 'Add subscriber',
  submitLabel: 'Add',
  fields: [
    { name: 'email', label: 'Email', type: 'email', required: true, max: 254 },
    { name: 'shouldSkipEmailVerification', label: 'Already verified (skip the confirmation email)', type: 'checkbox' }
  ],
  onSubmit: async (data) => {
    await api('/api/admin/subscribers', { method: 'POST', body: JSON.stringify(data) });
    return data.shouldSkipEmailVerification ? 'Subscriber added as verified.' : 'Subscriber added. A confirmation email was queued.';
  }
}));

// --- Outbox, chat, audit ---------------------------------------------------

function renderOutbox() {
  const root = $('#outbox-list');
  root.replaceChildren();
  const rows = state.emailOutbox ?? [];
  $('#nav-outbox').textContent = rows.filter((row) => row.status === 'pending' || row.status === 'sending').length;
  if (!rows.length) {
    const cell = node('td', { text: 'No emails have been queued yet.' });
    cell.colSpan = 5;
    root.append(node('tr', {}, [cell]));
    return;
  }
  for (const row of rows) {
    const pillType = row.status === 'sent' ? 'approved' : row.status === 'failed' ? 'denied' : 'request';
    const statusCell = node('td', {}, [badge(row.status, pillType)]);
    const attempts = Number(row.attempts) || 0;
    if (row.last_error && row.status !== 'sent') statusCell.append(node('div', { className: 'grant-line', text: `${attempts} attempt${attempts === 1 ? '' : 's'} · ${row.last_error}` }));
    const actions = node('div', { className: 'request-actions' });
    if (row.status === 'failed') {
      const retry = node('button', { className: 'kumo-btn kumo-btn-secondary kumo-btn-sm', type: 'button', text: 'Retry' });
      retry.addEventListener('click', () => act(() => api(`/api/admin/emails/${encodeURIComponent(row.id)}/retry`, { method: 'POST' }), 'Email requeued for delivery.'));
      actions.append(retry);
    }
    root.append(node('tr', {}, [
      node('td', {}, [node('strong', { text: row.to_email }), node('br'), node('span', { text: row.template })]),
      node('td', { text: row.subject }),
      statusCell,
      node('td', { text: formatDate(row.created_at, true) }),
      node('td', {}, [actions])
    ]));
  }
}

function renderChat() {
  const root = $('#chat-list');
  root.replaceChildren();
  if (!state.chatbotConversations.length) {
    const cell = node('td', { text: 'No conversations yet.' });
    cell.colSpan = 4;
    root.append(node('tr', {}, [cell]));
    return;
  }
  for (const conversation of state.chatbotConversations) {
    const open = node('a', { text: conversation.firstMessage, href: '#' });
    open.addEventListener('click', async (event) => {
      event.preventDefault();
      try {
        const result = await api(`/api/admin/chatbot/conversations/${encodeURIComponent(conversation.id)}`);
        $('#chat-detail-title').textContent = `${conversation.userEmail ?? 'Anonymous visitor'} · ${formatDate(conversation.createdAt, true)}`;
        const log = $('#chat-detail');
        log.replaceChildren(...result.results.map((message) => node('div', { className: `kumo-chat-message kumo-chat-${message.role.toLowerCase()}` }, [
          node('p', { text: message.message }),
          message.references?.length ? node('p', { className: 'kumo-record-meta', text: `References: ${message.references.join(', ')}` }) : null
        ])));
      } catch (error) { toast(error.message); }
    });
    root.append(node('tr', {}, [
      node('td', {}, [open]),
      node('td', { text: String(conversation.numMessages) }),
      node('td', { text: conversation.userEmail ?? 'Anonymous' }),
      node('td', { text: formatDate(conversation.createdAt, true) })
    ]));
  }
}

function renderAudit() {
  const root = $('#audit-list');
  root.replaceChildren();
  if (!state.auditLog.length) {
    root.append(node('div', { className: 'empty-state', text: 'No activity has been recorded yet.' }));
    return;
  }
  for (const record of state.auditLog) {
    root.append(node('div', { className: 'audit-row' }, [
      node('time', { text: formatDate(record.created_at, true), dateTime: record.created_at }),
      node('code', { text: record.action }),
      node('code', { className: 'audit-actor', text: record.actor || 'admin' }),
      node('span', { text: describeDetail(record.detail) })
    ]));
  }
}

function describeDetail(detail) {
  if (!detail || typeof detail !== 'object') return 'No additional detail';
  return Object.entries(detail).map(([key, value]) => `${key}: ${typeof value === 'object' ? JSON.stringify(value) : value}`).join(' · ') || 'No additional detail';
}

// --- Navigation, auth, profile, uploads -----------------------------------

function showPanel(name, { updateHash = true } = {}) {
  if (!$(`[data-panel-content="${name}"]`)) name = 'overview';
  $$('[data-panel-content]').forEach((panel) => { panel.hidden = panel.dataset.panelContent !== name; });
  $$('[data-panel]').forEach((button) => button.classList.toggle('active', button.dataset.panel === name));
  if (updateHash) {
    const next = name === 'overview' ? '' : `#${name}`;
    if (location.hash !== next) history.replaceState(null, '', `${location.pathname}${next}`);
  }
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

// Alert emails deep-link to /admin/#requests, so honor the hash on load.
function panelFromHash() {
  return (location.hash || '#overview').replace('#', '').toLowerCase();
}

$('#login-form').addEventListener('submit', async (event) => {
  event.preventDefault();
  const form = event.currentTarget;
  token = new FormData(form).get('token').toString();
  sessionStorage.setItem(TOKEN_KEY, token);
  $('#login-status').textContent = 'Checking token…';
  await loadState();
  form.reset();
});

$('#logout-button').addEventListener('click', () => {
  token = '';
  sessionStorage.removeItem(TOKEN_KEY);
  showLogin('Logged out.');
});

$$('[data-panel]').forEach((button) => button.addEventListener('click', () => showPanel(button.dataset.panel)));
$$('[data-go-panel]').forEach((button) => button.addEventListener('click', () => showPanel(button.dataset.goPanel)));
window.addEventListener('hashchange', () => showPanel(panelFromHash(), { updateHash: false }));
if (location.hash) showPanel(panelFromHash(), { updateHash: false });
$$('[data-create]').forEach((button) => button.addEventListener('click', () => openEditor(button.dataset.create)));

async function uploadAsset(asset, input, status) {
  status.classList.remove('error');
  if (!input.files?.[0]) {
    status.classList.add('error');
    status.textContent = 'Choose a file first.';
    return;
  }
  const form = new FormData();
  form.set('file', input.files[0]);
  status.textContent = 'Uploading…';
  try {
    const result = await api(`/api/admin/${asset}`, { method: 'POST', body: form });
    state.site = result.site;
    fillSiteForm();
    renderBrandMark($('#admin-logo'), result.site.logoUrl);
    renderBrandMark($('#logo-preview'), result.site.logoUrl);
    input.value = '';
    status.textContent = 'Uploaded.';
    toast(`${asset[0].toUpperCase()}${asset.slice(1)} updated.`);
  } catch (error) {
    status.classList.add('error');
    status.textContent = error.message;
  }
}

async function removeAsset(asset, status) {
  if (!window.confirm(`Remove the ${asset}?`)) return;
  status.classList.remove('error');
  try {
    const result = await api(`/api/admin/${asset}`, { method: 'DELETE' });
    state.site = result.site;
    fillSiteForm();
    renderBrandMark($('#admin-logo'), result.site.logoUrl);
    renderBrandMark($('#logo-preview'), result.site.logoUrl);
    status.textContent = 'Removed.';
  } catch (error) {
    status.classList.add('error');
    status.textContent = error.message;
  }
}

$('#upload-logo').addEventListener('click', () => uploadAsset('logo', $('#logo-file'), $('#logo-status')));
$('#remove-logo').addEventListener('click', () => { if (state?.site.logoUrl) removeAsset('logo', $('#logo-status')); });
$$('[data-asset-upload]').forEach((button) => button.addEventListener('click', () => uploadAsset(button.dataset.assetUpload, $(`#${button.dataset.assetUpload}-file`), $(`#${button.dataset.assetUpload}-status`))));
$$('[data-asset-remove]').forEach((button) => button.addEventListener('click', () => removeAsset(button.dataset.assetRemove, $(`#${button.dataset.assetRemove}-status`))));

$('#site-form').addEventListener('submit', async (event) => {
  event.preventDefault();
  const status = $('#site-status');
  status.classList.remove('error');
  status.textContent = 'Saving…';
  try {
    const form = event.currentTarget;
    const data = Object.fromEntries(new FormData(form).entries());
    data.isPublic = form.elements.isPublic.checked;
    delete data.logoUrl;
    delete data.logoObjectKey;
    await api('/api/admin/site', { method: 'PUT', body: JSON.stringify(data) });
    status.textContent = 'Profile saved.';
    toast('Trust center profile updated.');
    await loadState();
  } catch (error) {
    status.classList.add('error');
    status.textContent = error.message;
  }
});

$('#upload-document').addEventListener('click', () => {
  $('#upload-form').reset();
  $('#upload-status').textContent = '';
  const select = $('#upload-category');
  select.replaceChildren(...categoryOptions('resourceCategories')().map((option) => node('option', { value: option.value, text: option.label })));
  $('#upload-dialog').showModal();
});
$('#close-upload').addEventListener('click', () => $('#upload-dialog').close());
$('#cancel-upload').addEventListener('click', () => $('#upload-dialog').close());
$('#upload-form').addEventListener('submit', async (event) => {
  event.preventDefault();
  const status = $('#upload-status');
  const button = event.currentTarget.querySelector('button[type="submit"]');
  status.classList.remove('error');
  status.textContent = 'Uploading to private document storage…';
  button.disabled = true;
  try {
    const form = new FormData(event.currentTarget);
    if (form.get('categoryId')) form.set('category', categoryName('resourceCategories', form.get('categoryId')));
    await api('/api/admin/documents/upload', { method: 'POST', body: form });
    $('#upload-dialog').close();
    toast('Document uploaded and record created.');
    await loadState();
  } catch (error) {
    status.classList.add('error');
    status.textContent = error.message;
  } finally { button.disabled = false; }
});

loadState();
