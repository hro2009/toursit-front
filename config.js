window.HAYQ_API_BASE_URL = '';
window.hayqApiUrl = path => `${String(window.HAYQ_API_BASE_URL || '').replace(/\/+$/, '')}${path.startsWith('/') ? path : `/${path}`}`;
