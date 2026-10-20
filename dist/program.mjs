const DAY_MS = 86_400_000;
const TIME_ZONE = "Europe/Istanbul";
const DATE_KEY = /^\d{4}-\d{2}-\d{2}$/;

const istanbulFormatter = new Intl.DateTimeFormat("en-GB", {
  timeZone: TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hourCycle: "h23"
});

function validDate(value) {
  const date = value instanceof Date ? new Date(value.getTime()) : new Date(value);
  if (!Number.isFinite(date.getTime())) throw new RangeError("Invalid date");
  return date;
}

function parseDateKey(value) {
  if (typeof value !== "string" || !DATE_KEY.test(value)) return null;
  const [year, month, day] = value.split("-").map(Number);
  const utc = new Date(Date.UTC(year, month - 1, day));
  if (utc.toISOString().slice(0, 10) !== value) throw new RangeError("Invalid calendar date");
  return { year, month, day, utc };
}

function dateKeyFor(value) {
  return parseDateKey(value) ? value : getIstanbulDateParts(value).dateKey;
}

function civilDate(value) {
  return parseDateKey(dateKeyFor(value)).utc;
}

/** Civil clock components in Istanbul, independent of the host's timezone. */
export function getIstanbulDateParts(value = new Date()) {
  const calendar = parseDateKey(value);
  if (calendar) {
    return { year: calendar.year, month: calendar.month, day: calendar.day,
      hour: 0, minute: 0, second: 0, dateKey: value, weekday: calendar.utc.getUTCDay() };
  }
  const date = validDate(value);
  const parts = Object.fromEntries(istanbulFormatter.formatToParts(date)
    .filter(part => part.type !== "literal")
    .map(part => [part.type, Number(part.value)]));
  const { year, month, day, hour, minute, second } = parts;
  const dateKey = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  return { year, month, day, hour, minute, second, dateKey,
    weekday: new Date(Date.UTC(year, month - 1, day)).getUTCDay() };
}

/** At 22:30 Istanbul time, display tomorrow; explicit civil dates stay fixed for previews. */
export function getDisplayDate(value = new Date()) {
  if (parseDateKey(value)) return value;
  const parts = getIstanbulDateParts(value);
  const afterCutoff = parts.hour > 22 || (parts.hour === 22 && parts.minute >= 30);
  if (!afterCutoff) return parts.dateKey;
  return new Date(Date.UTC(parts.year, parts.month - 1, parts.day + 1)).toISOString().slice(0, 10);
}

export function getProgrammePosition(value, cycleStartDate = "2026-07-13") {
  const date = civilDate(value);
  const cycleStart = civilDate(cycleStartDate);
  const daysSinceStart = Math.round((date.getTime() - cycleStart.getTime()) / DAY_MS);
  const weekOffset = Math.floor(daysSinceStart / 7);
  const weekIndex = ((weekOffset % 2) + 2) % 2;
  const dayIndex = (date.getUTCDay() + 6) % 7;
  return { weekIndex, dayIndex };
}

/** Monday through Sunday of the requested civil date, as YYYY-MM-DD strings. */
export function getWeekDates(value) {
  const date = civilDate(value);
  const dayIndex = (date.getUTCDay() + 6) % 7;
  const monday = date.getTime() - dayIndex * DAY_MS;
  return Array.from({ length: 7 }, (_, index) => new Date(monday + index * DAY_MS).toISOString().slice(0, 10));
}

/** Special events apply only to their exact date, never to another Friday. */
export function getShowForDate(data, value) {
  const date = dateKeyFor(value);
  const { weekIndex, dayIndex } = getProgrammePosition(date, data.cycleStartDate);
  const base = data.showWeeks?.[weekIndex]?.[dayIndex];
  if (!base) throw new RangeError("Programme is missing a show");
  const events = [data.currentSpecialEvent, ...(data.specialEvents || [])].filter(Boolean);
  const event = events.find(item => (item.date || item.eventDate) === date);
  const show = event ? { ...base, ...event } : { ...base };
  return {
    ...show,
    time: event?.timeLabel || event?.time || base.time || data.showTime || "21:15",
    location: show.location || "Tiyatro",
    date,
    weekIndex,
    dayIndex,
    isSpecial: Boolean(event)
  };
}

// Convert an Istanbul civil wall time to an instant using Intl's timezone rules.
function istanbulInstant(year, month, day, hour, minute) {
  const wallTime = Date.UTC(year, month - 1, day, hour, minute);
  let instant = wallTime;
  for (let step = 0; step < 3; step += 1) {
    const actual = getIstanbulDateParts(new Date(instant));
    const representedWallTime = Date.UTC(actual.year, actual.month - 1, actual.day, actual.hour, actual.minute, actual.second);
    const adjustment = wallTime - representedWallTime;
    instant += adjustment;
    if (adjustment === 0) break;
  }
  return instant;
}

/** Time until the next 22:30 in Istanbul; an exact boundary schedules tomorrow. */
export function millisecondsUntilRefresh(value = new Date()) {
  const now = validDate(value);
  const parts = getIstanbulDateParts(now);
  let target = istanbulInstant(parts.year, parts.month, parts.day, 22, 30);
  if (target <= now.getTime()) {
    const tomorrow = new Date(Date.UTC(parts.year, parts.month - 1, parts.day + 1));
    target = istanbulInstant(tomorrow.getUTCFullYear(), tomorrow.getUTCMonth() + 1, tomorrow.getUTCDate(), 22, 30);
  }
  return target - now.getTime();
}
