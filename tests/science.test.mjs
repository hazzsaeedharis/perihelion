import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  DAY,
  calendarFile,
  cometPosition,
  eccentricAnomaly,
  julianDate,
  normalizeFeed,
  orbitPoint,
  planetPosition,
  planets,
} from "../src/science.mjs";
const catalogue = JSON.parse(
  await readFile(new URL("../public/data/comets.json", import.meta.url)),
);
const snapshot = JSON.parse(
  await readFile(new URL("./fixtures/approaches.json", import.meta.url)),
);
const almost = (a, b, tolerance = 1e-8) =>
  assert.ok(Math.abs(a - b) < tolerance, `${a} != ${b}`);

test("J2000 uses the correct Julian date and circular orbit quadrants", () => {
  almost(julianDate(Date.parse("2000-01-01T12:00:00Z")), 2451545);
  const elements = { a: 1, e: 0, i: 0, om: 0, w: 0 };
  const p = orbitPoint(elements, Math.PI / 2);
  almost(p[0], 0);
  almost(p[1], 0);
  almost(p[2], -1);
});
test("Kepler solver remains accurate at high eccentricity and negative epochs", () => {
  for (const e of [0, 0.64, 0.968, 0.9999])
    for (const m of [-Math.PI, -2, -0.0001, 0, 0.0001, 2, Math.PI - 1e-6]) {
      const E = eccentricAnomaly(m, e);
      almost(E - e * Math.sin(E), m, 1e-10);
    }
  assert.throws(() => eccentricAnomaly(0, 1));
  assert.throws(() => eccentricAnomaly(NaN, 0.5));
});
test("All catalogue orbits conserve radius bounds and return after one period", () => {
  for (const comet of catalogue.comets) {
    const e = comet.elements;
    almost(Math.hypot(...orbitPoint(e, 0)), e.a * (1 - e.e));
    almost(Math.hypot(...orbitPoint(e, Math.PI)), e.a * (1 + e.e));
    const t = (comet.epoch - 2440587.5) * DAY;
    const before = cometPosition(comet, t),
      after = cometPosition(comet, t + e.per * DAY);
    before.forEach((p, i) => almost(p, after[i], 1e-6));
    for (let day = 0; day <= 730; day += 73) {
      const r = Math.hypot(
        ...cometPosition(comet, Date.parse("2026-11-10") + day * DAY),
      );
      assert.ok(r >= e.a * (1 - e.e) - 1e-8 && r <= e.a * (1 + e.e) + 1e-8);
    }
  }
});
test("Earth at J2000 matches the published approximate orbital frame", () => {
  const p = planetPosition(
    planets.find((p) => p.name === "Earth"),
    Date.parse("2000-01-01T12:00:00Z"),
  );
  almost(p[0], -0.177171, 1e-5);
  almost(p[2], -0.967214, 1e-5);
  assert.throws(() => planetPosition(planets[0], Date.parse("2200-01-01")));
});
test("NASA snapshot normalizes into valid ordered encounters", () => {
  const rows = normalizeFeed(snapshot);
  assert.equal(rows.length, 2);
  assert.equal(rows[0].name, "2015 VH65");
  assert.ok(rows.some((e) => e.name === "499998 (2011 PT)"));
  assert.ok(rows.every((e, i) => !i || e.time >= rows[i - 1].time));
  assert.equal(new Set(rows.map((e) => e.id)).size, rows.length);
  assert.deepEqual(normalizeFeed({ near_earth_objects: {} }), []);
  assert.throws(() => normalizeFeed({}));
  assert.throws(() => normalizeFeed({ near_earth_objects: { bad: {} } }));
});
test("Malformed encounter values are rejected rather than shown as measurements", () => {
  const bad = structuredClone(snapshot);
  for (const day of Object.values(bad.near_earth_objects))
    for (const n of day)
      n.close_approach_data[0].miss_distance.lunar = "invalid";
  assert.throws(() => normalizeFeed(bad));
});
test("Calendar export is UTC, escaped, folded and includes the reminder", () => {
  const row = normalizeFeed(snapshot)[0],
    date = Date.UTC(2026, 10, 10, 12);
  const text = calendarFile(row, date);
  assert.ok(text.includes("DTSTART:20261110T002400Z\r\n"));
  assert.ok(text.includes("DTSTAMP:20261110T120000Z\r\n"));
  assert.ok(text.includes("TRIGGER:-PT1H\r\n"));
  assert.ok(text.endsWith("END:VCALENDAR\r\n"));
  const tricky = calendarFile(
    { ...row, name: "A, B; C\n" + "☄".repeat(30) },
    date,
  );
  assert.ok(tricky.includes("A\\, B\\; C\\n"));
  assert.ok(
    tricky.split("\r\n").every((line) => Buffer.byteLength(line) <= 75),
  );
  assert.throws(() => calendarFile({ ...row, time: NaN }));
});
