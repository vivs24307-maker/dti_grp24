// All show times are stored as local "wall clock" strings: 'YYYY-MM-DDTHH:MM'.
// That keeps the data readable and avoids timezone surprises for a single-region app.

const pad = (n) => String(n).padStart(2, '0');

export function toLocalDate(d = new Date()) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function toLocalDateTime(d = new Date()) {
  return `${toLocalDate(d)}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function addDays(d, days) {
  const copy = new Date(d);
  copy.setDate(copy.getDate() + days);
  return copy;
}

/** Parse a local 'YYYY-MM-DDTHH:MM' string into a Date. */
export function parseLocal(str) {
  const [date, time = '00:00'] = str.split('T');
  const [y, m, d] = date.split('-').map(Number);
  const [hh, mm] = time.split(':').map(Number);
  return new Date(y, m - 1, d, hh, mm);
}

export function isValidDate(str) {
  return /^\d{4}-\d{2}-\d{2}$/.test(str) && !Number.isNaN(parseLocal(str).getTime());
}
