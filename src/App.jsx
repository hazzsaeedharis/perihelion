import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowDown,
  ArrowRight,
  ArrowUpRight,
  Bell,
  Bookmark,
  CalendarDays,
  Check,
  ChevronDown,
  ExternalLink,
  Eye,
  Info,
  Layers3,
  Minus,
  Orbit,
  Pause,
  Play,
  Plus,
  Radio,
  RefreshCw,
  RotateCcw,
  Search,
  Sparkles,
  X,
} from "lucide-react";
import { Observatory } from "./scene.js";
import {
  DAY,
  calendarFile,
  cometPosition,
  isoDay,
  normalizeFeed,
  utcDate,
  validEvent,
} from "./science.mjs";

const base = import.meta.env.BASE_URL;
const meta = {
  "67P": {
    short: "67P / Churyumov–Gerasimenko",
    title: "The comet we came to know.",
    description:
      "A small, two-lobed world with a remarkable story. ESA’s Rosetta travelled alongside 67P, while Philae became the first lander to touch down on a comet.",
    tag: "ROSETTA’S DESTINATION",
    source: "https://www.esa.int/Science_Exploration/Space_Science/Rosetta",
  },
  "1P": {
    short: "1P / Halley",
    title: "An old friend. A long journey.",
    description:
      "Halley travels against the planets on a steeply tilted orbit. Its long return made it the first comet recognized as a repeat visitor to our skies.",
    tag: "THE FAMOUS RETURNING COMET",
    source: "https://science.nasa.gov/solar-system/comets/1p-halley/",
  },
  "2P": {
    short: "2P / Encke",
    title: "Around the Sun. Again.",
    description:
      "A compact, elongated orbit brings Encke back to the inner solar system about every 3.3 years. Explore how it speeds through the part of its path nearest the Sun.",
    tag: "A SHORT-PERIOD TRAVELLER",
    source: "https://science.nasa.gov/solar-system/comets/2p-encke/",
  },
};

function readWatchlist() {
  try {
    const value = JSON.parse(
      localStorage.getItem("perihelion-watchlist") || "[]",
    );
    if (!Array.isArray(value)) return [];
    return value
      .filter(
        (item) =>
          item &&
          ((item.type === "comet" && Object.hasOwn(meta, item.id)) ||
            (item.type === "event" && validEvent(item.event))),
      )
      .slice(0, 100);
  } catch {
    return [];
  }
}

function CometPortrait({ comet }) {
  const host = useRef(null),
    scene = useRef(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    if (!comet || failed) return;
    try {
      scene.current = new Observatory(host.current, () => setFailed(true));
      scene.current.setComet(comet, Date.now(), "portrait");
    } catch {
      setFailed(true);
    }
    return () => {
      scene.current?.dispose();
      scene.current = null;
    };
  }, [comet, failed]);
  return (
    <div className="hero-visual">
      <div className="portrait-host" ref={host} />
      {failed && (
        <div className="portrait-fallback">
          <Orbit size={140} />
          <span>Comet data and the explorer remain available below.</span>
        </div>
      )}
      <button
        className="portrait-reset"
        aria-label="Reset comet portrait"
        onClick={() => scene.current?.reset()}
      >
        <RotateCcw size={13} /> Reset view
      </button>
      <span className="portrait-hint">DRAG TO EXPLORE</span>
    </div>
  );
}

function App() {
  const [catalogue, setCatalogue] = useState(null),
    [loadError, setLoadError] = useState("");
  const [selected, setSelected] = useState("67P");
  const [mode, setMode] = useState("orbit"),
    [labels, setLabels] = useState(true),
    [playing, setPlaying] = useState(false);
  const [today] = useState(() => Date.parse(isoDay(Date.now()))),
    [day, setDay] = useState(0);
  const [events, setEvents] = useState([]),
    [feedStatus, setFeedStatus] = useState("loading"),
    [feedInfo, setFeedInfo] = useState(null);
  const [feedMessage, setFeedMessage] = useState(""),
    [refreshing, setRefreshing] = useState(false);
  const [query, setQuery] = useState(""),
    [filter, setFilter] = useState("all");
  const [watchlist, setWatchlist] = useState(readWatchlist),
    [toast, setToast] = useState(""),
    [dialog, setDialog] = useState(null);
  const [graphicsFailed, setGraphicsFailed] = useState(false);
  const host = useRef(null),
    viewer = useRef(null),
    dialogRef = useRef(null),
    refreshingRef = useRef(false);
  const comet = catalogue?.comets.find((c) => c.id === selected),
    info = meta[selected];
  const modelTime = today + day * DAY;

  useEffect(() => {
    let active = true;
    fetch(`${base}data/comets.json`)
      .then((r) => {
        if (!r.ok) throw Error();
        return r.json();
      })
      .then((data) => {
        if (
          !Array.isArray(data.comets) ||
          data.comets.length !== 3 ||
          data.comets.some(
            (c) =>
              !Object.hasOwn(meta, c.id) ||
              !Number.isFinite(c.epoch) ||
              ["a", "e", "i", "om", "w", "ma", "n", "per"].some(
                (k) => !Number.isFinite(c.elements?.[k]),
              ) ||
              c.elements.a <= 0 ||
              c.elements.e < 0 ||
              c.elements.e >= 1,
          )
        )
          throw Error();
        if (active) setCatalogue(data);
      })
      .catch(() => {
        if (active)
          setLoadError(
            "The comet catalogue could not load. Reload the page to try again.",
          );
      });
    async function loadFeed() {
      try {
        let snapshot;
        try {
          const cached = JSON.parse(localStorage.getItem("perihelion-feed"));
          if (
            cached &&
            cached.startDate === isoDay(today) &&
            Date.now() - Date.parse(cached.retrievedAt) < 6 * 3600000
          ) {
            const rows = normalizeFeed(cached.feed);
            if (active) {
              setEvents(rows);
              setFeedInfo(cached);
              setFeedStatus("cached");
            }
            return;
          }
        } catch {
          /* A damaged cache must not hide the bundled feed. */
        }
        const response = await fetch(`${base}data/approaches.json`);
        if (!response.ok) throw Error();
        snapshot = await response.json();
        const rows = normalizeFeed(snapshot.feed);
        if (active) {
          setEvents(rows);
          setFeedInfo(snapshot);
          setFeedStatus("snapshot");
        }
      } catch {
        if (active) {
          setFeedStatus("error");
          setFeedMessage(
            "Encounter data is unavailable. Use Refresh to try NASA.",
          );
        }
      }
    }
    loadFeed();
    return () => {
      active = false;
    };
  }, [today]);

  useEffect(() => {
    if (!host.current || !comet || graphicsFailed) return;
    try {
      viewer.current = new Observatory(host.current, () =>
        setGraphicsFailed(true),
      );
    } catch {
      setGraphicsFailed(true);
      return;
    }
    return () => {
      viewer.current?.dispose();
      viewer.current = null;
    };
  }, [!!comet, graphicsFailed]);
  useEffect(() => {
    if (comet) viewer.current?.setComet(comet, modelTime, mode);
  }, [comet, mode, graphicsFailed]);
  useEffect(() => {
    viewer.current?.updateTime(modelTime);
  }, [modelTime]);
  useEffect(() => {
    viewer.current?.setLabels(labels);
  }, [labels, !!comet, mode]);
  useEffect(() => {
    if (!playing || mode !== "orbit") return;
    const timer = setInterval(() => {
      if (document.hidden) return;
      setDay((value) => {
        if (value >= 730) {
          setPlaying(false);
          return 730;
        }
        return value + 2;
      });
    }, 90);
    return () => clearInterval(timer);
  }, [playing, mode]);
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(""), 4500);
    return () => clearTimeout(timer);
  }, [toast]);
  useEffect(() => {
    if (dialog) {
      setPlaying(false);
      dialogRef.current?.showModal();
    } else dialogRef.current?.close();
  }, [dialog]);

  function changeWatch(item) {
    const exists = watchlist.some(
      (w) => w.id === item.id && w.type === item.type,
    );
    const next = exists
      ? watchlist.filter((w) => !(w.id === item.id && w.type === item.type))
      : [...watchlist, item];
    setWatchlist(next);
    try {
      localStorage.setItem("perihelion-watchlist", JSON.stringify(next));
      setToast(
        exists
          ? "Removed from your watchlist"
          : "Saved to your watchlist on this device",
      );
    } catch {
      setToast("Saved for this session. Browser storage is unavailable.");
    }
  }
  const isSaved = (type, id) =>
    watchlist.some((w) => w.type === type && w.id === id);
  async function refreshFeed() {
    if (refreshingRef.current) return;
    refreshingRef.current = true;
    setRefreshing(true);
    setFeedMessage("");
    const startDate = isoDay(Date.now()),
      endDate = isoDay(Date.parse(startDate) + 6 * DAY);
    try {
      const response = await fetch(
        `https://api.nasa.gov/neo/rest/v1/feed?start_date=${startDate}&end_date=${endDate}&api_key=DEMO_KEY`,
        { signal: AbortSignal.timeout(15000) },
      );
      if (!response.ok)
        throw Error(
          response.status === 429
            ? "NASA’s public feed has reached its request limit."
            : "NASA’s feed could not be reached.",
        );
      const feed = await response.json(),
        rows = normalizeFeed(feed);
      const snapshot = {
        feed,
        startDate,
        endDate,
        retrievedAt: new Date().toISOString(),
      };
      setEvents(rows);
      setFeedInfo(snapshot);
      setFeedStatus("live");
      try {
        localStorage.setItem("perihelion-feed", JSON.stringify(snapshot));
      } catch {
        /* The current response remains usable without persistent storage. */
      }
      setToast("Refreshed from NASA");
    } catch (error) {
      setFeedMessage(
        `${error.name === "TimeoutError" ? "NASA took too long to respond." : error.message === "Failed to fetch" ? "NASA’s feed could not be reached." : error.message} ${events.length ? "The dated data below is still available." : "Try again later."}`,
      );
    } finally {
      refreshingRef.current = false;
      setRefreshing(false);
    }
  }
  function exportEvent(event) {
    const url = URL.createObjectURL(
      new Blob([calendarFile(event)], { type: "text/calendar;charset=utf-8" }),
    );
    const a = document.createElement("a");
    a.href = url;
    a.download = `comet-watch-${event.id}.ics`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    setToast(
      "Calendar file downloaded. Import it to set the one-hour reminder.",
    );
  }
  function navigate(next) {
    if (next === "watchlist") {
      setDialog({ type: "watchlist" });
      return;
    }
    document
      .getElementById(next === "encounters" ? "encounters" : "comets")
      ?.scrollIntoView({
        behavior: matchMedia("(prefers-reduced-motion: reduce)").matches
          ? "instant"
          : "smooth",
        block: "start",
      });
  }
  const filtered = useMemo(
    () =>
      events.filter(
        (e) =>
          e.name.toLowerCase().includes(query.toLowerCase()) &&
          (filter === "all" ||
            (filter === "near" && e.lunar < 10) ||
            (filter === "saved" && isSaved("event", e.id))),
      ),
    [events, query, filter, watchlist],
  );
  const ordered = [...filtered].sort((a, b) => a.time - b.time);
  const distance = comet ? Math.hypot(...cometPosition(comet, modelTime)) : 0;
  const feedLabel = {
    loading: "Loading data",
    snapshot: "NASA snapshot",
    cached: "Cached NASA data",
    live: "NASA refreshed",
    error: "Feed unavailable",
  }[feedStatus];
  const stale = feedInfo && feedInfo.endDate < isoDay(Date.now());

  return (
    <div className="app-shell">
      <a className="skip-link" href="#main">
        Skip to observatory
      </a>
      <header className="masthead" id="home">
        <a className="brand" href="#home" aria-label="Comet Watch home">
          <img src={`${base}icon.svg`} alt="" />
          <span>
            COMET<span className="brand-light"> WATCH</span>
            <small>AN EXPLORATION BY PDM</small>
          </span>
        </a>
        <nav aria-label="Primary navigation">
          <a href="#comets">Explore comets</a>
          <a href="#encounters">Asteroid encounters</a>
          <button onClick={() => setDialog({ type: "watchlist" })}>
            Watchlist <span>{watchlist.length}</span>
          </button>
        </nav>
        <button
          className="about-button"
          aria-label="About the science"
          onClick={() => setDialog({ type: "sources" })}
        >
          <Info size={16} />
          <span>About the science</span>
        </button>
      </header>
      <main id="main">
        <section className="hero" id="intro" aria-labelledby="hero-heading">
          <CometPortrait comet={comet} />
          <div className="hero-shade" />
          <div className="hero-copy">
            <div className="eyebrow">
              <span className="status-dot" /> YOUR COMET OBSERVATORY
            </div>
            <h1 id="hero-heading">
              Comets, up close.
              <br />
              <em>The cosmos, in motion.</em>
            </h1>
            <p>
              Explore comets in 3D. Follow their paths around the Sun, travel
              through time, and keep your next discovery in sight.
            </p>
            <div className="hero-actions">
              <button
                className="primary-button"
                onClick={() => navigate("overview")}
              >
                Explore a comet <ArrowRight size={16} />
              </button>
              <button
                className="hero-link"
                onClick={() => navigate("encounters")}
              >
                What’s passing Earth <ArrowDown size={15} />
              </button>
            </div>
            <div className="hero-footnote">
              REAL ORBITAL DATA <span>·</span> A DIFFERENT WAY TO SEE SPACE
            </div>
          </div>
          <div className="hero-object">
            <span className="eyebrow">IN THE SPOTLIGHT</span>
            <strong>{meta[selected].short}</strong>
            <span>Comet portrait · Artistic interpretation</span>
          </div>
          <div className="hero-bottom">
            <span>01 — COMETS, UP CLOSE</span>
            <a href="#comets">
              A journey worth following <ArrowDown size={13} />
            </a>
            <span>NASA / JPL ORBITAL DATA</span>
          </div>
        </section>
        <div className="main-content">
          <div className="explorer-intro" id="comets">
            <div>
              <span className="eyebrow">PICK A COMET. FOLLOW ITS JOURNEY.</span>
              <h2>Meet the wanderers.</h2>
            </div>
            <p>
              Choose a traveller, then switch between its orbit and its icy
              nucleus. Move the timeline to see where it goes.
            </p>
          </div>
          <div className="comet-choices" aria-label="Choose a comet">
            {Object.entries(meta).map(([id, m], index) => (
              <button
                key={id}
                aria-pressed={selected === id}
                className={selected === id ? "selected" : ""}
                onClick={() => {
                  setSelected(id);
                  setPlaying(false);
                }}
              >
                <span className="comet-choice-number">0{index + 1}</span>
                <Orbit size={24} />
                <span>
                  <strong>
                    {id === "67P"
                      ? "Rosetta’s comet"
                      : id === "1P"
                        ? "Halley"
                        : "Encke"}
                  </strong>
                  <small>
                    {id === "67P"
                      ? "67P / Churyumov–Gerasimenko"
                      : id === "1P"
                        ? "1P / The iconic returning comet"
                        : "2P / A 3.3-year journey"}
                  </small>
                </span>
                <ArrowUpRight size={19} />
              </button>
            ))}
          </div>
          <section
            className="observatory-panel"
            id="observatory"
            aria-labelledby="orbit-heading"
          >
            <div className="panel-header">
              <div>
                <span className="section-index">01 /</span>
                <h2 id="orbit-heading">
                  {mode === "orbit"
                    ? "Follow the orbit"
                    : "Explore the nucleus"}
                </h2>
                <span className="mini-pill">INTERACTIVE 3D</span>
              </div>
              <div className="view-tabs" aria-label="Visualization mode">
                <button
                  className={mode === "orbit" ? "selected" : ""}
                  aria-pressed={mode === "orbit"}
                  onClick={() => setMode("orbit")}
                >
                  <Orbit size={14} /> Orbit map
                </button>
                <button
                  className={mode === "nucleus" ? "selected" : ""}
                  aria-pressed={mode === "nucleus"}
                  onClick={() => {
                    setMode("nucleus");
                    setPlaying(false);
                  }}
                >
                  <Layers3 size={14} /> 3D nucleus
                </button>
              </div>
            </div>
            <div className="explorer-body">
              <div className="space-view">
                <div className="star-field" aria-hidden="true" />
                <div className="scene-top">
                  <span>
                    <i className="status-dot" />
                    {mode === "orbit" ? "HELIOCENTRIC VIEW" : "NUCLEUS STUDY"}
                  </span>
                  <span>
                    {mode === "orbit"
                      ? "AU · LINEAR DISTANCES"
                      : "ILLUSTRATIVE GEOMETRY"}
                  </span>
                </div>
                <div className="scene-host" ref={host} />
                {(!comet || graphicsFailed) && (
                  <div className="scene-fallback">
                    <Orbit size={64} />
                    <h3>
                      {graphicsFailed
                        ? "Explore the data below"
                        : loadError
                          ? "Catalogue unavailable"
                          : "Opening the observatory…"}
                    </h3>
                    <p>
                      {graphicsFailed
                        ? "3D graphics are unavailable in this browser. Orbital facts, the timeline and watchlist still work."
                        : loadError}
                    </p>
                  </div>
                )}
                <div className="scene-tools">
                  <button
                    className="icon-button"
                    title="Zoom in"
                    aria-label="Zoom in"
                    onClick={() => viewer.current?.zoom(0.8)}
                  >
                    <Plus size={16} />
                  </button>
                  <button
                    className="icon-button"
                    title="Zoom out"
                    aria-label="Zoom out"
                    onClick={() => viewer.current?.zoom(1.25)}
                  >
                    <Minus size={16} />
                  </button>
                  <span />
                  <button
                    className="icon-button"
                    title="Top view"
                    aria-label="Top view"
                    onClick={() => viewer.current?.reset(true)}
                  >
                    <Layers3 size={16} />
                  </button>
                  <button
                    className="icon-button"
                    title="Reset camera"
                    aria-label="Reset camera"
                    onClick={() => viewer.current?.reset()}
                  >
                    <RotateCcw size={16} />
                  </button>
                </div>
                <div className="scene-bottom" hidden={mode !== "orbit"}>
                  <span>
                    <span className="legend-line" />
                    {selected} trajectory <span className="legend-dot" />
                    Planet orbit
                  </span>
                  <button
                    aria-pressed={labels}
                    onClick={() => setLabels(!labels)}
                  >
                    <Eye size={14} />
                    {labels ? "Labels on" : "Labels off"}
                  </button>
                </div>
                <div className="scene-caption">
                  {mode === "orbit"
                    ? "Drag to orbit · Scroll to zoom · Body markers enlarged"
                    : "Drag to rotate · Shape and surface are artistic, not measured"}
                </div>
              </div>
              <aside className="object-panel">
                <label className="field-label" htmlFor="comet-select">
                  SELECTED COMET
                </label>
                <div className="select-wrap">
                  <select
                    id="comet-select"
                    value={selected}
                    onChange={(e) => {
                      setSelected(e.target.value);
                      setPlaying(false);
                    }}
                  >
                    {Object.entries(meta).map(([id, m]) => (
                      <option key={id} value={id}>
                        {m.short}
                      </option>
                    ))}
                  </select>
                  <ChevronDown size={16} />
                </div>
                <div className="comet-number">
                  {selected}
                  <span>✦</span>
                </div>
                <span className="object-tag">{info.tag}</span>
                <h3>{info.title}</h3>
                <p className="object-description">{info.description}</p>
                <div className="object-facts">
                  <div>
                    <span>Orbital period</span>
                    <strong>
                      {comet ? (comet.elements.per / 365.25).toFixed(2) : "—"}{" "}
                      <small>years</small>
                    </strong>
                  </div>
                  <div>
                    <span>Distance from Sun</span>
                    <strong>
                      {comet ? distance.toFixed(2) : "—"} <small>AU</small>
                    </strong>
                  </div>
                  <div>
                    <span>Orbital inclination</span>
                    <strong>
                      {comet ? comet.elements.i.toFixed(1) : "—"}
                      <small>°</small>
                    </strong>
                  </div>
                </div>
                <button
                  className={`primary-button ${isSaved("comet", selected) ? "saved" : ""}`}
                  onClick={() => changeWatch({ type: "comet", id: selected })}
                >
                  {isSaved("comet", selected) ? (
                    <Check size={16} />
                  ) : (
                    <Plus size={16} />
                  )}{" "}
                  {isSaved("comet", selected)
                    ? "On your watchlist"
                    : "Add to watchlist"}
                </button>
                <a
                  className="text-link"
                  href={info.source}
                  target="_blank"
                  rel="noreferrer"
                >
                  Meet the comet <ArrowUpRight size={14} />
                </a>
              </aside>
            </div>
            <div className="timeline">
              <button
                className="play-button"
                disabled={!comet || mode === "nucleus"}
                aria-label={playing ? "Pause simulation" : "Play simulation"}
                onClick={() => {
                  if (day >= 730) setDay(-730);
                  setPlaying(!playing);
                }}
              >
                {playing ? <Pause size={15} /> : <Play size={15} />}
              </button>
              <div className="timeline-date">
                <span>MODEL DATE · UTC</span>
                <strong>{utcDate(modelTime)}</strong>
              </div>
              <div className="scrubber">
                <input
                  aria-label="Simulation date"
                  type="range"
                  min="-730"
                  max="730"
                  step="1"
                  value={day}
                  disabled={mode === "nucleus"}
                  onChange={(e) => {
                    setPlaying(false);
                    setDay(Number(e.target.value));
                  }}
                />
                <div>
                  <span>{utcDate(today - 730 * DAY, { day: undefined })}</span>
                  <span>Explore through time</span>
                  <span>{utcDate(today + 730 * DAY, { day: undefined })}</span>
                </div>
              </div>
              <button
                className="today-button"
                onClick={() => {
                  setDay(0);
                  setPlaying(false);
                }}
              >
                Today <RotateCcw size={12} />
              </button>
            </div>
            <div className="science-note">
              <Info size={13} />
              <span>
                Educational orbit model. Positions are approximate; this is not
                a sky-visibility forecast.
              </span>
              <button onClick={() => setDialog({ type: "sources" })}>
                How it works <ArrowUpRight size={12} />
              </button>
            </div>
          </section>

          <section
            className="encounter-section"
            id="encounters"
            aria-labelledby="encounter-heading"
          >
            <div className="section-heading">
              <div>
                <div className="eyebrow">ALSO IN OUR NEIGHBOURHOOD</div>
                <h2 id="encounter-heading">
                  Asteroids passing Earth<span>.</span>
                </h2>
                <p>
                  {feedInfo
                    ? `${utcDate(Date.parse(feedInfo.startDate))} – ${utcDate(Date.parse(feedInfo.endDate))} · NASA close-approach estimates`
                    : "Seven days of asteroid close approaches, from NASA."}
                </p>
              </div>
              <button
                className="outline-button"
                disabled={refreshing}
                onClick={refreshFeed}
              >
                <RefreshCw size={14} className={refreshing ? "spin" : ""} />
                {refreshing ? "Refreshing…" : "Refresh NASA data"}
              </button>
            </div>
            <div className="feed-notice">
              <span className={`status-dot ${stale ? "amber" : ""}`} />
              <span>
                {feedInfo
                  ? `${stale ? "Archived data" : feedLabel} · Retrieved ${utcDate(Date.parse(feedInfo.retrievedAt), { hour: "2-digit", minute: "2-digit" })} UTC`
                  : "Waiting for encounter data…"}
              </span>
              <span className="feed-notice-right">
                1 lunar distance ≈ 384,400 km
              </span>
            </div>
            {feedMessage && (
              <p className="error-notice" role="status">
                {feedMessage}
              </p>
            )}
            {stale && (
              <p className="error-notice">
                This snapshot’s date range has passed. Refresh to retrieve the
                current week.
              </p>
            )}
            <div className="table-controls">
              <div className="filter-tabs" aria-label="Filter approaches">
                {[
                  ["all", "All approaches"],
                  ["near", "Within 10 LD"],
                  ["saved", "Saved"],
                ].map(([id, label]) => (
                  <button
                    key={id}
                    className={filter === id ? "selected" : ""}
                    aria-pressed={filter === id}
                    onClick={() => setFilter(id)}
                  >
                    {label}
                    {id === "all" && <span>{events.length}</span>}
                  </button>
                ))}
              </div>
              <label className="search-box">
                <Search size={15} />
                <input
                  aria-label="Search asteroid names"
                  placeholder="Find an asteroid…"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                />
                {query && (
                  <button
                    className="icon-button"
                    aria-label="Clear search"
                    onClick={() => setQuery("")}
                  >
                    <X size={13} />
                  </button>
                )}
              </label>
            </div>
            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>OBJECT</th>
                    <th>CLOSEST APPROACH · UTC</th>
                    <th>MISS DISTANCE</th>
                    <th>EST. DIAMETER</th>
                    <th>VELOCITY</th>
                    <th>
                      <span className="sr-only">Actions</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {ordered.map((event) => (
                    <tr key={event.id}>
                      <td>
                        <button
                          className="object-name"
                          onClick={() => setDialog({ type: "event", event })}
                        >
                          <span className="asteroid-icon">
                            <Orbit size={17} />
                          </span>
                          <span>
                            {event.name}
                            <small>
                              ASTEROID
                              {event.time < Date.now() ? " · PASSED" : ""}
                            </small>
                          </span>
                        </button>
                      </td>
                      <td>
                        {utcDate(event.time, { year: undefined })}
                        <small>
                          {new Date(event.time).toISOString().slice(11, 16)} UTC
                        </small>
                      </td>
                      <td>
                        <span
                          className={event.lunar < 10 ? "near-distance" : ""}
                        >
                          {event.lunar.toFixed(2)}{" "}
                          <span className="muted">LD</span>
                        </span>
                        <small>
                          {(event.km / 1000000).toFixed(2)} million km
                        </small>
                      </td>
                      <td>
                        {Math.round(event.minDiameter)}–
                        {Math.round(event.maxDiameter)}{" "}
                        <span className="muted">m</span>
                      </td>
                      <td>
                        {event.speed.toFixed(1)}{" "}
                        <span className="muted">km/s</span>
                      </td>
                      <td>
                        <div className="row-actions">
                          <button
                            className={`icon-button ${isSaved("event", event.id) ? "is-saved" : ""}`}
                            aria-label={`${isSaved("event", event.id) ? "Unsave" : "Save"} ${event.name}`}
                            aria-pressed={isSaved("event", event.id)}
                            onClick={() =>
                              changeWatch({
                                type: "event",
                                id: event.id,
                                event,
                              })
                            }
                          >
                            <Bookmark size={15} />
                          </button>
                          <button
                            className="icon-button"
                            aria-label={`View ${event.name}`}
                            onClick={() => setDialog({ type: "event", event })}
                          >
                            <ArrowUpRight size={16} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {!ordered.length && (
              <div className="empty-state">
                <Search size={26} />
                <h3>
                  {feedStatus === "loading"
                    ? "Loading approaches…"
                    : "No matching approaches"}
                </h3>
                <p>
                  {events.length
                    ? "Try another name or change the filter."
                    : "Refresh NASA data to check the current week."}
                </p>
              </div>
            )}
            <div className="table-footer">
              <span>
                {ordered.length} of {events.length} encounters
              </span>
              <span>
                Close approach ≠ visible overhead.{" "}
                <button onClick={() => setDialog({ type: "sources" })}>
                  Learn why <ArrowUpRight size={12} />
                </button>
              </span>
            </div>
          </section>
          <section className="discovery-banner">
            <div className="discovery-symbol">
              <Sparkles size={31} />
            </div>
            <div>
              <span className="eyebrow">ONE CURIOSITY LEADS TO ANOTHER</span>
              <h3>From our orbit to the edge of understanding.</h3>
              <p>
                Continue your journey with the ISS and TON 618 observatories.
              </p>
            </div>
            <a
              href="https://hazzsaeedharis.github.io/iss-observatory/"
              target="_blank"
              rel="noreferrer"
            >
              Explore the ISS <ArrowUpRight size={16} />
            </a>
            <a
              href="https://hazzsaeedharis.github.io/ton-618-observatory/"
              target="_blank"
              rel="noreferrer"
            >
              Enter TON 618 <ArrowUpRight size={16} />
            </a>
          </section>
          <footer>
            <span>
              <strong>COMET WATCH</strong> A PDM Space Lab exploration.
            </span>
            <button onClick={() => setDialog({ type: "sources" })}>
              Science, sources & a little perspective <ArrowUpRight size={13} />
            </button>
          </footer>
        </div>
      </main>

      <dialog
        ref={dialogRef}
        onCancel={() => setDialog(null)}
        onClick={(e) => {
          if (e.target === dialogRef.current) setDialog(null);
        }}
        aria-labelledby="dialog-title"
      >
        <button
          className="dialog-close icon-button"
          aria-label="Close dialog"
          onClick={() => setDialog(null)}
        >
          <X size={20} />
        </button>
        {dialog?.type === "sources" && (
          <>
            <span className="eyebrow">A LITTLE PERSPECTIVE</span>
            <h2 id="dialog-title">The science behind the view.</h2>
            <p>
              Comet Watch brings real orbital data into an educational,
              interactive view. Here is what you are looking at.
            </p>
            <div className="source-block">
              <h3>Orbits, not observing predictions</h3>
              <p>
                Comets use JPL Small-Body Database orbital elements in a
                two-body Kepler model. Planet positions use JPL’s approximate
                elements for 1800–2050. Earth marks the Earth–Moon barycenter.
                Planetary perturbations, outgassing and the small UTC–TDB time
                difference are omitted.
              </p>
              <p>
                Distances use a linear AU scale. Markers and glows are enlarged.
                Nucleus geometry is an artistic study, not a measured shape
                model.
              </p>
              <a
                href="https://ssd.jpl.nasa.gov/planets/approx_pos.html"
                target="_blank"
                rel="noreferrer"
              >
                JPL planetary model <ArrowUpRight size={13} />
              </a>
              {comet && (
                <a href={comet.source} target="_blank" rel="noreferrer">
                  {selected} orbital elements <ArrowUpRight size={13} />
                </a>
              )}
              <small>
                Comet elements retrieved{" "}
                {catalogue ? utcDate(Date.parse(catalogue.retrievedAt)) : "—"}.
                Selected orbit solution: {comet?.solutionDate || "—"}.
              </small>
            </div>
            <div className="source-block">
              <h3>A close approach is not an impact alert</h3>
              <p>
                Encounter times, estimated size ranges and miss distances come
                from NASA NeoWs. “Potentially hazardous” is a catalogue
                classification, not a prediction of impact. This site does not
                calculate impact probabilities.
              </p>
              <p>
                Visibility depends on brightness, your location, the Sun, and
                observing conditions. Being close to Earth does not mean a comet
                or asteroid can be seen overhead.
              </p>
              <a href="https://api.nasa.gov/" target="_blank" rel="noreferrer">
                NASA Open APIs <ArrowUpRight size={13} />
              </a>
            </div>
            <div className="source-block">
              <h3>Your data & reminders</h3>
              <p>
                Your watchlist is stored in this browser. Calendar downloads
                include a reminder one hour before the listed encounter; import
                the file into your calendar to enable it. The website does not
                send background or push alerts.
              </p>
              <p>
                Refresh requests go directly to NASA with its shared public demo
                key. Requests can be rate-limited. A dated snapshot is bundled,
                and successful updates are cached for six hours.
              </p>
            </div>
          </>
        )}
        {dialog?.type === "watchlist" && (
          <>
            <span className="eyebrow">YOUR CORNER OF THE COSMOS</span>
            <h2 id="dialog-title">Keep something in sight.</h2>
            <p>
              {watchlist.length} saved{" "}
              {watchlist.length === 1 ? "object" : "objects"} · Stored on this
              device
            </p>
            {!watchlist.length ? (
              <div className="empty-state">
                <Bookmark size={34} />
                <h3>A universe of possibilities.</h3>
                <p>Save a comet or an Earth encounter to find it here.</p>
                <button
                  className="primary-button"
                  onClick={() => setDialog(null)}
                >
                  Start exploring <ArrowRight size={15} />
                </button>
              </div>
            ) : (
              <div className="watch-items">
                {watchlist.map((item) => (
                  <article
                    className="watch-item"
                    key={`${item.type}-${item.id}`}
                  >
                    <span className="asteroid-icon">
                      {item.type === "comet" ? (
                        <Orbit size={20} />
                      ) : (
                        <Radio size={20} />
                      )}
                    </span>
                    <div>
                      <h3>
                        {item.type === "comet"
                          ? meta[item.id].short
                          : item.event.name}
                      </h3>
                      <p>
                        {item.type === "comet"
                          ? "Comet · Orbital explorer"
                          : `${utcDate(item.event.time)} · ${item.event.lunar.toFixed(2)} LD${item.event.time < Date.now() ? " · Passed" : ""}`}
                      </p>
                      <button
                        className="text-link"
                        onClick={() => {
                          if (item.type === "comet") {
                            setSelected(item.id);
                            setDialog(null);
                            navigate("overview");
                          } else
                            setDialog({ type: "event", event: item.event });
                        }}
                      >
                        Explore object <ArrowUpRight size={13} />
                      </button>
                    </div>
                    {item.type === "event" && (
                      <button
                        className="icon-button"
                        title="Download calendar reminder"
                        aria-label={`Download reminder for ${item.event.name}`}
                        onClick={() => exportEvent(item.event)}
                      >
                        <CalendarDays size={17} />
                      </button>
                    )}
                    <button
                      className="icon-button"
                      aria-label={`Remove ${item.type === "comet" ? item.id : item.event.name}`}
                      onClick={() => changeWatch(item)}
                    >
                      <X size={16} />
                    </button>
                  </article>
                ))}
              </div>
            )}
            <div className="dialog-note">
              <Bell size={16} />
              <p>
                For an encounter reminder, download its calendar file and import
                it. Alerts do not run in the background.
              </p>
            </div>
          </>
        )}
        {dialog?.type === "event" && (
          <>
            <span className="eyebrow">EARTH CLOSE APPROACH</span>
            <h2 id="dialog-title">{dialog.event.name}</h2>
            <p>
              {utcDate(dialog.event.time, {
                hour: "2-digit",
                minute: "2-digit",
              })}{" "}
              UTC
              {dialog.event.time < Date.now()
                ? " · This encounter has passed"
                : ""}
            </p>
            <div className="event-distance">
              {dialog.event.lunar.toFixed(2)} <span>lunar distances</span>
            </div>
            <p className="event-distance-caption">
              {Math.round(dialog.event.km).toLocaleString("en-GB")} km from
              Earth at closest approach
            </p>
            <div className="event-detail-grid">
              <div>
                <span>Estimated diameter</span>
                <strong>
                  {Math.round(dialog.event.minDiameter)}–
                  {Math.round(dialog.event.maxDiameter)} m
                </strong>
              </div>
              <div>
                <span>Relative velocity</span>
                <strong>{dialog.event.speed.toFixed(2)} km/s</strong>
              </div>
              <div>
                <span>NASA classification</span>
                <strong>
                  {dialog.event.hazardous
                    ? "Potentially hazardous"
                    : "Not classified as potentially hazardous"}
                </strong>
              </div>
            </div>
            <p className="dialog-note">
              This is an orbital encounter estimate, not an impact warning or
              visibility forecast. The size is an estimated range.
            </p>
            <div className="dialog-actions">
              <button
                className="primary-button"
                onClick={() => exportEvent(dialog.event)}
              >
                <CalendarDays size={16} /> Download calendar reminder
              </button>
              <button
                className="outline-button"
                onClick={() =>
                  changeWatch({
                    type: "event",
                    id: dialog.event.id,
                    event: dialog.event,
                  })
                }
              >
                {isSaved("event", dialog.event.id) ? (
                  <Check size={16} />
                ) : (
                  <Bookmark size={16} />
                )}{" "}
                {isSaved("event", dialog.event.id) ? "Saved" : "Save"}
              </button>
            </div>
            <p className="small-print">
              Import the .ics file into your calendar. Includes a one-hour
              reminder.
            </p>
            <a
              className="text-link"
              href={`https://ssd.jpl.nasa.gov/tools/sbdb_lookup.html#/?sstr=${dialog.event.neoId}`}
              target="_blank"
              rel="noreferrer"
            >
              Open JPL’s object record <ExternalLink size={13} />
            </a>
          </>
        )}
      </dialog>
      <div className={`toast ${toast ? "visible" : ""}`} role="status">
        {toast && (
          <>
            <Check size={16} />
            {toast}
          </>
        )}
      </div>
    </div>
  );
}
export default App;
