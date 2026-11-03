# Hayq Tours Frontend

Static public site and admin UI for Hayq Tours. Publish this directory as the static document root. Configure `/admin` to serve `admin/index.html` and add a fallback to `index.html` for `/tours/:slug` paths.

## Connect to the API

Before deploying, set `window.HAYQ_API_BASE_URL` in `config.js` to the API origin, with no trailing slash (for example, `https://api.example.com`). Keep the frontend and API on the same site, such as `www.example.com` and `api.example.com`, for reliable cookie-based admin sessions. The API's `FRONTEND_ORIGINS` must contain the frontend's exact origin.

When developing with the combined app, leave the setting empty to use the current origin. Images uploaded in the admin are served from the API.

This repository contains no backend secrets or dependencies. Do not store `.env`, uploaded originals, or private data here.
