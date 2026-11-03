const $ = selector => document.querySelector(selector);
const root = $('#viewRoot');
const views = { dashboard: 'Dashboard', tours: 'Tours', bookings: 'Bookings', requests: 'Requests', reviews: 'Reviews', addons: 'Add-ons', services: 'Services', settings: 'Settings', users: 'Users' };
let currentUser;
let csrf;
let toursCache = [];
let addonCache = [];
let serviceCache = [];
let noticeTimer;

const SERVICE_ICON_OPTIONS = [
  { key: 'map-pin', label: 'Map pin', group: 'Travel' }, { key: 'car', label: 'Car', group: 'Travel' }, { key: 'plane', label: 'Plane', group: 'Travel' },
  { key: 'bed-double', label: 'Bed', group: 'Stay' }, { key: 'ticket', label: 'Ticket', group: 'Experience' }, { key: 'users', label: 'Users', group: 'Groups' },
  { key: 'route', label: 'Route', group: 'Planning' }, { key: 'landmark', label: 'Landmark', group: 'Culture' }, { key: 'coffee', label: 'Coffee', group: 'Food' },
  { key: 'camera', label: 'Camera', group: 'Media' }, { key: 'luggage', label: 'Luggage', group: 'Travel' }, { key: 'sparkles', label: 'Sparkles', group: 'Luxury' },
  { key: 'briefcase-business', label: 'Business', group: 'Work' }, { key: 'badge-check', label: 'Badge', group: 'Trust' }, { key: 'croissant', label: 'Croissant', group: 'Food' },
  { key: 'truck', label: 'Truck', group: 'Travel' }, { key: 'star', label: 'Star', group: 'Favorites' }
];

function serviceIconButtons(selected = 'map-pin') {
  const grouped = SERVICE_ICON_OPTIONS.reduce((acc, icon) => {
    (acc[icon.group] ??= []).push(icon);
    return acc;
  }, {});
  const buttons = Object.entries(grouped).map(([group, icons]) => `
    <div class="icon-group">
      <div class="icon-group-label">${escapeHtml(group)}</div>
      <div class="icon-grid">${icons.map(icon => `
        <button type="button" class="icon-option ${selected === icon.key ? 'selected' : ''}" data-icon-key="${icon.key}" title="${escapeHtml(icon.label)}" aria-label="${escapeHtml(icon.label)}">
          <img src="/icons/${icon.key}.svg" alt="" width="24" height="24">
        </button>
      `).join('')}</div>
    </div>
  `).join('');
  return `<div class="icon-picker">${buttons}<button type="button" class="icon-option clear-icon ${!selected || selected === 'map-pin' ? 'selected' : ''}" data-icon-key="map-pin" title="Default icon">Default</button></div>`;
}

function escapeHtml(value) { return String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]); }
function csrfToken() { return csrf || ''; }
function setNotice(message, success = false) {
  const node = $('#adminNotice');
  node.textContent = message;
  node.classList.toggle('success', success);
  clearTimeout(noticeTimer);
  noticeTimer = setTimeout(() => { node.textContent = ''; }, 5000);
}
function showEmailResult(result, sentMessage) {
  if (result.delivery === 'sent') return setNotice(sentMessage, true);
  if (result.delivery === 'logged') return setNotice('Email was not sent: SMTP is not configured. The message was logged on the server only.');
  return setNotice('Email was not sent: no recipient email address is available.');
}
async function request(path, options = {}) {
  const headers = { ...(options.headers || {}) };
  if (!(options.body instanceof FormData)) headers['Content-Type'] = 'application/json';
  if (options.method && !['GET', 'HEAD'].includes(options.method)) headers['X-CSRF-Token'] = csrfToken();
  const response = await fetch(window.hayqApiUrl(`/api/admin${path}`), { ...options, headers, credentials: 'include' });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.error?.message || `Request failed (${response.status}).`);
  return payload.data;
}
function showLogin(message = '') { $('#adminView').hidden = true; $('#loginView').hidden = false; $('#loginStatus').textContent = message; }
function showAdmin(user) {
  currentUser = user;
  csrf = user.csrf;
  $('#loginView').hidden = true;
  $('#adminView').hidden = false;
  $('#adminIdentity').textContent = `${user.email} · ${user.role}`;
  document.querySelector('[data-owner-only]').hidden = user.role !== 'owner';
  openView('dashboard');
}
function badge(status) { return `<span class="badge ${['confirmed','paid','completed','published','approved'].includes(status) ? 'good' : ['pending','new','draft'].includes(status) ? 'warn' : ''}">${escapeHtml(status)}</span>`; }
function panel(title, content, action = '') { return `<div class="panel-title"><h2>${escapeHtml(title)}</h2>${action}</div>${content}`; }
function table(headers, rows) { return `<div class="table-wrap"><table><thead><tr>${headers.map(header => `<th>${escapeHtml(header)}</th>`).join('')}</tr></thead><tbody>${rows || `<tr><td colspan="${headers.length}" class="empty">Nothing here yet.</td></tr>`}</tbody></table></div>`; }
function formButton(text = 'Save') { return `<button class="primary" type="submit">${escapeHtml(text)}</button>`; }
function setView(title, html) { $('#viewTitle').textContent = title; root.innerHTML = html; }
function configInput(config, index, field, label, value, { numeric = false, language = '', wide = false, required = true, multiline = false } = {}) {
  const type = numeric ? 'number' : 'text';
  const attrs = numeric ? 'min="0" step="1"' : '';
  const control = multiline
    ? `<textarea data-config="${config}" data-index="${index}" data-field="${field}" ${required ? 'required' : ''} rows="2">${escapeHtml(value)}</textarea>`
    : `<input type="${type}" ${attrs} value="${escapeHtml(value)}" data-config="${config}" data-index="${index}" data-field="${field}" ${required ? 'required' : ''}>`;
  return `<label class="${wide ? 'wide' : ''}">${escapeHtml(label)}${language ? ` <span class="field-language">${language}</span>` : ''}${control}</label>`;
}
function transferSettingsEditor(routes, extras) {
  const routeFields = [
    ['airport', 'Airport group (English)', 'en'], ['airport_ru', 'Airport group (Russian)', 'ru'], ['airport_hy', 'Airport group (Armenian)', 'hy'],
    ['from', 'From (English)', 'en'], ['from_ru', 'From (Russian)', 'ru'], ['from_hy', 'From (Armenian)', 'hy'],
    ['to', 'To (English)', 'en'], ['to_ru', 'To (Russian)', 'ru'], ['to_hy', 'To (Armenian)', 'hy']
  ];
  const routeCards = routes.map((route, index) => `<fieldset class="config-card">
    <legend>${escapeHtml(route.from)} → ${escapeHtml(route.to)}</legend>
    <div class="config-grid">${routeFields.map(([field, label, language]) => configInput('transfer_routes', index, field, label, route[field], { language, required: language === 'en' })).join('')}
      ${configInput('transfer_routes', index, 'distance', 'Distance', route.distance)}
      ${configInput('transfer_routes', index, 'duration', 'Approx. duration', route.duration)}
      ${configInput('transfer_routes', index, 'sedan_amd', 'Sedan price (AMD)', route.sedan_amd, { numeric: true })}
      ${configInput('transfer_routes', index, 'minivan_amd', 'Minivan price (AMD)', route.minivan_amd, { numeric: true })}
    </div>
  </fieldset>`).join('');
  const extraCards = extras.map((extra, index) => `<fieldset class="config-card">
    <legend>${escapeHtml(extra.name_en)}</legend>
    <div class="config-grid">${configInput('transfer_extras', index, 'name_en', 'Name', extra.name_en, { language: 'en' })}
      ${configInput('transfer_extras', index, 'name_ru', 'Name', extra.name_ru, { language: 'ru', required: false })}
      ${configInput('transfer_extras', index, 'name_hy', 'Name', extra.name_hy, { language: 'hy', required: false })}
      ${configInput('transfer_extras', index, 'price_amd', 'Price (AMD)', extra.price_amd, { numeric: true })}
    </div>
  </fieldset>`).join('');
  return `<section class="wide settings-section"><h3>Airport transfer routes</h3><p class="empty">Set the route labels, approximate distance and duration, and prices in AMD. Set a fare to 0 to offer a quote instead of online booking.</p>${routeCards}</section>
    <section class="wide settings-section"><h3>Transfer extras</h3>${extraCards}</section>`;
}
function landingCopyEditor(settings) {
  const languages = [['en', 'English'], ['ru', 'Russian'], ['hy', 'Armenian']];
  return languages.map(([language, label], index) => {
    const key = `landing_copy_${language}`;
    let copy;
    try { copy = JSON.parse(settings[key] || '{}'); }
    catch { throw new Error(`Homepage copy for ${label} is invalid JSON. Please contact your developer to repair it.`); }
    if (!copy || Array.isArray(copy) || typeof copy !== 'object') {
      throw new Error(`Homepage copy for ${label} has an invalid structure.`);
    }
    const fields = Object.entries(copy).map(([field, value]) => {
      const name = field.replace(/([A-Z])/g, ' $1').replace(/^./, first => first.toUpperCase());
      const multiline = /description|text/i.test(field);
      return configInput(key, index, field, name, value, { multiline, wide: multiline });
    }).join('');
    return `<details class="wide copy-language" ${language === 'en' ? 'open' : ''}><summary>${label} homepage copy</summary><div class="config-grid">${fields}</div></details>`;
  }).join('');
}
function serializeConfig(form, config, original) {
  const values = original.map(item => ({ ...item }));
  form.querySelectorAll(`[data-config="${config}"]`).forEach(input => {
    const index = Number(input.dataset.index);
    const field = input.dataset.field;
    values[index][field] = input.type === 'number' ? Number(input.value) : input.value.trim();
  });
  return JSON.stringify(values);
}
function serializeObjectConfig(form, config, original) {
  const values = { ...original };
  form.querySelectorAll(`[data-config="${config}"]`).forEach(input => {
    values[input.dataset.field] = input.value.trim();
  });
  return JSON.stringify(values);
}
function openView(name) {
  document.querySelectorAll('#adminNav [data-view]').forEach(button => button.classList.toggle('active', button.dataset.view === name));
  $('#sidebar').classList.remove('open');
  const handlers = { dashboard: showDashboard, tours: showTours, bookings: showBookings, requests: showRequests, reviews: showReviews, addons: showAddons, services: showServices, settings: showSettings, users: showUsers };
  (handlers[name] || showDashboard)().catch(error => setNotice(error.message));
}

async function showDashboard() {
  const data = await request('/dashboard');
  const cards = [['Bookings today', data.today], ['This week', data.week], ['This month', data.month], ['Confirmed revenue', `${Number(data.revenue).toLocaleString()} AMD`], ['Pending', data.pending]];
  const departureRows = data.upcoming_departures.map(item => `<tr><td>${escapeHtml(item.date)}</td><td>${escapeHtml(item.tour_name)}</td><td>${item.seats_total - item.seats_taken} / ${item.seats_total}</td></tr>`).join('');
  const requestRows = data.newest_requests.map(item => `<tr><td>${escapeHtml(item.name)}</td><td>${escapeHtml(item.email)}</td><td>${badge(item.status)}</td><td>${escapeHtml(item.created_at)}</td></tr>`).join('');
  setView('Dashboard', `<div class="stats">${cards.map(([label,value]) => `<div class="stat"><span>${escapeHtml(label)}</span><strong>${escapeHtml(value)}</strong></div>`).join('')}</div>${panel('Upcoming departures', table(['Date','Tour','Seats'], departureRows))}${panel('Newest trip requests', table(['Name','Email','Status','Received'], requestRows))}`);
}

function tourPayload(form) {
  const data = Object.fromEntries(new FormData(form));
  for (const lang of ['en','ru','hy']) data[`highlights_${lang}`] = data[`highlights_${lang}`].split('\n').map(value => value.trim()).filter(Boolean);
  data.price_amd = Number(data.price_amd); data.max_group = Number(data.max_group); data.sort_order = Number(data.sort_order || 0);
  return data;
}
function tourForm(tour = {}) {
  const fields = [
    ['slug','URL slug',tour.slug || ''],['category','Category',tour.category || 'Culture'],['duration','Duration',tour.duration || '1 day'],['price_amd','Price (AMD)',tour.price_amd || 0],['difficulty','Difficulty',tour.difficulty || 'easy'],['max_group','Maximum group',tour.max_group || 8],['sort_order','Display order',tour.sort_order || 0],
    ['name_en','Name - English',tour.name_en || ''],['description_en','Description - English',tour.description_en || ''],['highlights_en','Highlights - English (one per line)',(tour.highlights_en || []).join('\n')],
    ['name_ru','Name - Russian',tour.name_ru || ''],['description_ru','Description - Russian',tour.description_ru || ''],['highlights_ru','Highlights - Russian (one per line)',(tour.highlights_ru || []).join('\n')],
    ['name_hy','Name - Armenian',tour.name_hy || ''],['description_hy','Description - Armenian',tour.description_hy || ''],['highlights_hy','Highlights - Armenian (one per line)',(tour.highlights_hy || []).join('\n')]
  ];
  const cardImageEditor = tour.id ? `<section class="wide settings-section"><h3>Tour card background</h3><p class="empty">This image appears behind this tour’s banner on the homepage and tour cards.</p>${tour.card_image_url ? `<div class="photo"><img src="${escapeHtml(window.hayqApiUrl(tour.card_image_url))}" alt="Current ${escapeHtml(tour.name_en)} card background"></div>` : '<p class="empty">Using the default illustrated background.</p>'}<form id="tourCardImageForm" data-tour-id="${tour.id}" class="toolbar"><label>Choose image<input type="file" name="photos" accept="image/jpeg,image/png,image/webp" required></label><button class="primary">Upload card background</button>${tour.card_image_url ? '<button class="small-btn danger" type="button" data-remove-tour-card-image>Restore default</button>' : ''}<span class="badge">JPG, PNG, WebP · max 5 MB</span></form></section>` : '';
  return `<form class="editor" id="tourForm" data-id="${tour.id || ''}"><h2>${tour.id ? 'Edit tour' : 'New tour'}</h2><div class="form-grid">${fields.map(([name,label,value]) => `<label class="${name.startsWith('description') || name.startsWith('highlights') ? 'wide' : ''}">${escapeHtml(label)}${name.startsWith('description') || name.startsWith('highlights') ? `<textarea name="${name}" rows="${name.startsWith('description') ? 3 : 2}" required>${escapeHtml(value)}</textarea>` : `<input name="${name}" value="${escapeHtml(value)}" ${['price_amd','max_group','sort_order'].includes(name) ? 'type="number" min="0"' : 'required'}>`}</label>`).join('')}
      <label>Status<select name="status"><option value="draft" ${tour.status === 'draft' ? 'selected' : ''}>Draft / hidden</option><option value="published" ${!tour.status || tour.status === 'published' ? 'selected' : ''}>Published</option></select></label></div><div class="toolbar">${formButton(tour.id ? 'Update tour' : 'Create tour')}<button class="small-btn" type="button" data-cancel-editor>Cancel</button></div></form>${cardImageEditor}`;
}
async function showTours(editTour = null) {
  toursCache = await request('/tours');
  const rows = toursCache.map(tour => `<tr><td>${tour.id}</td><td><strong>${escapeHtml(tour.name_en)}</strong><br><span class="badge">/${escapeHtml(tour.slug)}</span></td><td>${escapeHtml(tour.category)} · ${escapeHtml(tour.duration)}</td><td>${Number(tour.price_amd).toLocaleString()} AMD</td><td>${badge(tour.status)}</td><td><div class="row-actions"><button class="small-btn" data-edit-tour="${tour.id}">Edit</button><button class="small-btn" data-duplicate-tour="${tour.id}">Duplicate</button><button class="small-btn danger" data-delete-tour="${tour.id}">Delete</button></div></td></tr>`).join('');
  setView('Tours', `${editTour !== null ? tourForm(editTour || {}) : ''}${panel('Tours', table(['ID','Tour','Category','Price','Visibility','Actions'], rows), '<button class="primary" data-new-tour>New tour</button>')}`);
}
function editTourById(id) { return showTours(toursCache.find(tour => tour.id === id) || null); }
function onTourForm(event) {
  if (event.target.id !== 'tourForm') return;
  event.preventDefault();
  const form = event.target, id = form.dataset.id;
  request(id ? `/tours/${id}` : '/tours', { method: id ? 'PUT' : 'POST', body: JSON.stringify(tourPayload(form)) }).then(() => { setNotice('Tour saved.', true); return showTours(); }).catch(error => setNotice(error.message));
}

async function renderDepartures(tourId) {
  const [departures, photos] = await Promise.all([request(`/tours/${tourId}/departures`), request(`/tours/${tourId}/photos`)]);
  const departureRows = departures.map(departure => `<div class="departure-row"><input type="date" value="${escapeHtml(departure.date)}" data-departure-date="${departure.id}"><input type="number" min="${departure.seats_taken}" value="${departure.seats_total}" data-departure-seats="${departure.id}"><button class="small-btn" data-save-departure="${departure.id}">Save</button><span>${departure.seats_taken} reserved</span><button class="small-btn danger" data-delete-departure="${departure.id}">Delete</button></div>`).join('');
  const photoHtml = photos.map(photo => `<div class="photo"><img src="${escapeHtml(window.hayqApiUrl(photo.url))}" alt="${escapeHtml(photo.alt_en)}"><input aria-label="Photo alternative text" data-photo-alt="${photo.id}" value="${escapeHtml(photo.alt_en)}"><input aria-label="Photo order" type="number" min="0" data-photo-order="${photo.id}" value="${photo.sort_order}"><button class="small-btn" data-save-photo="${photo.id}">Save details</button><button class="small-btn danger" data-delete-photo="${photo.id}">Remove</button></div>`).join('');
  return `${panel('Departures', `${departureRows || '<p class="empty">No departures yet.</p>'}<form class="departure-row" id="departureForm" data-tour-id="${tourId}"><input type="date" name="date" required><input type="number" name="seats_total" min="1" max="200" value="12" required><button class="primary">Add date</button></form>`)}${panel('Photos', `<form id="photoForm" data-tour-id="${tourId}" class="toolbar"><input type="file" name="photos" accept="image/jpeg,image/png,image/webp" multiple required><button class="primary">Upload photos</button><span class="badge">JPG, PNG, WebP · max 5 MB each</span></form><div class="photo-list">${photoHtml}</div>`)}`;
}

async function showBookings(filters = {}) {
  if (!toursCache.length) toursCache = await request('/tours');
  const query = new URLSearchParams(Object.entries(filters).filter(([,value]) => value));
  const rows = await request(`/bookings?${query}`);
  const statuses = ['pending','confirmed','paid','cancelled','completed'];
  const html = rows.map(booking => `<tr><td><strong>${escapeHtml(booking.reference)}</strong><br>${escapeHtml(booking.created_at)}</td><td>${escapeHtml(booking.customer_name)}<br><a href="mailto:${escapeHtml(booking.email)}">${escapeHtml(booking.email)}</a><br>${escapeHtml(booking.phone)}</td><td>${booking.items.map(item => `${escapeHtml(item.tour_name || item.route_name)} · ${escapeHtml(item.date)} · ${item.kind === 'transfer' ? `${escapeHtml(item.vehicle)} · ${item.guests} passengers` : `${item.guests} guests`}`).join('<br>')}</td><td>${Number(booking.total_amd).toLocaleString()} AMD</td><td><select data-booking-status="${booking.id}">${statuses.map(status => `<option ${status === booking.status ? 'selected' : ''}>${status}</option>`).join('')}</select><textarea data-booking-notes="${booking.id}" rows="2" placeholder="Internal note">${escapeHtml(booking.internal_notes)}</textarea><button class="small-btn" data-save-booking="${booking.id}">Save</button></td><td><button class="small-btn" data-resend="${booking.id}">Resend email</button></td></tr>`).join('');
  setView('Bookings', `${panel('Bookings', `${table(['Reference','Customer','Trip','Total','Status and notes','Email'],html)}<div class="notice"></div>`)}<a class="action" href="/api/admin/bookings/export.csv" download>Export CSV</a><div class="toolbar" id="bookingFilters"><input name="q" placeholder="Search name, email, reference" value="${escapeHtml(filters.q || '')}"><select name="status"><option value="">All statuses</option>${statuses.map(status => `<option ${filters.status === status ? 'selected' : ''}>${status}</option>`).join('')}</select><select name="tour"><option value="">All tours</option>${toursCache.map(tour => `<option value="${tour.id}" ${String(filters.tour) === String(tour.id) ? 'selected' : ''}>${escapeHtml(tour.name_en)}</option>`).join('')}</select><input name="date" type="date" value="${escapeHtml(filters.date || '')}"><button class="primary" data-filter-bookings>Filter</button></div>`);
}
async function showRequests() {
  const requests = await request('/requests');
  const rows = requests.map(item => `<tr><td>${escapeHtml(item.name)}<br><a href="mailto:${escapeHtml(item.email)}">${escapeHtml(item.email)}</a></td><td>${escapeHtml(item.message)}</td><td>${badge(item.status)}</td><td><div class="row-actions"><button class="small-btn" data-reply-request="${item.id}">Reply by email</button><button class="small-btn" data-request-status="${item.id}" data-status="contacted">Mark contacted</button><button class="small-btn danger" data-delete-request="${item.id}">Delete</button></div></td></tr>`).join('');
  setView('Requests', panel('Custom trip requests', table(['Contact','Message','Status','Actions'],rows)));
}
async function showReviews() {
  const reviews = await request('/reviews');
  const rows = reviews.map(review => `<tr><td>${escapeHtml(review.name)}<br>${escapeHtml(review.tour_name || 'Any tour')}</td><td>${'★'.repeat(review.rating)} (${review.rating}/5)</td><td>${escapeHtml(review.text)}</td><td>${badge(review.approved ? 'approved' : 'pending')}</td><td><div class="row-actions">${review.approved ? '' : `<button class="small-btn" data-approve-review="${review.id}">Approve</button>`}<button class="small-btn danger" data-delete-review="${review.id}">Delete</button></div></td></tr>`).join('');
  setView('Reviews', panel('Review moderation', table(['Author','Rating','Review','State','Actions'],rows)));
}
async function showAddons(editId = '') {
  addonCache = await request('/addons');
  const addon = addonCache.find(item => item.id === editId);
  const editor = editId ? `<form class="editor" id="addonForm" data-id="${escapeHtml(addon.id)}"><h2>Edit add-on</h2><div class="form-grid">${['name_en','name_ru','name_hy','price_amd'].map(key => `<label>${escapeHtml(key)}<input name="${key}" value="${escapeHtml(addon[key])}" required></label>`).join('')}<label>Charge type<select name="price_type"><option value="per_person" ${addon.price_type === 'per_person' ? 'selected' : ''}>Per person</option><option value="per_booking" ${addon.price_type !== 'per_person' ? 'selected' : ''}>Per booking</option></select></label><label>Active<select name="active"><option value="1" ${addon.active ? 'selected' : ''}>Yes</option><option value="0" ${!addon.active ? 'selected' : ''}>No</option></select></label></div><div class="toolbar">${formButton('Save add-on')}</div></form>` : `<form class="toolbar" id="addonCreate"><input name="id" placeholder="id" required><input name="name_en" placeholder="Name (English)" required><input name="name_ru" placeholder="Name (Russian)"><input name="name_hy" placeholder="Name (Armenian)"><input name="price_amd" type="number" min="0" placeholder="Price AMD" required><select name="price_type"><option value="per_person">Per person</option><option value="per_booking">Per booking</option></select><button class="primary">Add add-on</button></form>`;
  const rows = addonCache.map(item => `<tr><td>${escapeHtml(item.id)}</td><td>${escapeHtml(item.name_en)}<br><span class="badge">${escapeHtml(item.name_ru)} · ${escapeHtml(item.name_hy)}</span></td><td>${Number(item.price_amd).toLocaleString()} AMD · ${item.price_type === 'per_person' ? 'per person' : 'per booking'}</td><td>${item.active ? 'Active' : 'Hidden'}</td><td><button class="small-btn" data-edit-addon="${escapeHtml(item.id)}">Edit</button><button class="small-btn danger" data-delete-addon="${escapeHtml(item.id)}">Delete</button></td></tr>`).join('');
  setView('Add-ons', `${editor}${panel('Add-ons',table(['ID','Names','Price','State','Actions'],rows))}`);
}
async function showServices(editId = '') {
  serviceCache = await request('/services');
  const service = serviceCache.find(item => item.id === Number(editId));
  const selectedIcon = service?.icon || 'map-pin';
  const editor = service ? `<form class="editor" id="serviceForm" data-id="${service.id}"><h2>Edit service</h2><div class="form-grid">
    ${['name_en','description_en','name_ru','description_ru','name_hy','description_hy','sort_order'].map(key => `<label>${escapeHtml(key)}<input name="${key}" value="${escapeHtml(service[key])}" required></label>`).join('')}
    <label class="wide">Icon<input type="hidden" name="icon" value="${escapeHtml(selectedIcon)}"><div class="icon-picker-wrap">${serviceIconButtons(selectedIcon)}</div></label>
    <label>Active<select name="active"><option value="1" ${service.active ? 'selected' : ''}>Yes</option><option value="0" ${!service.active ? 'selected' : ''}>No</option></select></label>
  </div><div class="toolbar">${formButton('Save service')}</div></form>` : `<form class="editor" id="serviceCreate"><h2>New service</h2><div class="form-grid">
    ${['name_en','description_en','name_ru','description_ru','name_hy','description_hy','sort_order'].map(key => `<label>${escapeHtml(key)}<input name="${key}" ${key === 'sort_order' ? 'value="0"' : ''} required></label>`).join('')}
    <label class="wide">Icon<input type="hidden" name="icon" value="map-pin"><div class="icon-picker-wrap">${serviceIconButtons('map-pin')}</div></label>
  </div><div class="toolbar">${formButton('Add service')}</div></form>`;
  const rows = serviceCache.map(item => `<tr><td>${escapeHtml(item.name_en)}</td><td>${escapeHtml(item.description_en)}</td><td>${item.active ? 'Active' : 'Hidden'}</td><td><button class="small-btn" data-edit-service="${item.id}">Edit</button><button class="small-btn danger" data-delete-service="${item.id}">Delete</button></td></tr>`).join('');
  setView('Services', `${editor}${panel('Services',table(['Name','Description','State','Actions'],rows))}`);
}
async function showSettings() {
  const settings = await request('/settings');
  const textKeys = ['hero_text','hero_text_ru','hero_text_hy','about_text','about_text_ru','about_text_hy'];
  const copyKeys = ['landing_copy_en','landing_copy_ru','landing_copy_hy'];
  const keys = ['brand_name','logo_url','contact_phone','whatsapp','telegram','contact_email','usd_rate',...textKeys];
  let transferRoutes;
  let transferExtras;
  try {
    transferRoutes = JSON.parse(settings.transfer_routes || '[]');
    transferExtras = JSON.parse(settings.transfer_extras || '[]');
  } catch {
    throw new Error('Transfer settings are invalid JSON. Please contact your developer to repair them.');
  }
  if (!Array.isArray(transferRoutes) || transferRoutes.length !== 4 || !Array.isArray(transferExtras)) {
    throw new Error('Transfer settings have an invalid structure. Please contact your developer to repair them.');
  }
  const sections = keys.map(key => {
    const wide = textKeys.some(value => value === key);
    const value = settings[key] || '';
    return `<label class="${wide ? 'wide' : ''}">${escapeHtml(key.replaceAll('_',' '))}${wide ? `<textarea name="${key}" rows="3">${escapeHtml(value)}</textarea>` : `<input name="${key}" value="${escapeHtml(value)}" ${key === 'usd_rate' ? 'type="number" min="1"' : ''}>`}</label>`;
  }).join('');
  const copyEditor = landingCopyEditor(settings);
  setView('Settings', `<form id="settingsForm" class="editor"><h2>Site and homepage content</h2><p class="empty">Homepage copy is saved per language. Edit each transfer route and fare below; tour cards and prices continue to come from Tours.</p><div class="form-grid">${sections}${transferSettingsEditor(transferRoutes, transferExtras)}<section class="wide settings-section"><h3>Homepage copy by language</h3>${copyEditor}</section></div><div class="toolbar">${formButton('Save settings')}</div></form><form id="logoForm" class="toolbar"><label>Upload logo image<input type="file" name="photos" accept="image/jpeg,image/png,image/webp" required></label><button class="primary">Upload logo</button><span class="badge">JPG, PNG, WebP · max 5 MB</span></form><section class="editor"><h2>Tours card background image</h2><p class="empty">This image appears in the Tours card on the homepage. Upload a JPG, PNG, or WebP image up to 5 MB.</p>${settings.tours_background_url ? `<div class="photo"><img src="${escapeHtml(window.hayqApiUrl(settings.tours_background_url))}" alt="Current Tours card background"></div>` : '<p class="empty">Using the default Tours illustration.</p>'}<form id="toursBackgroundForm" class="toolbar"><label>Choose image<input type="file" name="photos" accept="image/jpeg,image/png,image/webp" required></label><button class="primary">Upload Tours background</button>${settings.tours_background_url ? '<button class="small-btn danger" type="button" data-remove-tours-background>Restore default illustration</button>' : ''}</form></section><form id="passwordForm" class="editor"><h2>Change password</h2><div class="form-grid"><label>Current password<input type="password" name="current_password" autocomplete="current-password" required></label><label>New password (12+ characters)<input type="password" name="new_password" minlength="12" autocomplete="new-password" required></label></div><div class="toolbar">${formButton('Update password')}</div></form>`);
}
async function showUsers() {
  const users = await request('/users');
  const rows = users.map(user => `<tr><td>${escapeHtml(user.email)}</td><td>${badge(user.role)}</td><td>${escapeHtml(user.created_at)}</td><td>${user.id === currentUser.id ? 'Current account' : `<button class="small-btn danger" data-delete-user="${user.id}">Remove</button>`}</td></tr>`).join('');
  setView('Users', `<form class="toolbar" id="userForm"><input name="email" type="email" placeholder="Email" required><input name="password" type="password" minlength="12" placeholder="Temporary password (12+ chars)" required><select name="role"><option value="staff">Staff</option><option value="owner">Owner</option></select><button class="primary">Add user</button></form>${panel('Admin users',table(['Email','Role','Created','Actions'],rows))}`);
}

async function resizeImage(file) {
  if (!['image/jpeg','image/png','image/webp'].includes(file.type) || file.size > 5 * 1024 * 1024) throw new Error('Choose JPG, PNG, or WebP images no larger than 5 MB.');
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, 2000 / bitmap.width, 1600 / bitmap.height);
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bitmap.width * scale); canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext('2d').drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/webp', 0.84));
  if (!blob || blob.size > 5 * 1024 * 1024) throw new Error('Image conversion failed. Try a smaller image.');
  return new File([blob], `${file.name.replace(/\.[^.]+$/,'')}.webp`, { type: 'image/webp' });
}
async function uploadFiles(files, endpoint) {
  const form = new FormData();
  for (const original of files) form.append('photos', await resizeImage(original));
  return request(endpoint, { method: 'POST', body: form });
}

$('#loginForm').addEventListener('submit', async event => {
  event.preventDefault();
  const form = new FormData(event.currentTarget);
  $('#loginStatus').textContent = 'Signing in...';
  try {
    const response = await fetch(window.hayqApiUrl('/api/auth/login'), { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: form.get('email'), password: form.get('password') }) });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.error?.message || 'Sign-in failed.');
    const me = await fetch(window.hayqApiUrl('/api/auth/me'), { credentials: 'include' });
    const user = await me.json();
    if (!me.ok) throw new Error(user.error?.message || 'Sign-in failed.');
    showAdmin(user.data);
  } catch (error) { $('#loginStatus').textContent = error.message; }
});
$('#logoutBtn').addEventListener('click', async () => {
  try { await fetch(window.hayqApiUrl('/api/auth/logout'), { method: 'POST', credentials: 'include', headers: { 'X-CSRF-Token': csrfToken() } }); } finally { csrf = ''; showLogin(''); }
});
$('#adminNav').addEventListener('click', event => { const button = event.target.closest('[data-view]'); if (button) openView(button.dataset.view); });
$('#menuToggle').addEventListener('click', () => $('#sidebar').classList.toggle('open'));

root.addEventListener('click', async event => {
  const target = event.target.closest('button'); if (!target) return;
  if (target.matches('.icon-option')) {
    const form = target.closest('form');
    const hidden = form?.querySelector('input[name="icon"]');
    if (!hidden) return;
    hidden.value = target.dataset.iconKey;
    form.querySelectorAll('.icon-option').forEach(button => button.classList.toggle('selected', button.dataset.iconKey === hidden.value));
    return;
  }
  try {
    if (target.matches('[data-new-tour]')) return showTours({});
    if (target.matches('[data-cancel-editor]')) return showTours();
    if (target.matches('[data-edit-tour]')) return editTourById(Number(target.dataset.editTour));
    if (target.matches('[data-duplicate-tour]')) { const result = await request(`/tours/${target.dataset.duplicateTour}/duplicate`,{method:'POST',body:'{}'});setNotice(`Draft copy created: ${result.slug}`,true);return showTours(); }
    if (target.matches('[data-delete-tour]') && confirm('Delete this tour? Tours with bookings must be hidden instead.')) { await request(`/tours/${target.dataset.deleteTour}`,{method:'DELETE'});setNotice('Tour deleted.',true);return showTours(); }
    if (target.matches('[data-remove-tour-card-image]') && confirm('Restore the default background for this tour?')) { const id=Number(target.closest('#tourCardImageForm').dataset.tourId);await request(`/tours/${id}/card-image`,{method:'DELETE'});const tour=toursCache.find(item=>item.id===id);if(tour)tour.card_image_url='';setNotice('Tour card background restored.',true);return editTourById(id); }
    if (target.matches('[data-save-departure]')) { const id=target.dataset.saveDeparture;await request(`/departures/${id}`,{method:'PUT',body:JSON.stringify({date:$(`[data-departure-date="${id}"]`).value,seats_total:Number($(`[data-departure-seats="${id}"]`).value)})});setNotice('Departure updated.',true);return showTours(); }
    if (target.matches('[data-delete-departure]') && confirm('Delete this departure?')) { await request(`/departures/${target.dataset.deleteDeparture}`,{method:'DELETE'});setNotice('Departure removed.',true);return showTours(); }
    if (target.matches('[data-delete-photo]') && confirm('Remove this photo?')) { await request(`/photos/${target.dataset.deletePhoto}`,{method:'DELETE'});setNotice('Photo removed.',true);return showTours(); }
    if (target.matches('[data-save-photo]')) { const id=target.dataset.savePhoto;await request(`/photos/${id}`,{method:'PATCH',body:JSON.stringify({alt_en:$(`[data-photo-alt="${id}"]`).value,sort_order:Number($(`[data-photo-order="${id}"]`).value)})});setNotice('Photo details saved.',true);return showTours(); }
    if (target.matches('[data-filter-bookings]')) { const f=$('#bookingFilters');return showBookings(Object.fromEntries(new FormData(f))); }
    if (target.matches('[data-save-booking]')) { const id=target.dataset.saveBooking;await request(`/bookings/${id}`,{method:'PATCH',body:JSON.stringify({status:$(`[data-booking-status="${id}"]`).value,internal_notes:$(`[data-booking-notes="${id}"]`).value})});setNotice('Booking updated.',true);return showBookings(); }
    if (target.matches('[data-resend]')) { target.disabled=true;try{const result=await request(`/bookings/${target.dataset.resend}/resend`,{method:'POST',body:'{}'});showEmailResult(result,'Confirmation email sent.')}finally{target.disabled=false}return; }
    if (target.matches('[data-reply-request]')) { const subject=prompt('Email subject','Your Hayq Armenia trip');if(subject===null)return;const message=prompt('Reply message');if(message===null)return;target.disabled=true;try{const result=await request(`/requests/${target.dataset.replyRequest}/reply`,{method:'POST',body:JSON.stringify({subject,message})});showEmailResult(result,'Reply email sent.')}finally{target.disabled=false}return; }
    if (target.matches('[data-request-status]')) { await request(`/requests/${target.dataset.requestStatus}`,{method:'PATCH',body:JSON.stringify({status:target.dataset.status})});setNotice('Request updated.',true);return showRequests(); }
    if (target.matches('[data-delete-request]') && confirm('Delete this request?')) { await request(`/requests/${target.dataset.deleteRequest}`,{method:'DELETE'});setNotice('Request deleted.',true);return showRequests(); }
    if (target.matches('[data-approve-review]')) { await request(`/reviews/${target.dataset.approveReview}`,{method:'PATCH',body:JSON.stringify({approved:true})});setNotice('Review approved.',true);return showReviews(); }
    if (target.matches('[data-delete-review]') && confirm('Delete this review?')) { await request(`/reviews/${target.dataset.deleteReview}`,{method:'DELETE'});setNotice('Review deleted.',true);return showReviews(); }
    if (target.matches('[data-edit-addon]')) return showAddons(target.dataset.editAddon);
    if (target.matches('[data-delete-addon]') && confirm('Delete this add-on?')) { await request(`/addons/${encodeURIComponent(target.dataset.deleteAddon)}`,{method:'DELETE'});setNotice('Add-on deleted.',true);return showAddons(); }
    if (target.matches('[data-edit-service]')) return showServices(target.dataset.editService);
    if (target.matches('[data-delete-service]') && confirm('Delete this service?')) { await request(`/services/${target.dataset.deleteService}`,{method:'DELETE'});setNotice('Service deleted.',true);return showServices(); }
    if (target.matches('[data-delete-user]') && confirm('Remove this user?')) { await request(`/users/${target.dataset.deleteUser}`,{method:'DELETE'});setNotice('User removed.',true);return showUsers(); }
    if (target.matches('[data-remove-tours-background]') && confirm('Restore the default Tours illustration?')) { await request('/settings/tours-background',{method:'DELETE'});setNotice('Tours background restored.',true);return showSettings(); }
  } catch (error) { setNotice(error.message); }
});

root.addEventListener('submit', async event => {
  const form = event.target;
  try {
    if (form.id === 'tourForm') return await onTourForm(event);
    if (form.id === 'departureForm') { event.preventDefault();const d=Object.fromEntries(new FormData(form));d.seats_total=Number(d.seats_total);await request(`/tours/${form.dataset.tourId}/departures`,{method:'POST',body:JSON.stringify(d)});setNotice('Departure added.',true);return showTours(); }
    if (form.id === 'photoForm') { event.preventDefault();await uploadFiles([...form.querySelector('[type=file]').files],`/tours/${form.dataset.tourId}/photos`);setNotice('Photos uploaded.',true);return showTours(); }
    if (form.id === 'tourCardImageForm') { event.preventDefault();const id=Number(form.dataset.tourId);const result=await uploadFiles([form.querySelector('[type=file]').files[0]],`/tours/${id}/card-image`);const tour=toursCache.find(item=>item.id===id);if(tour)tour.card_image_url=result.url;setNotice('Tour card background uploaded.',true);return editTourById(id); }
    if (form.id === 'addonCreate' || form.id === 'addonForm') { event.preventDefault();const d=Object.fromEntries(new FormData(form));d.price_amd=Number(d.price_amd);d.active=d.active===undefined?true:d.active==='1';await request(form.id==='addonForm'?`/addons/${encodeURIComponent(form.dataset.id)}`:'/addons',{method:form.id==='addonForm'?'PUT':'POST',body:JSON.stringify(d)});setNotice('Add-on saved.',true);return showAddons(); }
    if (form.id === 'serviceCreate' || form.id === 'serviceForm') { event.preventDefault();const d=Object.fromEntries(new FormData(form));d.sort_order=Number(d.sort_order||0);d.active=d.active===undefined?true:d.active==='1';await request(form.id==='serviceForm'?`/services/${form.dataset.id}`:'/services',{method:form.id==='serviceForm'?'PUT':'POST',body:JSON.stringify(d)});setNotice('Service saved.',true);return showServices(); }
    if (form.id === 'settingsForm') {
      event.preventDefault();
      const fields = Object.fromEntries(new FormData(form));
      const current = await request('/settings');
      fields.transfer_routes = serializeConfig(form, 'transfer_routes', JSON.parse(current.transfer_routes));
      fields.transfer_extras = serializeConfig(form, 'transfer_extras', JSON.parse(current.transfer_extras));
      for (const key of ['landing_copy_en','landing_copy_ru','landing_copy_hy']) {
        fields[key] = serializeObjectConfig(form, key, JSON.parse(current[key]));
      }
      await request('/settings',{method:'PUT',body:JSON.stringify(fields)});
      setNotice('Settings saved.',true);
      return showSettings();
    }
    if (form.id === 'logoForm') { event.preventDefault();const file=form.querySelector('[type=file]').files[0];await uploadFiles([file],'/settings/logo');setNotice('Logo uploaded.',true);return showSettings(); }
    if (form.id === 'toursBackgroundForm') { event.preventDefault();const file=form.querySelector('[type=file]').files[0];await uploadFiles([file],'/settings/tours-background');setNotice('Tours background uploaded.',true);return showSettings(); }
    if (form.id === 'passwordForm') { event.preventDefault();await request('/me/password',{method:'POST',body:JSON.stringify(Object.fromEntries(new FormData(form)))});setNotice('Password updated. Use it next time you sign in.',true);return showSettings(); }
    if (form.id === 'userForm') { event.preventDefault();const d=Object.fromEntries(new FormData(form));await request('/users',{method:'POST',body:JSON.stringify(d)});setNotice('User added.',true);return showUsers(); }
  } catch (error) { setNotice(error.message); }
});

root.addEventListener('click', event => {
  const exportLink = event.target.closest('a[download]');
  if (exportLink) {
    event.preventDefault();
    fetch(window.hayqApiUrl('/api/admin/bookings/export.csv'),{credentials:'include'}).then(response=>{if(!response.ok)throw new Error('Export failed.');return response.blob()}).then(blob=>{const link=document.createElement('a');link.href=URL.createObjectURL(blob);link.download='hayq-bookings.csv';link.click();URL.revokeObjectURL(link.href)}).catch(error=>setNotice(error.message));
  }
});

$('#loginView').hidden = false;
(async () => {
  try { const response=await fetch(window.hayqApiUrl('/api/auth/me'),{credentials:'include'});if(response.ok){const payload=await response.json();showAdmin(payload.data)} }
  catch { showLogin(); }
})();
