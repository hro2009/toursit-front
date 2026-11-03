import { api, byId, escapeHtml, money, state } from './api.js';
import { t } from './i18n.js';
import { art } from './tours.js';
import { addCartItem } from './cart.js';

let restoreFocus;
function closeSheet() {
  if (byId('scrim').open) byId('scrim').close();
  restoreFocus?.focus();
}

export async function openTour(id) {
  const summary = state.tours.find(tour => tour.id === id);
  if (!summary) return;
  const tour = await api(`/tours/${encodeURIComponent(summary.slug)}?lang=${state.language}`);
  restoreFocus = document.activeElement;
  const departures = tour.departures || [];
  const firstDeparture = departures[0];
  const departureOptions = departures.map(departure => `<option value="${departure.id}" data-seats="${departure.seats_remaining}">${escapeHtml(departure.date)} - ${departure.seats_remaining} ${escapeHtml(t('remaining'))}</option>`).join('');
  byId('sheet').innerHTML = `<button class="x" type="button" aria-label="${escapeHtml(t('close'))}" data-sheet-close>×</button>
    <div class="detail-art">${art(tour, `m${tour.id}`)}</div>
    <div class="body"><div class="meta">${escapeHtml(tour.category)}, ${escapeHtml(tour.duration)}</div>
    <h2 id="dialogTitle">${escapeHtml(tour.name)}</h2><p class="detail-description">${escapeHtml(tour.description)}</p>
    <ul class="ul">${tour.highlights.map(highlight => `<li>${escapeHtml(highlight)}</li>`).join('')}</ul>
    <div class="two">
      <div><label for="departureSelect">${escapeHtml(t('dateLabel'))}</label><select id="departureSelect" ${departures.length ? '' : 'disabled'}>${departures.length ? `<option value="">${escapeHtml(t('selectDeparture'))}</option>${departureOptions}` : `<option>${escapeHtml(t('unavailable'))}</option>`}</select></div>
      <div><label for="guestSelect">${escapeHtml(t('guestsLabel'))}</label><select id="guestSelect" disabled></select></div>
    </div>
    ${state.addons.map(addon => `<label class="add"><input type="checkbox" data-addon="${escapeHtml(addon.id)}"><span>${escapeHtml(addon.name)}</span><span>+${money(addon.price_amd)} ${addon.price_type === 'per_person' ? escapeHtml(t('perPerson')) : escapeHtml(t('perBooking'))}</span></label>`).join('')}
    <div class="total"><span>${escapeHtml(t('total'))}</span><span id="bookingTotal">${money(tour.price_amd)}</span></div>
    <button class="btn" id="addToCart" type="button" ${departures.length ? 'disabled' : 'disabled'}>${escapeHtml(t('addToCart'))}</button></div>`;
  byId('scrim').showModal();
  byId('sheet').querySelector('[data-sheet-close]').focus();

  const departureSelect = byId('departureSelect');
  const guestSelect = byId('guestSelect');
  const addButton = byId('addToCart');
  const updateTotal = () => {
    const guests = Number(guestSelect.value || 1);
    const extra = [...byId('sheet').querySelectorAll('[data-addon]:checked')].reduce((sum, input) => {
      const addon = state.addons.find(value => value.id === input.dataset.addon);
      return sum + (addon?.price_amd || 0) * (addon?.price_type === 'per_person' ? guests : 1);
    }, 0);
    byId('bookingTotal').textContent = money(tour.price_amd * guests + extra);
  };
  const setGuests = () => {
    const departure = departures.find(item => item.id === Number(departureSelect.value));
    const count = departure ? Math.min(Number(tour.max_group), Number(departure.seats_remaining)) : 0;
    const groupSize = Math.max(0, count - 1);
    guestSelect.innerHTML = Array.from({ length: groupSize }, (_, index) => `<option value="${index + 2}">${index + 2}</option>`).join('');
    guestSelect.disabled = groupSize === 0;
    addButton.disabled = groupSize === 0;
    updateTotal();
  };
  departureSelect.addEventListener('change', setGuests);
  guestSelect.addEventListener('change', updateTotal);
  byId('sheet').addEventListener('change', event => { if (event.target.matches('[data-addon]')) updateTotal(); });
  addButton.addEventListener('click', () => {
    const departure = departures.find(item => item.id === Number(departureSelect.value));
    if (!departure || Number(guestSelect.value) > departure.seats_remaining) return;
    addCartItem({ tour_id: tour.id, departure_id: departure.id, date: departure.date, guests: Number(guestSelect.value), addon_ids: [...byId('sheet').querySelectorAll('[data-addon]:checked')].map(input => input.dataset.addon) });
    closeSheet();
  });
}

document.addEventListener('click', event => {
  if (event.target.closest('[data-sheet-close]') || event.target === byId('scrim')) closeSheet();
});
