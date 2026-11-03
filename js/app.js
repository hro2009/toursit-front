import { api, assetUrl, byId, escapeHtml, state } from './api.js';
import { setLanguage, t } from './i18n.js';
import { loadTours, renderTours } from './tours.js';
import { drawCart } from './cart.js';

function getLandingCopy() {
  const raw = state.settings[`landing_copy_${state.language}`] || state.settings.landing_copy_en;
  return raw ? JSON.parse(raw) : {};
}

function applyLandingCopy(copy) {
  document.querySelectorAll('[data-copy]').forEach(element => {
    const value = copy[element.dataset.copy];
    if (typeof value === 'string') element.textContent = value;
  });
}

function applySettings() {
  const settings = state.settings;
  const copy = getLandingCopy();
  const heading = byId('heroTitle');
  const title = copy.heroTitle || settings[`hero_title_${state.language}`] || settings.hero_title || "Land. We'll handle the rest.";
  heading.replaceChildren(...title.split(/\s+/).map((word, index) => {
    const span = document.createElement('span');
    span.textContent = word;
    span.style.setProperty('--i', index);
    return span;
  }));
  byId('heroText').textContent = settings[`hero_text_${state.language}`] || settings.hero_text || '';
  const brand = settings.brand_name || 'Hayq';
  const logo = byId('brandLogo');
  if (settings.logo_url) logo.innerHTML = `<img src="${escapeHtml(assetUrl(settings.logo_url))}" alt="${escapeHtml(brand)}">`;
  else logo.textContent = brand;
  const tourArtwork = document.querySelector('#sB .service-art');
  const previousBackground = tourArtwork.querySelector('.custom-background-image');
  if (previousBackground) previousBackground.remove();
  tourArtwork.classList.toggle('has-custom-background', Boolean(settings.tours_background_url));
  if (settings.tours_background_url) {
    const image = document.createElementNS('http://www.w3.org/2000/svg', 'image');
    image.classList.add('custom-background-image');
    image.setAttribute('href', assetUrl(settings.tours_background_url));
    image.setAttribute('x', '0');
    image.setAttribute('y', '0');
    image.setAttribute('width', '400');
    image.setAttribute('height', '220');
    image.setAttribute('preserveAspectRatio', 'xMidYMid slice');
    tourArtwork.append(image);
  }
  byId('footerText').textContent = `© ${new Date().getFullYear()} ${brand} · ${t('currencyFooter')}`;
  applyLandingCopy(copy);
}

async function loadPageData() {
  const [settings, addons] = await Promise.all([api('/settings'), api(`/addons?lang=${state.language}`)]);
  state.settings = settings;
  state.addons = addons;
  await loadTours();
  applySettings();
  drawCart(false);
  document.dispatchEvent(new CustomEvent('hayq:site-data'));
}

byId('currencyBtn').addEventListener('click', () => {
  state.currency = state.currency === 'AMD' ? 'USD' : 'AMD';
  localStorage.setItem('hayq-currency', state.currency);
  byId('currencyBtn').textContent = state.currency;
  renderTours();
  drawCart(false);
  document.dispatchEvent(new CustomEvent('hayq:currency-change'));
});
byId('currencyBtn').textContent = state.currency = localStorage.getItem('hayq-currency') === 'USD' ? 'USD' : 'AMD';

const siteNav = document.querySelector('.site-nav');
const updateSiteNav = () => siteNav.classList.toggle('is-scrolled', window.scrollY > 24);
window.addEventListener('scroll', updateSiteNav, { passive: true });
updateSiteNav();

const theme = localStorage.getItem('hayq-theme');
if (theme === 'light' || theme === 'dark') document.documentElement.dataset.theme = theme;
byId('themeBtn').addEventListener('click', () => {
  const next = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
  document.documentElement.dataset.theme = next;
  localStorage.setItem('hayq-theme', next);
});
byId('language').addEventListener('change', async event => {
  await setLanguage(event.target.value);
  try { await loadPageData(); } catch (error) { byId('siteStatus').textContent = error.message; }
});

document.addEventListener('hayq:language', () => {
  renderTours();
  drawCart(false);
  applySettings();
});

byId('planForm').addEventListener('submit', async event => {
  event.preventDefault();
  const form = event.currentTarget;
  const status = byId('planStatus');
  const button = form.querySelector('[type="submit"]');
  const startDate = byId('planStartDate').value;
  const endDate = byId('planEndDate').value;
  if (startDate > endDate) {
    status.textContent = t('dateOrderError');
    byId('planEndDate').focus();
    return;
  }
  button.disabled = true;
  try {
    const mode = document.querySelector('[data-plan-mode][aria-pressed="true"]')?.dataset.planMode || 'transfer';
    const planSelect = mode === 'tour' ? byId('planTour') : byId('planRoute');
    const details = [
      `${t('serviceLabel')}: ${t(mode === 'tour' ? 'customTour' : 'customTransfer')}`,
      `${t(mode === 'tour' ? 'customTour' : 'routeLabel')}: ${planSelect.selectedOptions[0]?.textContent || ''}`,
      `${t('travelersLabel')}: ${byId('planTravelers').value}`,
      `${t('travelDatesLabel')}: ${startDate} to ${endDate}`,
      '',
      byId('planMessage').value
    ].join('\n');
    await api('/requests', { method: 'POST', body: JSON.stringify({ name: byId('planName').value, email: byId('planEmail').value, message: details }) });
    status.textContent = t('requestSent');
    form.reset();
    setPlanMode('transfer');
  } catch (error) { status.textContent = error.message; }
  finally { button.disabled = false; }
});

byId('planStartDate').addEventListener('change', event => {
  byId('planEndDate').min = event.currentTarget.value;
});

function setPlanMode(mode) {
  const tourMode = mode === 'tour';
  document.querySelectorAll('[data-plan-mode]').forEach(button => {
    button.setAttribute('aria-pressed', String(button.dataset.planMode === mode));
  });
  document.querySelectorAll('[data-plan-panel]').forEach(panel => {
    const hidden = panel.dataset.planPanel !== mode;
    panel.hidden = hidden;
    panel.querySelectorAll('select,input').forEach(input => {
      input.disabled = hidden;
      input.required = !hidden;
    });
  });
  byId('planService').value = tourMode ? 'Guided tours' : 'Airport meet and transfers';
  byId('planTravelers').min = tourMode ? '2' : '1';
  if (tourMode && Number(byId('planTravelers').value) < 2) byId('planTravelers').value = '2';
}

document.querySelectorAll('[data-plan-mode]').forEach(button => {
  button.addEventListener('click', () => setPlanMode(button.dataset.planMode));
});
setPlanMode('transfer');

async function start() {
  await setLanguage(localStorage.getItem('hayq-language') || 'en');
  try { await loadPageData(); }
  catch (error) { byId('siteStatus').textContent = error.message; }
  const logo = byId('brandLogo');
  if (state.settings.brand_name) logo.textContent = state.settings.brand_name;
  applySettings();
  const payment = new URLSearchParams(location.search).get('payment');
  if (payment === 'cancelled') byId('siteStatus').textContent = t('sendError');
  if (payment === 'success') byId('siteStatus').textContent = t('bookingReceived');
}

start();
