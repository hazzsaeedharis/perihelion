# Comet Watch

**Comets, up close. The cosmos, in motion.**

[Explore the observatory](https://hazzsaeedharis.github.io/perihelion/) · [Source repository](https://github.com/hazzsaeedharis/perihelion)

A PDM Space Lab observatory for exploring comets and following near-Earth encounters. A companion to [ISS Observatory](https://hazzsaeedharis.github.io/iss-observatory/) and [TON 618](https://hazzsaeedharis.github.io/ton-618-observatory/).

## Explore

- An interactive, cinematic comet portrait with a 3D nucleus, illustrative ion/dust tails and a starfield. The portrait is artistic and does not predict current comet activity.
- Three visible comet choices and interactive orbits: 67P/Churyumov–Gerasimenko, 1P/Halley and 2P/Encke.
- A two-year timeline in either direction, time playback, orbit/zoom, top view and camera reset. Select a comet to read its story and orbital measurements.
- An illustrative nucleus for each comet, including a two-lobed interpretation of 67P.
- A seven-day NASA NeoWs encounter feed with name search, distance and saved-item filters, and detailed encounter panels.
- A watchlist stored on this device, plus .ics calendar exports with a one-hour reminder. Import the file into a calendar to activate reminders.
- Responsive layout, keyboard-friendly controls, reduced-motion styling, native modal dialogs and a text fallback for unavailable graphics.

The product rationale, considered alternatives, scope and next steps are in [PLAN.md](PLAN.md).

## Run locally

Requires Node.js 24 or newer. No account or secret is needed.

```sh
npm ci
npm run dev
```

Open **http://127.0.0.1:5175/**. If that port is occupied, Vite prints the chosen alternative.

```sh
npm test
npm run build
npm run preview
```

Preview serves the production build at http://127.0.0.1:4175/. The output is entirely static in `dist/`; use an HTTP server rather than opening `index.html` as a local file.

## Data and scientific limits

**JPL orbital elements.** `public/data/comets.json` records each object's elements, epoch, orbit solution date, source link, API version and retrieval time. Comets use a fixed-element two-body Kepler model. It omits planetary perturbations, comet outgassing and UTC–TDB differences; positions over time are approximate. Planet positions use JPL's 1800–2050 approximate elements and rates. Earth is the Earth–Moon barycenter. This is not an observing ephemeris, telescope-pointing tool or impact-risk system.

**Visual scale.** Orbital positions have linear astronomical-unit distances. Body markers and glows are enlarged. All nucleus shapes, surface relief and lighting are artistic interpretations. No measured spacecraft shape model is included. The 67P interpretation illustrates the observed two-lobed structure; it does not reproduce its measured surface.

**Encounter feed.** The bundled snapshot covers November 10–16, 2026. On load, the app uses a same-day successful cache younger than six hours, or the dated bundled snapshot. Press **Refresh NASA data** to query the current seven UTC calendar dates. The source state and retrieval time remain visible. Failed refreshes preserve the previous data and show an error; expired snapshot windows are labelled archived. NASA's shared `DEMO_KEY` is public and rate-limited. Nothing secretly refreshes in the background.

**Visibility and risk.** A close approach is not necessarily visible in the sky. Visibility depends on the observer, brightness, solar position and conditions. A “potentially hazardous” catalogue classification does not predict an impact. The app presents NASA estimates and never computes impact probabilities.

**Watchlist and reminders.** Saved objects belong to the browser/device and are lost if its storage is cleared. If storage is blocked, items remain available for the session and a notice explains the limit. A saved encounter retains the estimate available when saved; check fresh NASA data before relying on it. Calendar files contain a 30-minute event and one-hour reminder in UTC. The app has no push/email delivery, service worker or server-side scheduler. Your calendar controls how imported alarms are delivered.

## Refresh the bundled data

```sh
npm run refresh:data
# Or a specific seven-day window:
npm run refresh:data -- 2026-11-10
```

The script uses NASA NeoWs and sequential JPL SBDB requests, validates responses and replaces each completed dataset atomically. If a later JPL request fails, the new NASA snapshot can still have been saved while the previous comet catalogue is preserved. It stops on errors rather than repeatedly retrying. An optional `NASA_API_KEY` environment variable can be supplied for the script; it is never written into the app. Use only the shared public demo key in browser code. Immutable NASA test samples live in `tests/fixtures/` so updating production data does not invalidate calendar checks.

## GitHub Pages

The site uses relative asset URLs and includes a manual deployment workflow. To publish:

1. Put this folder's contents at the root of the chosen GitHub repository and push with your normal Git identity.
2. Under repository **Settings → Pages**, select **GitHub Actions** as the source.
3. Run **Publish observatory** from **Actions**. It installs dependencies, tests, builds and deploys `dist/`.

The repository is `hazzsaeedharis/perihelion`; the public-facing name is **Comet Watch**. Perihelion means the closest point to the Sun in an orbit. The original browser storage keys and calendar event identifiers are retained so existing local watchlists and imported reminders remain compatible. See [GitHub's custom Pages workflow documentation](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages).

## Sources and attribution

- [NASA/JPL Small-Body Database API](https://ssd-api.jpl.nasa.gov/doc/sbdb.html): comet orbital elements. JPL APIs are called by the refresh script, never embedded as browser requests, following the [service policy](https://ssd-api.jpl.nasa.gov/doc/).
- [JPL approximate planetary positions](https://ssd.jpl.nasa.gov/planets/approx_pos.html): Table 1 elements, rates and the orbital coordinate transformation, after E. M. Standish and J. G. Williams.
- [NASA Open APIs / NeoWs](https://api.nasa.gov/): near-Earth encounter estimates and diameter ranges.
- [ESA Rosetta](https://www.esa.int/Science_Exploration/Space_Science/Rosetta) and [ESA's 67P structure discussion](https://blogs.esa.int/rosetta/2015/09/28/how-rosettas-comet-got-its-shape/): editorial background and two-lobed shape reference.
- [NASA Halley](https://science.nasa.gov/solar-system/comets/1p-halley/) and [NASA Encke](https://science.nasa.gov/solar-system/comets/2p-encke/): introductory comet descriptions.
- React and Three.js: MIT. Lucide: ISC. Vite: MIT. Dependencies retain their licenses.
- DM Sans, Manrope and Instrument Serif: SIL Open Font License, optionally loaded from Google Fonts; local sans-serif fallbacks are supplied.

NASA and ESA are data sources, not sponsors or endorsers. No NASA/ESA imagery or model files are redistributed. The existing ISS and black-hole repositories were read as references and remain unchanged.

## Validation

Eight native Node tests cover Julian dates, Kepler convergence at high eccentricity, perihelion/aphelion limits, orbital periodicity, the planetary coordinate frame, feed validation, UTC calendar export/escaping/folding, and finite, bounded nucleus geometry. Browser checks cover comet selection, time playback, nucleus view, live NASA refresh, search/distance filters, watchlist persistence, calendar download and narrow layouts.

No actual phone hardware or calendar-app alarm delivery has been tested. WebGL and an internet connection are needed for 3D and live refresh respectively; the dated local data can be explored without NASA access.
