window.HAYQ_API_BASE_URL = 'https://hayq-tours-api.onrender.com';
window.HAYQ_BASE_PATH = window.location.hostname === 'hro2009.github.io' ? '/toursit-front/' : '/';
window.hayqSiteUrl = path => `${window.HAYQ_BASE_PATH}${path.replace(/^\/+/, '')}`;
window.hayqApiUrl = path => `${String(window.HAYQ_API_BASE_URL || '').replace(/\/+$/, '')}${path.startsWith('/') ? path : `/${path}`}`;
