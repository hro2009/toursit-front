export const SERVICE_ICON_OPTIONS = [
  { key: 'map-pin', group: 'Travel', label: 'Map pin', keywords: ['location', 'travel', 'destination'] },
  { key: 'car', group: 'Travel', label: 'Car', keywords: ['driver', 'transport', 'vehicle'] },
  { key: 'plane', group: 'Travel', label: 'Plane', keywords: ['airport', 'flight', 'transfer'] },
  { key: 'bed-double', group: 'Stay', label: 'Bed', keywords: ['stay', 'hotel', 'guesthouse'] },
  { key: 'ticket', group: 'Experiences', label: 'Ticket', keywords: ['booking', 'entry', 'trip'] },
  { key: 'users', group: 'Groups', label: 'Users', keywords: ['group', 'team', 'event'] },
  { key: 'route', group: 'Planning', label: 'Route', keywords: ['route', 'itinerary', 'journey'] },
  { key: 'landmark', group: 'Culture', label: 'Landmark', keywords: ['culture', 'monastery', 'heritage'] },
  { key: 'coffee', group: 'Food', label: 'Coffee', keywords: ['food', 'cafe', 'breakfast'] },
  { key: 'camera', group: 'Media', label: 'Camera', keywords: ['photo', 'photographer', 'gallery'] },
  { key: 'luggage', group: 'Travel', label: 'Luggage', keywords: ['bags', 'travel', 'check-in'] },
  { key: 'sparkles', group: 'Luxury', label: 'Sparkles', keywords: ['premium', 'special', 'style'] },
  { key: 'briefcase-business', group: 'Work', label: 'Business', keywords: ['corporate', 'workshop', 'business'] },
  { key: 'badge-check', group: 'Trust', label: 'Badge', keywords: ['trusted', 'verified', 'safe'] },
  { key: 'croissant', group: 'Food', label: 'Croissant', keywords: ['bakery', 'bread', 'lavash'] },
  { key: 'truck', group: 'Travel', label: 'Truck', keywords: ['delivery', 'transfer', 'cargo'] },
  { key: 'star', group: 'Favorites', label: 'Star', keywords: ['premium', 'review', 'favorite'] }
];

export const SERVICE_ICON_KEYS = SERVICE_ICON_OPTIONS.map(icon => icon.key);

export function normalizeServiceIcon(value = 'map-pin') {
  const key = String(value ?? '').trim();
  return SERVICE_ICON_KEYS.includes(key) ? key : 'map-pin';
}

export function getServiceIconOption(value = 'map-pin') {
  return SERVICE_ICON_OPTIONS.find(icon => icon.key === normalizeServiceIcon(value)) || SERVICE_ICON_OPTIONS[0];
}

export function iconSvgPath(iconKey = 'map-pin') {
  return `/icons/${normalizeServiceIcon(iconKey)}.svg`;
}
