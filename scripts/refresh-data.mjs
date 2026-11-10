import { readFile, writeFile, rename } from "node:fs/promises";
import { DAY, isoDay, normalizeFeed } from "../src/science.mjs";

const directory = new URL("../public/data/", import.meta.url);
const startDate = process.argv[2] || isoDay(Date.now());
if (
  !/^\d{4}-\d{2}-\d{2}$/.test(startDate) ||
  !Number.isFinite(Date.parse(startDate)) ||
  isoDay(Date.parse(startDate)) !== startDate
)
  throw Error("Supply a valid YYYY-MM-DD date.");
const endDate = isoDay(Date.parse(startDate) + 6 * DAY);
const response = await fetch(
  `https://api.nasa.gov/neo/rest/v1/feed?start_date=${startDate}&end_date=${endDate}&api_key=${encodeURIComponent(process.env.NASA_API_KEY || "DEMO_KEY")}`,
  { signal: AbortSignal.timeout(30000) },
);
if (!response.ok)
  throw Error(
    `NASA request failed (${response.status}); existing snapshot was preserved.`,
  );
const feed = await response.json();
const events = normalizeFeed(feed);
const retrievedAt = new Date().toISOString();
async function save(name, data) {
  const destination = new URL(name, directory),
    temporary = new URL(`${name}.tmp`, directory);
  await writeFile(temporary, JSON.stringify(data, null, 2) + "\n");
  await rename(temporary, destination);
}
await save("approaches.json", { retrievedAt, startDate, endDate, feed });
console.log(
  `Saved ${events.length} Earth encounters for ${startDate} through ${endDate}.`,
);

// JPL requests are intentionally sequential and are never sent from the browser.
const previous = JSON.parse(await readFile(new URL("comets.json", directory)));
const comets = [];
for (const id of ["67P", "1P", "2P"]) {
  const result = await fetch(
    `https://ssd-api.jpl.nasa.gov/sbdb.api?sstr=${id}&full-prec=true`,
    {
      headers: {
        "User-Agent": "Perihelion/0.1 (https://github.com/hazzsaeedharis)",
      },
      signal: AbortSignal.timeout(30000),
    },
  );
  if (!result.ok)
    throw Error(
      `JPL request failed (${result.status}); existing comet catalogue was preserved.`,
    );
  const data = await result.json();
  if (data.signature?.version !== previous.apiVersion)
    throw Error(
      "JPL API version changed. Review the schema before replacing comet data.",
    );
  const elements = Object.fromEntries(
    data.orbit.elements.map((e) => [e.name, Number(e.value)]),
  );
  if (
    ["a", "e", "i", "om", "w", "ma", "n", "per"].some(
      (k) => !Number.isFinite(elements[k]),
    ) ||
    elements.a <= 0 ||
    elements.e < 0 ||
    elements.e >= 1 ||
    !Number.isFinite(Number(data.orbit.epoch)) ||
    data.object.des !== id
  )
    throw Error(
      "Invalid JPL elements; existing comet catalogue was preserved.",
    );
  comets.push({
    id,
    name: data.object.fullname,
    classification: data.object.orbit_class.name,
    epoch: Number(data.orbit.epoch),
    elements,
    solutionDate: data.orbit.soln_date,
    source: `https://ssd.jpl.nasa.gov/tools/sbdb_lookup.html#/?sstr=${id}`,
  });
}
await save("comets.json", {
  retrievedAt,
  source: "NASA/JPL SBDB",
  apiVersion: previous.apiVersion,
  comets,
});
console.log("Saved three comet orbits.");
