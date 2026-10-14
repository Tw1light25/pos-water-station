/**
 * Store open/closed logic.
 *
 * Pure functions only (no Node or DOM APIs), so the same code runs in the
 * admin UI, on the customer site and on the Cloudflare/Netlify side. The admin
 * server serves this exact file to the browser to avoid a duplicate copy.
 *
 * Status is either:
 *   'auto'          follow the weekly operating hours
 *   'force_open'    always open (owner override)
 *   'force_closed'  always closed (owner override)
 */

export const DAY_KEYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];

export const DEFAULT_HOURS = {
  mon: { open: '08:00', close: '18:00', closed: false },
  tue: { open: '08:00', close: '18:00', closed: false },
  wed: { open: '08:00', close: '18:00', closed: false },
  thu: { open: '08:00', close: '18:00', closed: false },
  fri: { open: '08:00', close: '18:00', closed: false },
  sat: { open: '08:00', close: '18:00', closed: false },
  sun: { open: '08:00', close: '18:00', closed: true },
};

export function toMinutes(value) {
  const [hours, minutes] = String(value ?? '00:00').split(':').map(Number);
  return (Number.isFinite(hours) ? hours : 0) * 60 + (Number.isFinite(minutes) ? minutes : 0);
}

export function normalizeHours(hours) {
  const source = hours && typeof hours === 'object' ? hours : {};
  const result = {};
  for (const day of DAY_KEYS) {
    const entry = source[day] ?? {};
    const fallback = DEFAULT_HOURS[day];
    result[day] = {
      open: entry.open ?? fallback.open,
      close: entry.close ?? fallback.close,
      closed: Boolean(entry.closed ?? fallback.closed),
    };
  }
  return result;
}

/** Current day + minute-of-day in a given IANA timezone. */
export function zonedParts(epochMs, timeZone) {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: timeZone || 'Asia/Manila',
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  });
  const parts = formatter.formatToParts(new Date(epochMs));
  const weekday = (parts.find((p) => p.type === 'weekday')?.value ?? 'Sun').toLowerCase().slice(0, 3);
  const hour = Number(parts.find((p) => p.type === 'hour')?.value ?? 0);
  const minute = Number(parts.find((p) => p.type === 'minute')?.value ?? 0);
  return { dayKey: DAY_KEYS.includes(weekday) ? weekday : 'sun', minutes: hour * 60 + minute };
}

/**
 * @returns {{isOpen:boolean, reason:'manual'|'schedule', dayKey:string,
 *            minutes:number, schedule:{open:string,close:string,closed:boolean}}}
 */
export function computeStoreStatus({ override = 'auto', hours, timezone = 'Asia/Manila', now = Date.now() } = {}) {
  const { dayKey, minutes } = zonedParts(now, timezone);
  const schedule = normalizeHours(hours)[dayKey];

  if (override === 'force_open') return { isOpen: true, reason: 'manual', dayKey, minutes, schedule };
  if (override === 'force_closed') return { isOpen: false, reason: 'manual', dayKey, minutes, schedule };

  const open = toMinutes(schedule.open);
  const close = toMinutes(schedule.close);
  const isOpen = !schedule.closed && minutes >= open && minutes < close;
  return { isOpen, reason: 'schedule', dayKey, minutes, schedule };
}

export function formatTime12(value) {
  const minutes = toMinutes(value);
  const hours24 = Math.floor(minutes / 60);
  const mins = minutes % 60;
  const suffix = hours24 >= 12 ? 'PM' : 'AM';
  const hours12 = hours24 % 12 === 0 ? 12 : hours24 % 12;
  return `${hours12}:${String(mins).padStart(2, '0')} ${suffix}`;
}

/** Short human label for a status chip. */
export function describeStatus(status) {
  if (status.reason === 'manual') {
    return status.isOpen ? 'Open (manual override)' : 'Closed (manual override)';
  }
  if (status.schedule.closed) return 'Closed today';
  if (status.isOpen) return `Open until ${formatTime12(status.schedule.close)}`;
  if (status.minutes < toMinutes(status.schedule.open)) {
    return `Closed - opens ${formatTime12(status.schedule.open)}`;
  }
  return `Closed - opens tomorrow`;
}
