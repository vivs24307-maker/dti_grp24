const pad = (n) => String(n).padStart(2, '0');

export const inr = (n) => {
  const v = Number(n || 0);
  const digits = Number.isInteger(v) ? 0 : 2;
  return `₹${v.toLocaleString('en-IN', { minimumFractionDigits: digits, maximumFractionDigits: digits })}`;
};

export const toYmd = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

/** 'YYYY-MM-DDTHH:MM' -> Date (local) */
export const parseLocal = (s) => {
  const [date, time = '00:00'] = s.split('T');
  const [y, m, d] = date.split('-').map(Number);
  const [hh, mm] = time.split(':').map(Number);
  return new Date(y, m - 1, d, hh, mm);
};

export const fmtTime = (s) =>
  parseLocal(s).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true }).toUpperCase();

export const fmtDate = (s, opts = { weekday: 'short', day: 'numeric', month: 'short' }) =>
  parseLocal(s.length === 10 ? `${s}T00:00` : s).toLocaleDateString('en-IN', opts);

export const fmtDuration = (min) => `${Math.floor(min / 60)}h ${min % 60}m`;

export const dayParts = (ymd) => {
  const d = parseLocal(`${ymd}T00:00`);
  const today = toYmd(new Date());
  const tomorrow = toYmd(new Date(Date.now() + 864e5));
  return {
    label: ymd === today ? 'Today' : ymd === tomorrow ? 'Tomorrow' : d.toLocaleDateString('en-IN', { weekday: 'short' }),
    day: d.getDate(),
    month: d.toLocaleDateString('en-IN', { month: 'short' }).toUpperCase(),
  };
};

export const timeOfDay = (s) => {
  const h = parseLocal(s).getHours();
  if (h < 12) return 'Morning';
  if (h < 17) return 'Afternoon';
  if (h < 20) return 'Evening';
  return 'Night';
};

export const certClass = (c) => ({ U: 'cert-u', UA: 'cert-ua', A: 'cert-a' }[c] || 'cert-ua');

export const PLACEHOLDER_POSTER =
  'data:image/svg+xml;utf8,' +
  encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 300"><rect width="200" height="300" fill="#1c1c25"/><text x="100" y="160" font-size="48" text-anchor="middle">🎬</text></svg>');
