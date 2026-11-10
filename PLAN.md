# Comet Watch — product and public release plan

## Purpose and name

Make comet exploration understandable within the first five seconds. Visitors should know what the site tracks, how to choose an object, and what to do next.

**Comet Watch** is the public-facing name selected for clarity. **Perihelion** remains the repository name and URL. Perihelion means an orbit's closest point to the Sun; it is useful scientific vocabulary but does not explain the product to a first-time visitor.

## Design decisions

The ISS and TON 618 observatories put an arresting celestial object at the center of the experience. Their uncluttered controls and generous scale invite exploration. This release applies the same priorities:

1. Open with a large interactive comet portrait, an explicit “Explore comets in 3D” description and one primary action. The portrait uses a real-time 3D nucleus and illustrative ion/dust tails. It is labelled artistic, rather than presented as a current observation.
2. Use a simple top navigation and three visible comet choices. Visitors do not need to find a small selector to discover Halley or Encke.
3. Keep the orbit map and 3D nucleus one click apart. Retain the timeline, data sources, camera tools, watchlist and calendar reminders.
4. Use a dark blue astronomical palette, pale blue light and restrained warm dust tones; larger type and more breathing room make the science readable.
5. Label the lower section **Asteroids passing Earth**. NASA NeoWs is an asteroid encounter feed and must not be mistaken for comet visibility alerts.
6. Preserve the responsive layout, reduced-motion behavior, keyboard alternatives, native dialogs and graphics fallback. The decorative portrait renders only after interaction; scrolling does not zoom it.

## Scope of the change

- `src/App.jsx`: new introductory portrait, navigation, visible comet selection, clearer product copy, accessibility labels. Existing feed/error/cache logic, watchlist keys and calendar IDs are preserved.
- `src/scene.js`: reuse the viewer lifecycle, controls, disposal and nucleus geometry for the portrait; add procedural tail shading and stars. Orbital calculations are unchanged.
- `src/style.css`: replace sidebar/dashboard framing with an immersive introduction and a clear exploration sequence; retain responsive encounter and detail surfaces.
- `index.html`, `public/icon.svg`: name, comet icon, page description and share metadata.
- `README.md`, package metadata and deployment configuration: public release instructions and provenance.
- `src/science.mjs` and immutable tests: retained as the scientific/data contract; run all checks to catch regressions.

## Publication

Create the public repository `hazzsaeedharis/perihelion`, commit using the configured Git identity, publish the static build on GitHub Pages, and verify the deployed page and its data resources. No paid service, secret, account system or backend is required.

## Verification

Run eight native tests covering orbital invariants, data validation and calendar output. Build the static bundle and verify relative assets. Check the new portrait, three comet choices, both explorer modes, time controls, watchlist persistence, calendar export and NASA refresh in the browser. Inspect desktop and narrow-screen layouts, ensure page scrolling remains possible over the portrait, and check browser errors. Validate the public URL after deployment.

## Remaining product boundary

This is an educational comet explorer plus a near-Earth asteroid encounter monitor. It does not predict which comet is overhead, visible tonight or dangerous. Comet propagation uses fixed two-body elements, without planetary perturbations or outgassing. Nucleus shapes and the portrait are illustrative. Calendar reminders require import, and watchlists are local to the browser.

A future observing release would need observer coordinates, Horizons ephemerides, brightness and sky-condition estimates, then tested background alert delivery. Those are separate scientific and operational requirements, not claims made by the current interface.
