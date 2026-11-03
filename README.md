# Hayq Tours Frontend

Static public site and admin UI for Hayq Tours. Publish this directory as the static document root. Configure `/admin` to serve `admin/index.html` and add a fallback to `index.html` for `/tours/:slug` paths.

## Connect to the API

`config.js` currently points to the Render demo API at `https://hayq-tours-api.onrender.com`. For another environment, set `window.HAYQ_API_BASE_URL` to that API origin with no trailing slash. The API's `FRONTEND_ORIGINS` must contain the frontend's exact origin.

When developing with the combined app, leave the setting empty to use the current origin. Images uploaded in the admin are served from the API.

The `main` branch deploys the static site to GitHub Pages at `https://hro2009.github.io/toursit-front/`. GitHub Pages cannot run the Node.js backend; tours, bookings, settings, and admin login use the separately deployed Render API. Render's free service sleeps when idle and uses temporary storage; database and uploaded images may be lost, so do not rely on this demo for durable bookings. The workflow also publishes a static-route fallback for tour links.

This repository contains no backend secrets or dependencies. Do not store `.env`, uploaded originals, or private data here.
