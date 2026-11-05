/**
 * Timezone-aware grouping helpers.
 *
 * SQL cannot group by "day in the shop's timezone" portably, so we bucket rows
 * in JavaScript instead. Data volumes here are tiny (a water station), and this
 * keeps the daily / weekly / monthly graphs correct regardless of where the
 * server runs.
 *
 * Pure functions only - safe in Node and in the browser.
 */

const MS_DAY = 86_400_000;

/** Offset of a timezone from UTC, in minutes, at a given instant. */
export function tzOffsetMinutes(timeZone, epochMs = Date.now()) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: timeZone || 'UTC',
    timeZoneName: 'longOffset',
  }).formatToParts(new Date(epochMs));
  const name = parts.find((part) => part.type === 'timeZoneName')?.value ?? 'GMT+00:00';
  const match = /GMT([+-])(\d{2}):(\d{2})/.exec(name);
  if (!match) return 0;
  const sign = match[1] === '-' ? -1 : 1;
  return sign * (Number(match[2]) * 60 + Number(match[3]));
}

function shifted(epochMs, timeZone) {
  return epochMs + tzOffsetMinutes(timeZone, epochMs) * 60_000;
}

/** "YYYY-MM-DD" in the given timezone. */
export function dayKey(epochMs, timeZone) {
  return new Date(shifted(epochMs, timeZone)).toISOString().slice(0, 10);
}

/** "YYYY-MM" in the given timezone. */
export function monthKey(epochMs, timeZone) {
  return new Date(shifted(epochMs, timeZone)).toISOString().slice(0, 7);
}

/** Hour of the day, 0-23, in the given timezone. */
export function hourOfDay(epochMs, timeZone) {
  return new Date(shifted(epochMs, timeZone)).getUTCHours();
}

/**
 * Seven consecutive "YYYY-MM-DD" keys starting on the Sunday of the week
 * containing `now`, through Saturday.
 */
export function currentWeekDayKeys(timeZone, now = Date.now()) {
  const local = shifted(now, timeZone);
  const weekday = new Date(local).getUTCDay(); // 0 = Sunday
  const sunday = new Date(local - weekday * MS_DAY).toISOString().slice(0, 10);
  return dateKeysFrom(sunday, 7);
}

/** Every "YYYY-MM-DD" key in the calendar month containing `now`. */
export function currentMonthDayKeys(timeZone, now = Date.now()) {
  const [year, month] = monthKey(now, timeZone).split('-').map(Number);
  const days = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return dateKeysFrom(`${year}-${String(month).padStart(2, '0')}-01`, days);
}

/** 24 keys for the 15th and last day of every month in the current year. */
export function currentYearHalfMonthKeys(timeZone, now = Date.now()) {
  const year = new Date(shifted(now, timeZone)).getUTCFullYear();
  const keys = [];
  for (let month = 1; month <= 12; month += 1) {
    keys.push(`${year}-${pad2(month)}-15`);
    const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
    keys.push(`${year}-${pad2(month)}-${pad2(lastDay)}`);
  }
  return keys;
}

/** Map an instant to the mid-month (15th) or end-of-month bucket key. */
export function halfMonthKey(epochMs, timeZone) {
  const [year, month, day] = dayKey(epochMs, timeZone).split('-').map(Number);
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return `${year}-${pad2(month)}-${pad2(day <= 15 ? 15 : lastDay)}`;
}

function pad2(value) {
  return String(value).padStart(2, '0');
}

function dateKeysFrom(startKey, count) {
  const startMs = Date.parse(`${startKey}T00:00:00.000Z`);
  return Array.from({ length: count }, (_, index) =>
    new Date(startMs + index * MS_DAY).toISOString().slice(0, 10),
  );
}

/** "YYYY-MM-DD" of the Monday that starts the week containing epochMs. */
export function weekKey(epochMs, timeZone) {
  const local = shifted(epochMs, timeZone);
  const weekday = new Date(local).getUTCDay(); // 0 = Sunday
  const shift = weekday === 0 ? -6 : 1 - weekday;
  return new Date(local + shift * MS_DAY).toISOString().slice(0, 10);
}

export function lastDayKeys(count, timeZone, now = Date.now()) {
  const keys = [];
  for (let i = count - 1; i >= 0; i -= 1) {
    keys.push(dayKey(now - i * MS_DAY, timeZone));
  }
  return keys;
}

export function lastWeekKeys(count, timeZone, now = Date.now()) {
  const keys = [];
  for (let i = count - 1; i >= 0; i -= 1) {
    keys.push(weekKey(now - i * 7 * MS_DAY, timeZone));
  }
  return keys;
}

export function lastMonthKeys(count, timeZone, now = Date.now()) {
  const keys = [];
  const [year, month] = monthKey(now, timeZone).split('-').map(Number);
  for (let i = count - 1; i >= 0; i -= 1) {
    const total = year * 12 + (month - 1) - i;
    const y = Math.floor(total / 12);
    const m = (total % 12) + 1;
    keys.push(`${y}-${String(m).padStart(2, '0')}`);
  }
  return keys;
}

/** 0 -> "12am", 13 -> "1pm" */
export function shortHourLabel(hour) {
  const value = ((Number(hour) % 24) + 24) % 24;
  return `${value % 12 || 12}${value < 12 ? 'am' : 'pm'}`;
}

/** "2026-10-14" -> "Oct 14" (timezone independent, used for labels). */
export function shortDayLabel(key) {
  const [, month, day] = key.split('-').map(Number);
  const names = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${names[(month ?? 1) - 1]} ${day}`;
}

/** "2026-10" -> "Oct 2026" */
export function shortMonthLabel(key) {
  const [year, month] = key.split('-').map(Number);
  const names = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${names[(month ?? 1) - 1]} ${year}`;
}

/** Bucket rows into a keyed series, filling gaps with zero. */
export function bucketSeries(rows, { keys, keyOf, valueOf }) {
  const totals = new Map(keys.map((key) => [key, 0]));
  for (const row of rows) {
    const key = keyOf(row);
    if (!totals.has(key)) continue;
    totals.set(key, totals.get(key) + valueOf(row));
  }
  return keys.map((key) => totals.get(key) ?? 0);
}
