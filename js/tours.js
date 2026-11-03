import { api, assetUrl, byId, escapeHtml, money, state } from './api.js';
import { t } from './i18n.js';
import { openTour } from './booking.js';
import { getServiceIconOption } from './icons.js';

let category = 'All';
const tourVisuals = {
  'garni-geghard-monastery': { colors: ['#f4b678', '#7a5a7e'], icon: '🏛️' },
  'khor-virap-areni-noravank': { colors: ['#e79a6a', '#34305f'], icon: '🍷' },
  'lake-sevan-dilijan': { colors: ['#3f8aa0', '#123a41'], icon: '🌊' },
  'yerevan-city-tour': { colors: ['#f4b678', '#1d4f55'], icon: '🏙️' },
  'echmiadzin-zvartnots-ruins': { colors: ['#a9c5bf', '#34305f'], icon: '⛪' },
  'tatev-monastery-cable-car': { colors: ['#6fa08a', '#12363c'], icon: '🚠' }
};
export function placeholderArt(hue, id) {
  const numericId = Number(String(id).replace(/^m/, '')) || 1;
  const a = `hsl(${hue} 70% 72%)`, b = `hsl(${hue} 55% 45%)`, c = `hsl(${(hue + 20) % 360} 50% 22%)`;
  return `<svg viewBox="0 0 300 170" preserveAspectRatio="xMidYMid slice" aria-hidden="true"><defs><linearGradient id="g${id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${a}"/><stop offset="1" stop-color="#ffe9c9"/></linearGradient></defs><rect width="300" height="170" fill="url(#g${id})"/><circle cx="${60 + (numericId * 37) % 180}" cy="48" r="20" fill="#fff8e6"/><polygon points="0,170 0,100 60,70 110,105 170,50 230,100 300,75 300,170" fill="${b}"/><polygon points="0,170 0,135 80,110 150,140 220,115 300,140 300,170" fill="${c}"/><text x="12" y="160" font-size="11" fill="#fff" opacity=".85" font-family="sans-serif">Your photo here</text></svg>`;
}

export function art(tour, id = tour.id) {
  if (tour.card_image_url) return `<img class="ph" src="${escapeHtml(assetUrl(tour.card_image_url))}" alt="${escapeHtml(tour.name)}" loading="lazy">`;
  const photo = tour.photos?.[0];
  if (photo?.url) return `<img class="ph" src="${escapeHtml(assetUrl(photo.url))}" alt="${escapeHtml(photo.alt || tour.name)}" loading="lazy">`;
  return placeholderArt(Number(tour.hue || 25 + (tour.id * 47) % 330), id);
}

export function renderTours() {
  const filters = byId('filters');
  const grid = byId('grid');
  if (filters && grid) {
    const categories = ['All', ...new Set(state.tours.map(tour => tour.category))];
    filters.innerHTML = categories.map(value => `<button class="pill ${value === category ? 'on' : ''}" data-category="${escapeHtml(value)}">${value === 'All' ? t('allCategories') : escapeHtml(value)}</button>`).join('');
    const filtered = state.tours.filter(tour => category === 'All' || tour.category === category);
    grid.innerHTML = filtered.map(tour => `<button class="tour" data-tour="${tour.id}" aria-label="${escapeHtml(tour.name)}, ${escapeHtml(t('detailsBook'))}">${art(tour)}<div class="tb"><div class="meta">${escapeHtml(tour.category)}, ${escapeHtml(tour.duration)}</div><h3>${escapeHtml(tour.name)}</h3><div class="row"><span class="meta">${escapeHtml(t('perPerson'))}</span><span class="price">${money(tour.price_amd)}</span></div></div></button>`).join('');
  }
  const serviceTourGrid = byId('serviceTourGrid');
  if (serviceTourGrid) {
    serviceTourGrid.innerHTML = state.tours.map((tour, index) => {
      const visual = tourVisuals[tour.slug] || { colors: ['#f4b678', '#12363c'], icon: '⛰️' };
      const cardImage = tour.card_image_url ? `<img class="service-tour-background" src="${escapeHtml(assetUrl(tour.card_image_url))}" alt="" loading="lazy">` : '';
      return `<article class="service-tour" style="--i:${index};--tour-a:${visual.colors[0]};--tour-b:${visual.colors[1]}">
        <div class="service-tour-art${tour.card_image_url ? ' has-custom-image' : ''}">${cardImage}<svg class="mountain-art" viewBox="0 0 300 110" preserveAspectRatio="none" aria-hidden="true"><path d="M0 110 70 38 110 72 173 15 240 78 274 45 300 72V110Z" fill="#0b2227" opacity=".42"/><path d="m153 33 20-18 17 24-20-8-10 9Z" fill="#e8f3ef" opacity=".8"/></svg><span class="service-tour-duration">${escapeHtml(tour.duration)}</span><em class="tour-banner-icon" aria-hidden="true">${visual.icon}</em></div>
        <div class="service-tour-copy"><h4>${escapeHtml(tour.name)}</h4><p class="service-tour-description">${escapeHtml(tour.description)}</p>
        <div class="preview-footer"><span class="service-tour-price"><b class="price">${money(tour.price_amd)}</b><small>${escapeHtml(t('perPerson'))}</small></span><button class="btn" type="button" data-tour="${tour.id}">${escapeHtml(t('detailsBook'))}</button></div></div>
      </article>`;
    }).join('');
  }
  const planTour = byId('planTour');
  if (planTour) planTour.innerHTML = state.tours.map(tour => `<option value="${tour.id}">${escapeHtml(tour.name)}</option>`).join('');
  const status = byId('tourStatus');
  if (status) status.textContent = state.tours.length ? '' : t('unavailable');
  const reviewTour = byId('reviewTour');
  if (reviewTour) reviewTour.innerHTML = `<option value="">${escapeHtml(t('anyTour'))}</option>${state.tours.map(tour => `<option value="${tour.id}">${escapeHtml(tour.name)}</option>`).join('')}`;
}

export async function loadTours() {
  state.tours = await api(`/tours?lang=${state.language}`);
  renderTours();
  const requestedSlug = decodeURIComponent(location.pathname.match(/^\/tours\/([^/]+)$/)?.[1] || '');
  const selected = state.tours.find(tour => tour.slug === requestedSlug);
  if (selected) openTour(selected.id);
}

export async function loadServices() {
  if (!byId('servicesGrid')) return;
  state.services = await api(`/services?lang=${state.language}`);
  byId('servicesGrid').innerHTML = state.services.map(service => {
    const icon = getServiceIconOption(service.icon);
    return `<div><div class="service-icon" aria-hidden="true"><img src="/icons/${escapeHtml(icon.key)}.svg" alt="" width="28" height="28"></div><h3>${escapeHtml(service.name)}</h3><p>${escapeHtml(service.description)}</p></div>`;
  }).join('');
}

export async function loadReviews() {
  if (!byId('reviewsGrid')) return;
  const reviews = await api('/reviews');
  byId('reviewsGrid').innerHTML = reviews.length
    ? reviews.map(review => `<article class="review"><strong>${escapeHtml(review.name)}</strong><span aria-label="${review.rating} out of 5"> ${'★'.repeat(review.rating)}</span><p>${escapeHtml(review.text)}</p></article>`).join('')
    : `<p class="sub">${escapeHtml(t('noReviews'))}</p>`;
}

document.addEventListener('click', event => {
  const categoryButton = event.target.closest('[data-category]');
  if (categoryButton) {
    category = categoryButton.dataset.category;
    renderTours();
  }
  const tourButton = event.target.closest('[data-tour]');
  if (tourButton) openTour(Number(tourButton.dataset.tour));
});
