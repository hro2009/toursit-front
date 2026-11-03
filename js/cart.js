import { api, byId, escapeHtml, money, state } from './api.js';
import { t } from './i18n.js';

let cart = [];
try {
  const stored = JSON.parse(localStorage.getItem('hayq') || '[]');
  cart = Array.isArray(stored) ? stored.filter(item => (
    Number.isInteger(item.tour_id) && Number.isInteger(item.departure_id) && Number.isInteger(item.guests) && Array.isArray(item.addon_ids)
  ) || (
    item?.type === 'transfer' && typeof item.route_id === 'string' && typeof item.date === 'string'
    && ['sedan', 'minivan'].includes(item.vehicle) && Number.isInteger(item.passengers) && Array.isArray(item.extra_ids)
    && Number.isSafeInteger(item.unit_price_amd)
  )) : [];
} catch { cart = []; }

function save() {
  try { localStorage.setItem('hayq', JSON.stringify(cart)); } catch { /* Storage can be disabled in private browsing. */ }
}

function itemTitle(item) {
  if (item.type === 'transfer') {
    const route = JSON.parse(state.settings.transfer_routes || '[]').find(value => value.id === item.route_id);
    if (!route) return item.route_name || `Transfer ${item.route_id}`;
    const from = route[`from_${state.language}`] || route.from;
    const to = route[`to_${state.language}`] || route.to;
    return `${from} ${t('routeTo')} ${to}`;
  }
  return state.tours.find(tour => tour.id === item.tour_id)?.name || `Tour #${item.tour_id}`;
}

export function addCartItem(item) {
  if (item.type === 'transfer') {
    cart.push({
      type: 'transfer',
      route_id: item.route_id,
      route_name: item.route_name,
      date: item.date,
      vehicle: item.vehicle,
      passengers: item.passengers,
      flight_number: item.flight_number || '',
      pickup_address: item.pickup_address || '',
      extra_ids: item.extra_ids || [],
      unit_price_amd: item.unit_price_amd
    });
  } else {
    cart.push({ type: 'tour', tour_id: item.tour_id, departure_id: item.departure_id, date: item.date, guests: item.guests, addon_ids: item.addon_ids });
  }
  save();
  byId('cartBtn').classList.remove('bump');
  void byId('cartBtn').offsetWidth;
  byId('cartBtn').classList.add('bump');
  drawCart(true);
}

function cartTotal() {
  return cart.reduce((sum, item) => {
    if (item.type === 'transfer') {
      const extras = JSON.parse(state.settings.transfer_extras || '[]');
      return sum + item.unit_price_amd + item.extra_ids.reduce((subtotal, id) => subtotal + (extras.find(extra => extra.id === id)?.price_amd || 0), 0);
    }
    const tour = state.tours.find(value => value.id === item.tour_id);
    const extras = item.addon_ids.reduce((subtotal, id) => {
      const addon = state.addons.find(value => value.id === id);
      return subtotal + (addon?.price_amd || 0) * (addon?.price_type === 'per_person' ? item.guests : 1);
    }, 0);
    return sum + (tour?.price_amd || 0) * item.guests + extras;
  }, 0);
}

function renderCartItems(withRemoveButtons = true) {
  return cart.map((item, index) => {
    if (item.type === 'transfer') {
      const extras = JSON.parse(state.settings.transfer_extras || '[]');
      const labels = item.extra_ids.map(id => extras.find(extra => extra.id === id)?.[`name_${state.language}`] || extras.find(extra => extra.id === id)?.name_en).filter(Boolean);
      const extraTotal = item.extra_ids.reduce((sum, id) => sum + (extras.find(extra => extra.id === id)?.price_amd || 0), 0);
      const vehicleName = t(item.vehicle === 'minivan' ? 'minivanName' : 'sedanName');
      return `<div class="item"><div><b>${escapeHtml(itemTitle(item))}</b><small>${escapeHtml(item.date)} · ${escapeHtml(vehicleName)} · ${item.passengers} ${escapeHtml(t('passengersLabel').toLowerCase())}${item.flight_number ? ` · ${escapeHtml(t('flightPrefix'))} ${escapeHtml(item.flight_number)}` : ''}${item.pickup_address ? ` · ${escapeHtml(item.pickup_address)}` : ''}${labels.length ? ` · ${escapeHtml(labels.join(', '))}` : ''}</small><button class="rm" data-remove="${index}">${escapeHtml(t('remove'))}</button></div><b>${money(item.unit_price_amd + extraTotal)}</b></div>`;
    }
    const labels = item.addon_ids.map(id => state.addons.find(addon => addon.id === id)?.name).filter(Boolean);
    const tour = state.tours.find(value => value.id === item.tour_id);
    const itemTotal = (tour?.price_amd || 0) * item.guests + item.addon_ids.reduce((sum, id) => {
      const addon = state.addons.find(value => value.id === id);
      return sum + (addon?.price_amd || 0) * (addon?.price_type === 'per_person' ? item.guests : 1);
    }, 0);
    return `<div class="item"><div><b>${escapeHtml(itemTitle(item))}</b><small>${escapeHtml(item.date)}, ${item.guests} ${escapeHtml(t(item.guests === 1 ? 'guestSingular' : 'guestPlural'))}${labels.length ? `, ${escapeHtml(labels.join(', '))}` : ''}</small>${withRemoveButtons ? `<button class="rm" data-remove="${index}">${escapeHtml(t('remove'))}</button>` : ''}</div><b>${money(itemTotal)}</b></div>`;
  }).join('');
}

export function drawCart(open = false) {
  byId('cartBtn').innerHTML = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 4h2l2.1 11.1a2 2 0 0 0 2 1.6h8.8a2 2 0 0 0 1.9-1.4L22 8H6" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/><circle cx="10" cy="20" r="1.3" fill="currentColor"/><circle cx="18" cy="20" r="1.3" fill="currentColor"/></svg><span class="cart-label">${escapeHtml(t('cartLabel'))}</span><span class="cart-count${cart.length ? '' : ' is-empty'}">${cart.length}</span>`;
  byId('cartBtn').setAttribute('aria-label', t('openCart'));
  const total = cartTotal();
  byId('drawer').innerHTML = `<div class="drawer-head"><h2 id="cartHeading">${escapeHtml(t('cartTitle'))}</h2><button class="pill" data-cart-close>${escapeHtml(t('close'))}</button></div>` +
    (cart.length ? renderCartItems() + `<div class="total cart-total"><span>${escapeHtml(t('total'))}</span><span>${money(total)}</span></div>
      <div class="cart-actions"><button class="btn" type="button" data-payment-open>Go to payment</button><button class="secondary-action" type="button" data-cart-close>Keep browsing</button></div>`
      : `<p class="sub cart-empty">${escapeHtml(t('cartEmpty'))}</p>`);
  if (open && !byId('drawer').open) byId('drawer').showModal();
}

function openPayment() {
  if (!cart.length) return;
  byId('checkoutSummary').innerHTML = `${renderCartItems(false)}<div class="total"><span>${escapeHtml(t('total'))}</span><span>${money(cartTotal())}</span></div>`;
  byId('checkoutSummary').hidden = false;
  byId('checkoutForm').hidden = false;
  byId('checkoutStatus').textContent = '';
  byId('paymentConfirmation').hidden = true;
  byId('paymentDialog').showModal();
}

async function submitBooking(event) {
  event.preventDefault();
  const submitButton = event.currentTarget.querySelector('[type="submit"]');
  const status = byId('checkoutStatus');
  submitButton.disabled = true;
  status.textContent = t('sending');
  try {
    const result = await api('/bookings', {
      method: 'POST',
      body: JSON.stringify({
        customer: { name: byId('checkoutName').value, email: byId('checkoutEmail').value, phone: byId('checkoutPhone').value },
        notes: byId('checkoutNotes').value,
        currency: state.currency,
        items: cart.map(item => item.type === 'transfer' ? {
          type: 'transfer',
          route_id: item.route_id,
          travel_at: item.date,
          vehicle: item.vehicle,
          passengers: item.passengers,
          flight_number: item.flight_number,
          pickup_address: item.pickup_address,
          extra_ids: item.extra_ids
        } : ({ type: 'tour', tour_id: item.tour_id, departure_id: item.departure_id, guests: item.guests, addon_ids: item.addon_ids }))
      })
    });
    cart = [];
    save();
    drawCart(false);
    if (byId('drawer').open) byId('drawer').close();
    const checkoutUrl = result.checkout_url;
    if (checkoutUrl) {
      location.assign(checkoutUrl);
      return;
    }
    byId('checkoutSummary').hidden = true;
    byId('checkoutForm').hidden = true;
    byId('paymentConfirmation').hidden = false;
    byId('bookingReference').textContent = result.reference;
    byId('bookingConfirmationText').textContent = t('pendingMessage');
  } catch (error) {
    status.textContent = error.message || t('sendError');
    submitButton.disabled = false;
  }
}

document.addEventListener('click', event => {
  if (event.target.closest('[data-cart-close]') && byId('drawer').open) byId('drawer').close();
  if (event.target.closest('[data-payment-open]')) {
    if (byId('drawer').open) byId('drawer').close();
    openPayment();
  }
  if (event.target.closest('[data-payment-close]') && byId('paymentDialog').open) byId('paymentDialog').close();
  const remove = event.target.closest('[data-remove]');
  if (remove && Number.isInteger(Number(remove.dataset.remove))) {
    cart.splice(Number(remove.dataset.remove), 1);
    save();
    drawCart(true);
  }
});
document.addEventListener('submit', event => {
  if (event.target.id === 'checkoutForm') submitBooking(event);
});
byId('cartBtn').addEventListener('click', () => {
  if (byId('drawer').open) byId('drawer').close();
  else drawCart(true);
});
document.addEventListener('hayq:language', () => drawCart(false));

export function getCart() { return cart; }
