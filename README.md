# Hayq Tours Frontend

Static public site and admin UI for Hayq Tours. Publish this directory as the static document root. Configure `/admin` to serve `admin/index.html` and add a fallback to `index.html` for `/tours/:slug` paths.

## Connect to the API

`config.js` currently points to the Render demo API at `https://hayq-tours-api.onrender.com`. For another environment, set `window.HAYQ_API_BASE_URL` to that API origin with no trailing slash. The API's `FRONTEND_ORIGINS` must contain the frontend's exact origin.

When developing with the combined app, leave the setting empty to use the current origin. Images uploaded in the admin are served from the API.

The `main` branch deploys the static site to GitHub Pages at `https://hro2009.github.io/toursit-front/`. GitHub Pages cannot run the Node.js backend; tours, bookings, settings, and admin login use the separately deployed Render API. Render's free service sleeps when idle and uses temporary storage; database and uploaded images may be lost, so do not rely on this demo for durable bookings. The workflow also publishes a static-route fallback for tour links.

This repository contains no backend secrets or dependencies. Do not store `.env`, uploaded originals, or private data here.

## Staging and production promotion

The `staging` branch is deployed to the Render static preview at `https://hayq-tours-preview.onrender.com/` and uses the separate staging API at `https://hayq-tours-api-staging.onrender.com`. Staging uses its own database and credentials; it is for testing only. Both Render services use the free plan, so they can sleep when idle and their data and uploads are temporary.

To publish changes for review, switch both local repositories to `staging`, commit and push changes to the relevant repository's `staging` branch, then test the preview website and its `/admin/` page. The first push can create the remote branch with `git push -u origin staging`.

When the staging version is ready, run `.\promote-prod.ps1` from this repository while both local repositories are clean and on `staging`. The script runs the frontend build and syntax checks, runs backend tests, verifies that the deployed preview website and API match the exact staging commits, then fast-forwards both production `main` branches and waits for both production deployments to report those commits. It stops rather than promoting if the preview is stale, a branch cannot fast-forward, or a test fails. Set `HAYQ_BACKEND_REPO` if the backend checkout is not in the sibling `tourist-backend` folder.

The preview Render services are separate Blueprints described in `render.staging.yaml`. Create each once in Render using its matching repository, the `staging` branch, and Blueprint file path `render.staging.yaml`. Keep the generated staging `JWT_SECRET` and `ADMIN_PASSWORD`; staging's initial admin email is `preview-admin@hayqtours.example`. Never copy production environment variables or data to staging.
