// Live tour and add-on prices stay authoritative in the existing API/database.
// Airport transfer fares are not configured, so the routes below request quotes.
import './js/app.js';
import { addCartItem } from './js/cart.js';
import { api, byId, escapeHtml, money, state } from './js/api.js';
import { t } from './js/i18n.js';

const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
const serviceCards = [...document.querySelectorAll('.service-card')];
const hero = byId('hero');
const scene = byId('scene');
let pointerX = 0;
let pointerY = 0;
let frame = 0;

function updateScene() {
  frame = 0;
  if (!hero || !scene) return;
  const offset = Math.min(Math.max(-hero.getBoundingClientRect().top, 0), innerHeight);
  scene.style.transform = `translate3d(0, ${offset * .16}px, 0) rotateY(${pointerX * 6}deg) rotateX(${-pointerY * 4}deg)`;
  scene.querySelectorAll('[data-depth]').forEach(layer => {
    layer.style.setProperty('--layer-shift', `${offset * Number(layer.dataset.depth)}px`);
  });
}

function requestSceneUpdate() {
  if (!frame) frame = requestAnimationFrame(updateScene);
}

if (hero && scene) {
  if (!reducedMotion) {
    window.addEventListener('scroll', requestSceneUpdate, { passive: true });
    if (matchMedia('(hover: hover)').matches) {
      hero.addEventListener('pointermove', event => {
        pointerX = event.clientX / innerWidth - .5;
        pointerY = event.clientY / innerHeight - .5;
        requestSceneUpdate();
      });
      hero.addEventListener('pointerleave', () => {
        pointerX = 0;
        pointerY = 0;
        requestSceneUpdate();
      });
    }
  }
  new IntersectionObserver(([entry]) => {
    hero.classList.toggle('off', !entry.isIntersecting);
    if (entry.isIntersecting) requestSceneUpdate();
  }).observe(hero);
}

function setServicePanel(panelId, forceOpen = false) {
  serviceCards.forEach(card => {
    const panel = byId(card.getAttribute('aria-controls'));
    const shouldOpen = panel.id === panelId
      && (forceOpen || card.getAttribute('aria-expanded') !== 'true');
    card.setAttribute('aria-expanded', String(shouldOpen));
    panel.classList.toggle('open', shouldOpen);
    if (shouldOpen) {
      window.setTimeout(() => panel.scrollIntoView({
        behavior: reducedMotion ? 'auto' : 'smooth',
        block: 'nearest'
      }), 180);
    }
  });
}

serviceCards.forEach(card => {
  card.addEventListener('click', () => setServicePanel(card.getAttribute('aria-controls')));
  if (reducedMotion || matchMedia('(hover: none)').matches) return;
  card.addEventListener('pointermove', event => {
    const bounds = card.getBoundingClientRect();
    const x = (event.clientX - bounds.left) / bounds.width - .5;
    const y = (event.clientY - bounds.top) / bounds.height - .5;
    card.style.setProperty('--tilt-x', `${-y * 6}deg`);
    card.style.setProperty('--tilt-y', `${x * 7}deg`);
  });
  card.addEventListener('pointerleave', () => {
    card.style.removeProperty('--tilt-x');
    card.style.removeProperty('--tilt-y');
  });
});

document.addEventListener('click', event => {
  const opener = event.target.closest('[data-open]');
  if (opener) {
    event.preventDefault();
    setServicePanel(opener.dataset.open, true);
  }
});

const transferDialog = byId('transferDialog');
const transferForm = byId('transferForm');
const passengerInput = byId('transferPassengers');
const transferStatus = byId('transferStatus');
const transferSubmit = transferForm.querySelector('[type="submit"]');
let transferRoutes = [];
let transferExtras = [];
let activeTransferRoute = null;

function routeFrom(route, lang) {
  return route[`from_${lang}`] || route.from;
}

function routeTo(route, lang) {
  return route[`to_${lang}`] || route.to;
}

function renderTransferRoutes() {
  try {
    transferRoutes = JSON.parse(state.settings.transfer_routes || '[]');
    transferExtras = JSON.parse(state.settings.transfer_extras || '[]');
  } catch (error) {
    console.error('Transfer route settings are invalid.', error);
    byId('transferRoutes').textContent = t('routesUnavailable');
    return;
  }
  const lang = state.language;
  const airportGroups = new Map();
  transferRoutes.forEach((route, index) => {
    const airport = route[`airport_${lang}`] || route.airport;
    const group = airportGroups.get(airport) || [];
    group.push({ route, index });
    airportGroups.set(airport, group);
  });
  byId('transferRoutes').innerHTML = [...airportGroups].map(([airport, routes]) => `<section class="transfer-group"><h4 class="route-group-title">${escapeHtml(airport)}</h4><div class="route-grid">${routes.map(({ route }) => `<article class="route-ticket">
    <div class="route-line"><span>${escapeHtml(routeFrom(route, lang))}</span><span class="route-track"><i></i></span><span>${escapeHtml(routeTo(route, lang))}</span></div>
    <p>${escapeHtml(t('about'))} ${escapeHtml(route.distance)}, ${escapeHtml(route.duration)}</p>
    <div class="vehicle-prices"><span>${escapeHtml(t('sedanCapacity'))}</span><b>${route.sedan_amd > 0 ? money(route.sedan_amd) : escapeHtml(t('priceOnRequest'))}</b>
    <span>${escapeHtml(t('minivanCapacity'))}</span><b>${route.minivan_amd > 0 ? money(route.minivan_amd) : escapeHtml(t('priceOnRequest'))}</b></div>
    <button class="btn" type="button" data-route-book="${escapeHtml(route.id)}">${escapeHtml(t('bookRide'))}</button></article>`).join('')}</div></section>`).join('');

  byId('transferRoute').innerHTML = transferRoutes.map(route => `<option value="${escapeHtml(route.id)}">${escapeHtml(routeFrom(route, lang))} ${escapeHtml(t('routeTo'))} ${escapeHtml(routeTo(route, lang))}</option>`).join('');
  byId('planRoute').innerHTML = transferRoutes.map(route => `<option value="${escapeHtml(route.id)}">${escapeHtml(routeFrom(route, lang))} ${escapeHtml(t('routeTo'))} ${escapeHtml(routeTo(route, lang))}</option>`).join('');
  byId('transferExtras').innerHTML = transferExtras.map(extra => `<label class="option-row"><input type="checkbox" name="transferExtra" value="${escapeHtml(extra.id)}"><span>${escapeHtml(extra[`name_${lang}`] || extra.name_en)} · +${money(extra.price_amd)}</span></label>`).join('');
  if (activeTransferRoute) {
    byId('transferRoute').value = activeTransferRoute;
    updateTransferTotal();
  }
}

function syncPassengerLimit() {
  const maxPassengers = selectedTransferVehicle() === 'minivan' ? 7 : 3;
  passengerInput.max = String(maxPassengers);
  if (Number(passengerInput.value) > maxPassengers) passengerInput.value = String(maxPassengers);
  updateTransferTotal();
}

transferForm.querySelectorAll('[name="transferVehicle"]').forEach(input => input.addEventListener('change', syncPassengerLimit));
document.addEventListener('click', event => {
  const bookButton = event.target.closest('[data-route-book]');
  if (!bookButton) return;
  activeTransferRoute = bookButton.dataset.routeBook;
  byId('transferRoute').value = activeTransferRoute;
  transferStatus.textContent = '';
  transferForm.reset();
  byId('transferRoute').value = activeTransferRoute;
  const localNow = new Date(Date.now() - new Date().getTimezoneOffset() * 60000);
  byId('transferDate').min = localNow.toISOString().slice(0, 16);
  syncPassengerLimit();
  transferDialog.showModal();
});

document.querySelectorAll('[data-transfer-close]').forEach(button => {
  button.addEventListener('click', () => transferDialog.close());
});
transferDialog.addEventListener('click', event => {
  if (event.target === transferDialog) transferDialog.close();
});
transferForm.addEventListener('input', () => {
  if (transferStatus.textContent) transferStatus.textContent = '';
  updateTransferTotal();
});
transferForm.addEventListener('change', updateTransferTotal);

function selectedRoute() {
  return transferRoutes.find(route => route.id === byId('transferRoute').value);
}

function selectedTransferVehicle() {
  return transferForm.querySelector('[name="transferVehicle"]:checked')?.value || 'sedan';
}

function updateTransferTotal() {
  const route = selectedRoute();
  const vehicle = selectedTransferVehicle();
  const unitPrice = Number(vehicle === 'sedan' ? route?.sedan_amd : route?.minivan_amd) || 0;
  transferForm.querySelectorAll('[data-vehicle-price]').forEach(price => {
    const value = Number(price.dataset.vehiclePrice === 'sedan' ? route?.sedan_amd : route?.minivan_amd) || 0;
    price.textContent = value > 0 ? money(value) : t('priceOnRequest');
  });
  const extras = [...transferForm.querySelectorAll('[name="transferExtra"]:checked')]
    .reduce((sum, input) => sum + (Number(transferExtras.find(extra => extra.id === input.value)?.price_amd) || 0), 0);
  const quoteRequired = unitPrice <= 0;
  const contact = byId('transferContact');
  contact.hidden = !quoteRequired;
  byId('transferName').required = quoteRequired;
  byId('transferEmail').required = quoteRequired;
  byId('transferQuoteNote').hidden = !quoteRequired;
  byId('transferTotal').textContent = quoteRequired ? t('priceOnRequest') : money(unitPrice + extras);
  transferSubmit.textContent = quoteRequired ? t('requestQuote') : t('addToCart');
  byId('transferHeading').textContent = quoteRequired ? t('requestTransferQuote') : t('bookTransfer');
}

transferForm.addEventListener('submit', async event => {
  event.preventDefault();
  syncPassengerLimit();
  const route = selectedRoute();
  if (!route) return;
  const vehicle = selectedTransferVehicle();
  const unitPrice = Number(vehicle === 'sedan' ? route.sedan_amd : route.minivan_amd) || 0;
  const extraIds = [...transferForm.querySelectorAll('[name="transferExtra"]:checked')].map(input => input.value);
  if (unitPrice > 0) {
    transferDialog.close();
    addCartItem({
      type: 'transfer',
      route_id: route.id,
      route_name: `${route.from} to ${route.to}`,
      date: byId('transferDate').value,
      vehicle,
      passengers: Number(passengerInput.value),
      flight_number: byId('transferFlight').value,
      pickup_address: byId('transferAddress').value,
      extra_ids: extraIds,
      unit_price_amd: unitPrice
    });
    return;
  }
  const extras = extraIds.map(id => transferExtras.find(extra => extra.id === id)?.name_en).filter(Boolean);
  const message = [
    'Airport transfer quote request',
    `Route: ${route.from} to ${route.to}`,
    `Vehicle: ${vehicle}`,
    `Passengers: ${passengerInput.value}`,
    `Date and time: ${byId('transferDate').value}`,
    `Flight: ${byId('transferFlight').value || 'Not provided'}`,
    `Hotel or pickup address: ${byId('transferAddress').value}`,
    `Extras: ${extras.length ? extras.join(', ') : 'None'}`,
    'Please confirm the fixed price and availability.'
  ].join('\n');

  transferSubmit.disabled = true;
  transferStatus.textContent = t('quoteSending');
  try {
    await api('/requests', {
      method: 'POST',
      body: JSON.stringify({
        name: byId('transferName').value,
        email: byId('transferEmail').value,
        message
      })
    });
    transferStatus.textContent = t('quoteSent');
    transferForm.reset();
    syncPassengerLimit();
  } catch (error) {
    transferStatus.textContent = error.message || t('quoteError');
  } finally {
    transferSubmit.disabled = false;
  }
});

document.addEventListener('hayq:site-data', renderTransferRoutes);
document.addEventListener('hayq:currency-change', renderTransferRoutes);
if (state.settings.transfer_routes) renderTransferRoutes();
