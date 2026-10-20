import {
  getDisplayDate,
  getIstanbulDateParts,
  getProgrammePosition,
  getShowForDate,
  getWeekDates,
  millisecondsUntilRefresh
} from "./program.mjs?v=20261020-2230";

const byId = id => document.getElementById(id);
const asset = name => new URL(`./assets/${encodeURIComponent(name)}`, import.meta.url).href;
const dateFormatter = new Intl.DateTimeFormat("de-DE", { timeZone: "UTC", weekday: "long", day: "numeric", month: "long" });
const monthFormatter = new Intl.DateTimeFormat("de-DE", { timeZone: "UTC", month: "long" });
const dayFormatter = new Intl.DateTimeFormat("de-DE", { timeZone: "UTC", weekday: "long" });
const shortDateFormatter = new Intl.DateTimeFormat("de-DE", { timeZone: "UTC", day: "numeric", month: "short" });
const toDate = dateKey => new Date(`${dateKey}T12:00:00Z`);
const translate = text => ({
  "Canlı Müzik": "Live-Musik", "Sabah Gym": "Morgengymnastik", "Dart": "Darts",
  "Deniz Gym": "Meeresgymnastik", "Su Gym": "Wassergymnastik", "Su Topu": "Wasserball",
  "Aqua Yoga": "Aqua-Yoga", "Tiyatro": "Theater", "Kapalı Havuz": "Hallenbad",
  "Havuz Alanı": "Poolbereich", "Sahne": "Bühne", "Akşam": "Am Abend",
  "Animatör Olga": "Animateurin Olga"
}[text] || text);

const iconPaths = {
  radio: '<path d="M5 10h22v18H5zM9 6l15-4M10 14h12M10 19h3M10 23h3"/><circle cx="22" cy="22" r="3"/>',
  gym: '<circle cx="16" cy="5" r="3"/><path d="M16 8v11M7 11l9 3 9-3M16 19l-7 10M16 19l7 10"/>',
  boccia: '<circle cx="11" cy="20" r="6"/><circle cx="23" cy="20" r="5"/><circle cx="19" cy="7" r="3"/>',
  darts: '<circle cx="15" cy="18" r="11"/><circle cx="15" cy="18" r="6"/><path d="M15 18L29 4M23 4h6v6"/>',
  water: '<path d="M3 17q4-5 8 0t8 0t10 0M3 24q4-5 8 0t8 0t10 0"/><circle cx="17" cy="5" r="3"/><path d="M6 11l9-2 10 4"/>',
  ball: '<circle cx="16" cy="16" r="13"/><path d="M5 9c10 1 13 8 11 20M26 8c-8 4-13 5-21 7M9 27c2-8 6-12 18-10"/>',
  yoga: '<circle cx="16" cy="5" r="3"/><path d="M16 8v9M9 12l7 3 7-3M16 17l-9 8M16 17l9 8M7 25q9 6 18 0M3 26l5-4M29 26l-5-4"/>'
};

function activityIcon(title) {
  const kind = /Radio/.test(title) ? "radio" : /Aqua/.test(title) ? "yoga" : /Boccia/.test(title) ? "boccia"
    : /Dart/.test(title) ? "darts" : /Topu|Wasserball/.test(title) ? "ball"
      : /Deniz|Su Gym|Meeres|Wasser/.test(title) ? "water" : "gym";
  const span = document.createElement("span");
  span.className = "icon activity-icon";
  span.setAttribute("aria-hidden", "true");
  span.innerHTML = `<svg viewBox="0 0 32 32" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">${iconPaths[kind]}</svg>`;
  return span;
}

function setText(id, text) {
  const element = byId(id);
  if (element) element.textContent = text;
}

function make(tag, className, text) {
  const element = document.createElement(tag);
  if (className) element.className = className;
  if (text !== undefined) element.textContent = text;
  return element;
}

function getPreviewDate() {
  const value = new URLSearchParams(location.search).get("date");
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  try {
    getWeekDates(value);
    return value;
  } catch {
    return null;
  }
}

const previewDate = getPreviewDate();
let programme;
let renderedDate;
let refreshTimer;
let refreshAt;
let reloadStarted = false;

function weekRange(dates, weekIndex) {
  const first = toDate(dates[0]);
  const last = toDate(dates[6]);
  const sameMonth = first.getUTCMonth() === last.getUTCMonth();
  const start = sameMonth ? `${first.getUTCDate()}.` : `${first.getUTCDate()}. ${monthFormatter.format(first)}`;
  return `${start}–${last.getUTCDate()}. ${monthFormatter.format(last)} · Woche ${weekIndex + 1}`.toLocaleUpperCase("de-DE");
}

function renderActivities(date) {
  const element = byId("activities");
  if (!element) return;
  element.replaceChildren();
  const isSunday = getProgrammePosition(date, programme.cycleStartDate).dayIndex === 6;
  if (isSunday) {
    const notice = make("div", "day-off-notice");
    notice.append(make("strong", "day-off-title", "Ruhetag des Animationsteams"),
      make("p", "day-off-copy", "Heute finden keine Tagesaktivitäten statt. Morgen sind wir wieder für Sie da."));
    element.append(notice);
    setText("wellness-note", "");
    return;
  }
  const activities = [...(programme.wellness ? [programme.wellness] : []), ...programme.activities]
    .sort((left, right) => left.time.localeCompare(right.time));
  for (const activity of activities) {
    const row = make("div", "activity-row");
    const time = make("time", "activity-time", activity.time);
    time.dateTime = activity.time;
    const needsReservation = activity === programme.wellness && activity.reservationRequired;
    const name = make("span", "activity-name", `${translate(activity.titleDe || activity.title)}${needsReservation ? "*" : ""}`);
    row.append(activityIcon(activity.title), time, name);
    element.append(row);
  }
  const wellness = programme.wellness;
  setText("wellness-note", wellness?.reservationRequired
    ? "*Aqua-Yoga: Reservierung erforderlich" : "");
}

function renderWeek(dates) {
  const grid = byId("week-grid");
  if (!grid) return;
  grid.replaceChildren();
  for (const [index, date] of dates.entries()) {
    const show = getShowForDate(programme, date);
    const title = translate(show.titleDe || show.title);
    const current = date === renderedDate;
    const card = make("article", `day-card${current ? " is-today" : ""}${show.isSpecial ? " is-special" : ""}`);
    if (current) {
      card.setAttribute("aria-current", "date");
      card.append(make("span", "today-badge", "HEUTE"));
    }
    card.append(make("h3", "day-name", dayFormatter.format(toDate(date)).toLocaleUpperCase("de-DE")));
    const poster = make("div", "day-poster");
    const image = make("img");
    image.src = asset(show.poster);
    image.alt = title;
    image.decoding = "async";
    const showTime = show.isSpecial
      ? `${shortDateFormatter.format(toDate(date))} • ABENDS`
      : translate(show.time);
    poster.append(image, make("div", "day-show-name", title.toLocaleUpperCase("de-DE")),
      make("div", "day-show-time", showTime.toLocaleUpperCase("de-DE")));
    card.append(poster);
    const footer = make("div", "mini-footer");
    if (index === 6) {
      footer.classList.add("is-day-off");
      footer.append(make("span", "day-off-footer-label", "ANIMATIONSTEAM"),
        make("span", "day-off-footer-value", "HAT FREI"));
    } else {
      const image = make("img");
      image.src = asset("event-mini-disco.jpg");
      image.alt = "";
      image.decoding = "async";
      footer.append(image, make("span", "mini-name", "MINI-DISCO"), make("time", "mini-time", programme.miniDisco?.time || "20:30"));
    }
    card.append(footer);
    grid.append(card);
  }
}

function renderProgramme(date = previewDate || getDisplayDate()) {
  if (!programme) return;
  renderedDate = date;
  const show = getShowForDate(programme, date);
  const dates = getWeekDates(date);
  const { weekIndex } = getProgrammePosition(date, programme.cycleStartDate);
  const title = translate(show.titleDe || show.title);
  const heroPanel = byId("hero-panel");
  if (heroPanel) {
    heroPanel.classList.toggle("is-long-title", title.length > 15);
    heroPanel.classList.toggle("is-special", show.isSpecial);
  }
  setText("week-range", weekRange(dates, weekIndex));
  setText("current-date", dateFormatter.format(toDate(date)).toLocaleUpperCase("de-DE"));
  setText("hero-title", title.toLocaleUpperCase("de-DE"));
  setText("hero-time", translate(show.time).toLocaleUpperCase("de-DE"));
  setText("hero-location", translate(show.location).toLocaleUpperCase("de-DE"));
  const poster = byId("hero-poster");
  if (poster) {
    poster.src = asset(show.poster);
    poster.alt = translate(show.titleDe || show.title);
  }
  renderActivities(date);
  renderWeek(dates);
}

function scheduleRefresh(now = new Date()) {
  clearTimeout(refreshTimer);
  refreshAt = now.getTime() + millisecondsUntilRefresh(now);
  refreshTimer = setTimeout(checkDailyState, Math.max(1, refreshAt - Date.now()));
}

function checkDailyState() {
  const now = new Date();
  // Roll the programme forward at 22:30, before reloading the page.
  if (!previewDate && renderedDate !== getDisplayDate(now)) renderProgramme(getDisplayDate(now));
  if (reloadStarted || now.getTime() < refreshAt) return;
  const boundaryKey = getIstanbulDateParts(new Date(refreshAt)).dateKey;
  let alreadyRefreshed = false;
  try {
    alreadyRefreshed = sessionStorage.getItem("port-side-tv-refreshed-on") === boundaryKey;
    if (!alreadyRefreshed) sessionStorage.setItem("port-side-tv-refreshed-on", boundaryKey);
  } catch { /* TV privacy settings may disable storage. The in-memory guard remains. */ }
  if (alreadyRefreshed) {
    scheduleRefresh(now);
    return;
  }
  reloadStarted = true;
  location.reload();
}

const WEATHER_CACHE_KEY = "port-side-tv-weather-v1";
const WEATHER_INTERVAL = 30 * 60 * 1000;
const WEATHER_MAX_AGE = 24 * 60 * 60 * 1000;
const weatherDescriptions = {
  0: "Klar", 1: "Überwiegend klar", 2: "Teilweise bewölkt", 3: "Bewölkt",
  45: "Nebel", 48: "Nebel", 51: "Leichter Nieselregen", 53: "Nieselregen", 55: "Starker Nieselregen",
  56: "Gefrierender Nieselregen", 57: "Gefrierender Nieselregen", 61: "Leichter Regen", 63: "Regen", 65: "Starker Regen",
  66: "Gefrierender Regen", 67: "Gefrierender Regen", 71: "Leichter Schnee", 73: "Schnee", 75: "Starker Schnee",
  77: "Schneegriesel", 80: "Regenschauer", 81: "Regenschauer", 82: "Starke Schauer",
  85: "Schneeschauer", 86: "Starke Schneeschauer", 95: "Gewitter", 96: "Gewitter mit Hagel", 99: "Gewitter mit Hagel"
};

function weatherIcon(code, isDay) {
  if (code === 0) return isDay ? "☀" : "☾";
  if ([1, 2].includes(code)) return isDay ? "🌤" : "☁";
  if (code === 3) return "☁";
  if ([45, 48].includes(code)) return "🌫";
  if (code >= 95) return "⛈";
  if ([71, 73, 75, 77, 85, 86].includes(code)) return "❄";
  return "🌧";
}

function readWeatherCache() {
  try {
    const data = JSON.parse(localStorage.getItem(WEATHER_CACHE_KEY));
    const age = Date.now() - data?.savedAt;
    if (data && Number.isFinite(data.temperature) && Number.isFinite(data.code)
      && Number.isFinite(age) && age >= 0 && age <= WEATHER_MAX_AGE) return data;
  } catch { /* Empty or disabled local storage is expected on some televisions. */ }
  return null;
}

function renderWeather(data, stale = false) {
  if (!data) {
    setText("weather-icon", "☁");
    setText("weather-temp", "—°");
    setText("weather-condition", "WETTER NICHT VERFÜGBAR");
    return;
  }
  setText("weather-icon", weatherIcon(data.code, data.isDay));
  setText("weather-temp", `${Math.round(data.temperature)}°`);
  const description = data.code === 0 && data.isDay ? "Sonnig" : weatherDescriptions[data.code] || "Wetter";
  setText("weather-condition", `${description}${stale ? " · letzter Stand" : ""}`.toLocaleUpperCase("de-DE"));
}

let weatherRequestPending = false;
async function updateWeather() {
  if (weatherRequestPending) return;
  weatherRequestPending = true;
  const cache = readWeatherCache();
  if (cache) renderWeather(cache, Date.now() - cache.savedAt > WEATHER_INTERVAL);
  const abort = new AbortController();
  const timeout = setTimeout(() => abort.abort(), 8000);
  try {
    const query = new URLSearchParams({
      latitude: "36.812", longitude: "31.350", current: "temperature_2m,weather_code,is_day",
      timezone: "Europe/Istanbul", forecast_days: "1"
    });
    const response = await fetch(`https://api.open-meteo.com/v1/forecast?${query}`, { signal: abort.signal });
    if (!response.ok) throw new Error("Weather service unavailable");
    const result = await response.json();
    const current = result.current;
    if (!Number.isFinite(current?.temperature_2m) || !Number.isFinite(current?.weather_code)) throw new Error("Invalid weather data");
    const data = { temperature: current.temperature_2m, code: current.weather_code, isDay: current.is_day, savedAt: Date.now() };
    renderWeather(data);
    try { localStorage.setItem(WEATHER_CACHE_KEY, JSON.stringify(data)); } catch { /* Weather still works without caching. */ }
  } catch {
    renderWeather(cache, Boolean(cache));
  } finally {
    clearTimeout(timeout);
    weatherRequestPending = false;
  }
}

const PROGRAMME_CACHE_KEY = "port-side-tv-programme-v1";

function isValidProgramme(data) {
  return data && typeof data.cycleStartDate === "string"
    && Array.isArray(data.showWeeks) && data.showWeeks.length === 2
    && data.showWeeks.every(week => Array.isArray(week) && week.length === 7
      && week.every(show => typeof show?.title === "string" && typeof show.poster === "string"))
    && Array.isArray(data.activities)
    && data.activities.every(activity => typeof activity?.title === "string" && typeof activity.time === "string");
}

function readProgrammeCache() {
  try {
    const data = JSON.parse(localStorage.getItem(PROGRAMME_CACHE_KEY));
    return isValidProgramme(data) ? data : null;
  } catch {
    return null;
  }
}

async function start() {
  scheduleRefresh();
  setInterval(checkDailyState, 60_000);
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) {
      checkDailyState();
      const cache = readWeatherCache();
      if (!cache || Date.now() - cache.savedAt >= WEATHER_INTERVAL) updateWeather();
    }
  });
  window.addEventListener("focus", checkDailyState);
  renderWeather(readWeatherCache(), true);
  updateWeather();
  setInterval(updateWeather, WEATHER_INTERVAL);
  const programmeAbort = new AbortController();
  const programmeTimeout = setTimeout(() => programmeAbort.abort(), 8000);
  try {
    const response = await fetch(new URL("./program.json", import.meta.url), { cache: "no-store", signal: programmeAbort.signal });
    if (!response.ok) throw new Error("Programme unavailable");
    const latestProgramme = await response.json();
    if (!isValidProgramme(latestProgramme)) throw new Error("Invalid programme");
    programme = latestProgramme;
    renderProgramme();
    try { localStorage.setItem(PROGRAMME_CACHE_KEY, JSON.stringify(programme)); } catch { /* Rendering does not require storage. */ }
  } catch {
    programme = readProgrammeCache();
    if (programme) {
      renderProgramme();
    } else {
      setText("hero-title", "PROGRAMM NICHT VERFÜGBAR");
      setText("hero-time", "");
      setText("hero-location", "Die Verbindung wird beim nächsten Laden erneut geprüft.");
    }
  } finally {
    clearTimeout(programmeTimeout);
  }
}

start();
