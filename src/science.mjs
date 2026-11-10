export const DAY = 86400000;
const RAD = Math.PI / 180;
export const julianDate = (ms) => ms / DAY + 2440587.5;
export const isoDay = (ms) => new Date(ms).toISOString().slice(0, 10);
export const utcDate = (ms, options = {}) =>
  new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
    ...options,
  }).format(new Date(ms));

export function eccentricAnomaly(mean, e) {
  if (!Number.isFinite(mean) || !Number.isFinite(e) || e < 0 || e >= 1)
    throw new Error("An elliptical orbit is required.");
  const m =
    ((((mean + Math.PI) % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI)) -
    Math.PI;
  let lo = -Math.PI,
    hi = Math.PI;
  // Bisection remains stable for Halley's highly eccentric orbit, including perihelion.
  for (let i = 0; i < 52; i++) {
    const mid = (lo + hi) / 2;
    if (mid - e * Math.sin(mid) < m) lo = mid;
    else hi = mid;
  }
  return (lo + hi) / 2;
}

export function orbitPoint(elements, eccentric) {
  const { a, e, i, om, w } = elements;
  const x = a * (Math.cos(eccentric) - e),
    y = a * Math.sqrt(1 - e * e) * Math.sin(eccentric);
  const cO = Math.cos(om * RAD),
    sO = Math.sin(om * RAD),
    cw = Math.cos(w * RAD),
    sw = Math.sin(w * RAD),
    ci = Math.cos(i * RAD),
    si = Math.sin(i * RAD);
  const X = (cw * cO - sw * sO * ci) * x + (-sw * cO - cw * sO * ci) * y;
  const Y = (cw * sO + sw * cO * ci) * x + (-sw * sO + cw * cO * ci) * y;
  const Z = sw * si * x + cw * si * y;
  return [X, Z, -Y];
}

export function cometPosition(comet, ms) {
  const e = comet.elements;
  // shortcut: fixed two-body elements omit perturbations and outgassing; use Horizons for observing predictions.
  const mean = (e.ma + (julianDate(ms) - comet.epoch) * e.n) * RAD;
  return orbitPoint(e, eccentricAnomaly(mean, e.e));
}

// JPL approximate planetary elements and rates, Table 1 (1800–2050).
// https://ssd.jpl.nasa.gov/planets/approx_pos.html — Earth represents the Earth–Moon barycenter.
export const planets = [
  {
    name: "Mercury",
    color: "#adada5",
    values: [
      0.38709927, 0.20563593, 7.00497902, 252.2503235, 77.45779628, 48.33076593,
    ],
    rates: [
      0.00000037, 0.00001906, -0.00594749, 149472.67411175, 0.16047689,
      -0.12534081,
    ],
  },
  {
    name: "Venus",
    color: "#dfc595",
    values: [
      0.72333566, 0.00677672, 3.39467605, 181.9790995, 131.60246718,
      76.67984255,
    ],
    rates: [
      0.0000039, -0.00004107, -0.0007889, 58517.81538729, 0.00268329,
      -0.27769418,
    ],
  },
  {
    name: "Earth",
    color: "#8cbde6",
    values: [
      1.00000261, 0.01671123, -0.00001531, 100.46457166, 102.93768193, 0,
    ],
    rates: [
      0.00000562, -0.00004392, -0.01294668, 35999.37244981, 0.32327364, 0,
    ],
  },
  {
    name: "Mars",
    color: "#d99072",
    values: [
      1.52371034, 0.0933941, 1.84969142, -4.55343205, -23.94362959, 49.55953891,
    ],
    rates: [
      0.00001847, 0.00007882, -0.00813131, 19140.30268499, 0.44441088,
      -0.29257343,
    ],
  },
  {
    name: "Jupiter",
    color: "#d1b69a",
    values: [
      5.202887, 0.04838624, 1.30439695, 34.39644051, 14.72847983, 100.47390909,
    ],
    rates: [
      -0.00011607, -0.00013253, -0.00183714, 3034.74612775, 0.21252668,
      0.20469106,
    ],
  },
  {
    name: "Saturn",
    color: "#c9b98b",
    values: [
      9.53667594, 0.05386179, 2.48599187, 49.95424423, 92.59887831,
      113.66242448,
    ],
    rates: [
      -0.0012506, -0.00050991, 0.00193609, 1222.49362201, -0.41897216,
      -0.28867794,
    ],
  },
  {
    name: "Uranus",
    color: "#9fd6d5",
    values: [
      19.18916464, 0.04725744, 0.77263783, 313.23810451, 170.9542763,
      74.01692503,
    ],
    rates: [
      -0.00196176, -0.00004397, -0.00242939, 428.48202785, 0.40805281,
      0.04240589,
    ],
  },
  {
    name: "Neptune",
    color: "#7c9edd",
    values: [
      30.06992276, 0.00859048, 1.77004347, -55.12002969, 44.96476227,
      131.78422574,
    ],
    rates: [
      0.00026291, 0.00005105, 0.00035372, 218.45945325, -0.32241464,
      -0.00508664,
    ],
  },
];

export function planetElements(planet, ms) {
  const t = (julianDate(ms) - 2451545) / 36525;
  if (t < -2 || t > 0.51) throw new Error("Planet model supports 1800–2050.");
  const [a, e, i, L, peri, om] = planet.values.map(
    (v, index) => v + planet.rates[index] * t,
  );
  return { a, e, i, om, w: peri - om, ma: L - peri };
}
export function planetPosition(planet, ms) {
  const e = planetElements(planet, ms);
  return orbitPoint(e, eccentricAnomaly(e.ma * RAD, e.e));
}

export function normalizeFeed(feed) {
  if (
    !feed?.near_earth_objects ||
    typeof feed.near_earth_objects !== "object" ||
    Array.isArray(feed.near_earth_objects)
  )
    throw new Error("NASA returned an unreadable feed.");
  const records = Object.values(feed.near_earth_objects);
  if (records.some((value) => !Array.isArray(value)))
    throw new Error("NASA returned an unreadable feed.");
  const events = records.flat().flatMap((neo) => {
    if (!neo || typeof neo.id !== "string" || typeof neo.name !== "string")
      return [];
    return (
      Array.isArray(neo.close_approach_data) ? neo.close_approach_data : []
    )
      .filter((ca) => ca.orbiting_body === "Earth")
      .map((ca) => ({
        id: `${neo.id}-${ca.epoch_date_close_approach}`,
        neoId: neo.id,
        name: neo.name.replace(/^\((.*)\)$/, "$1"),
        time: ca.epoch_date_close_approach,
        lunar: Number(ca.miss_distance?.lunar),
        km: Number(ca.miss_distance?.kilometers),
        speed: Number(ca.relative_velocity?.kilometers_per_second),
        minDiameter: Number(
          neo.estimated_diameter?.meters?.estimated_diameter_min,
        ),
        maxDiameter: Number(
          neo.estimated_diameter?.meters?.estimated_diameter_max,
        ),
        hazardous: neo.is_potentially_hazardous_asteroid === true,
      }))
      .filter(validEvent);
  });
  if (records.flat().length && !events.length)
    throw new Error("NASA returned no usable Earth encounters.");
  return [...new Map(events.map((e) => [e.id, e])).values()].sort(
    (a, b) => a.time - b.time,
  );
}

export function validEvent(e) {
  return (
    !!e &&
    typeof e.id === "string" &&
    /^\d+-\d+$/.test(e.id) &&
    typeof e.neoId === "string" &&
    /^\d+$/.test(e.neoId) &&
    typeof e.name === "string" &&
    e.name.length < 150 &&
    ["time", "lunar", "km", "speed", "minDiameter", "maxDiameter"].every(
      (k) => Number.isFinite(e[k]) && e[k] > 0,
    ) &&
    e.time < 8640000000000000
  );
}

export function calendarFile(event, now = Date.now()) {
  if (!validEvent(event))
    throw new Error("Cannot export an invalid encounter.");
  const stamp = (ms) =>
    new Date(ms)
      .toISOString()
      .replace(/[-:]/g, "")
      .replace(/\.\d{3}Z$/, "Z");
  const escape = (text) =>
    text
      .replace(/\\/g, "\\\\")
      .replace(/\r?\n/g, "\\n")
      .replace(/[,;]/g, "\\$&");
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//PDM//Perihelion//EN",
    "CALSCALE:GREGORIAN",
    "BEGIN:VEVENT",
    `UID:${event.id}@perihelion.local`,
    `DTSTAMP:${stamp(now)}`,
    `DTSTART:${stamp(event.time)}`,
    `DTEND:${stamp(event.time + 30 * 60000)}`,
    `SUMMARY:${escape(`Asteroid ${event.name}: Earth close approach`)}`,
    `DESCRIPTION:${escape(`NASA NeoWs estimate: ${event.lunar.toFixed(2)} lunar distances. Not a visibility forecast or impact warning. Check updated data before observing.`)}`,
    `URL:https://ssd.jpl.nasa.gov/tools/sbdb_lookup.html#/?sstr=${event.neoId}`,
    "BEGIN:VALARM",
    "TRIGGER:-PT1H",
    "ACTION:DISPLAY",
    "DESCRIPTION:Space watch reminder",
    "END:VALARM",
    "END:VEVENT",
    "END:VCALENDAR",
  ];
  return (
    lines
      .flatMap((line) => {
        const parts = [];
        let part = "";
        for (const char of line) {
          if (new TextEncoder().encode(part + char).length > 73) {
            parts.push(part);
            part = " ";
          }
          part += char;
        }
        return [...parts, part];
      })
      .join("\r\n") + "\r\n"
  );
}
