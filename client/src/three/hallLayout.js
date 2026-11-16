// Pure geometry for the 3D auditorium: turns the seat layout JSON that the API returns
// into world positions, blocks, view scores and "best seat" suggestions.
// No three.js in here on purpose, so it stays easy to reason about (and to unit test).

export const TIERS = {
  Classic: { kind: 'std', w: 0.62, depth: 1.05, rise: 0.34, color: '#d02c44' },
  Premium: { kind: 'std', w: 0.62, depth: 1.05, rise: 0.34, color: '#3f73ff' },
  Recliner: { kind: 'recliner', w: 0.96, depth: 1.75, rise: 0.46, color: '#9a5cff' },
  Sofa: { kind: 'sofa', w: 1.32, depth: 1.85, rise: 0.5, color: '#f0b23c' },
};
const DEFAULT_TIER = TIERS.Premium;
const SEAT_GAP = 0.07;
const AISLE = 1.05;
const SIDE_AISLE = 1.5;
export const EYE_HEIGHT = 1.12;

const SEGMENT_NAMES = { 1: [''], 2: ['Left', 'Right'], 3: ['Left', 'Centre', 'Right'] };

export function tierOf(name) {
  return TIERS[name] || DEFAULT_TIER;
}

/** What the show's format ("IMAX 3D", "4DX", "ScreenX"...) means for the hall. */
export function formatFeatures(format = '') {
  const f = String(format);
  return {
    label: f,
    imax: f.includes('IMAX'),
    pxl: f.includes('P[XL]'),
    fourDX: f.includes('4DX'),
    screenX: f.includes('ScreenX'),
    ice: f.includes('ICE'),
    dolby: f.includes('Dolby'),
    threeD: /\b3D\b/.test(f),
  };
}

/**
 * World axes: the screen sits at z = 0 facing +z, rows go back along +z and climb in y.
 * Seat column 1 is on the left when you look at the screen (negative x).
 */
export function buildHall(layout, { format = '' } = {}) {
  const features = formatFeatures(format);
  // The API lists categories back-of-hall first; walk them front to back instead.
  const ordered = [];
  layout.categories.forEach((cat) => cat.rows.forEach((row) => ordered.push({ cat, row })));
  ordered.reverse();

  // Pass 1: x positions per row (independent of depth)
  const rows = ordered.map(({ cat, row }) => {
    const tier = tierOf(cat.name);
    const aisles = [...(cat.aisles || [])].sort((a, b) => a - b);
    const local = [];
    const aisleLocal = [];
    let cursor = 0;
    for (let c = 1; c <= cat.cols; c++) {
      local.push(cursor + tier.w / 2);
      cursor += tier.w + SEAT_GAP;
      if (aisles.includes(c) && c < cat.cols) {
        aisleLocal.push(cursor - SEAT_GAP / 2 + AISLE / 2);
        cursor += AISLE;
      }
    }
    const total = cursor - SEAT_GAP;
    return { cat, row, tier, aisles, local, aisleLocal, total };
  });

  const maxRowWidth = Math.max(...rows.map((r) => r.total));
  const halfW = maxRowWidth / 2 + SIDE_AISLE;
  const screenW = halfW * 2 * 0.84;
  // IMAX and other large formats get a taller picture; everything else is classic widescreen
  const screenH = screenW / (features.imax ? 1.85 : features.pxl || features.dolby ? 2.0 : 2.25);
  const screenBottom = 1.7;
  const screen = { w: screenW, h: screenH, bottom: screenBottom, cy: screenBottom + screenH / 2 };

  // Pass 2: depth + height, seats and blocks
  const seats = [];
  const seatById = new Map();
  const blocks = new Map();
  const rowInfo = [];
  let z = Math.max(6.5, screenW * 0.5);
  let y = 0.25;

  for (const r of rows) {
    const { cat, tier } = r;
    z += tier.depth / 2;
    const segCount = r.aisles.filter((a) => a < cat.cols).length + 1;
    const names = SEGMENT_NAMES[segCount] || Array.from({ length: segCount }, (_, i) => `Block ${i + 1}`);

    r.local.forEach((lx, i) => {
      const col = i + 1;
      const segment = r.aisles.filter((a) => a < col).length;
      const blockId = `${cat.name}:${segment}`;
      const seat = {
        id: `${r.row}${col}`, row: r.row, col, category: cat.name, price: cat.price, kind: tier.kind,
        x: lx - r.total / 2, y, z, w: tier.w, depth: tier.depth, blockId, segment,
      };
      seats.push(seat);
      seatById.set(seat.id, seat);
      if (!blocks.has(blockId)) {
        blocks.set(blockId, {
          id: blockId, category: cat.name, price: cat.price, segment, color: tier.color,
          name: names[segment], seats: [],
          min: { x: Infinity, y: Infinity, z: Infinity }, max: { x: -Infinity, y: -Infinity, z: -Infinity },
        });
      }
      const b = blocks.get(blockId);
      b.seats.push(seat);
      b.min.x = Math.min(b.min.x, seat.x - tier.w / 2); b.max.x = Math.max(b.max.x, seat.x + tier.w / 2);
      b.min.y = Math.min(b.min.y, y); b.max.y = Math.max(b.max.y, y + 1.25);
      b.min.z = Math.min(b.min.z, z - tier.depth / 2); b.max.z = Math.max(b.max.z, z + tier.depth / 2);
    });

    rowInfo.push({
      row: r.row, category: cat.name, y, z, depth: tier.depth, halfWidth: r.total / 2,
      aisleXs: r.aisleLocal.map((ax) => ax - r.total / 2),
    });
    z += tier.depth / 2;
    y += tier.rise;
  }

  for (const b of blocks.values()) {
    b.center = { x: (b.min.x + b.max.x) / 2, y: (b.min.y + b.max.y) / 2, z: (b.min.z + b.max.z) / 2 };
    b.width = b.max.x - b.min.x;
    b.depth = b.max.z - b.min.z;
    b.height = b.max.y - b.min.y;
  }

  const zBack = z + 1.8;
  const topY = y;
  const hall = {
    seats, seatById, blocks, rows: rowInfo, screen, halfW, zBack, topY, features,
    wallH: Math.max(topY + 4.6, screen.bottom + screen.h + 1.4),
    center: { x: 0, y: topY * 0.35, z: zBack * 0.52 },
    radius: Math.hypot(halfW, zBack / 2) + 1.5,
    categories: layout.categories.map((c) => ({ name: c.name, price: c.price, color: tierOf(c.name).color })),
  };
  for (const s of seats) s.score = viewScore(hall, s);
  return hall;
}

/** Morning and afternoon shows are in daylight, early-evening ones at sunset, late ones at night. */
export function timeOfDay(startsAt) {
  const m = /T(\d{2}):(\d{2})/.exec(String(startsAt || ''));
  if (!m) return 'day';
  const hour = Number(m[1]) + Number(m[2]) / 60;
  if (hour >= 6 && hour < 16.5) return 'day';
  if (hour >= 16.5 && hour < 19) return 'dusk';
  return 'night';
}

/** Where your eyes are when you sit in these seat(s). */
export function eyePoint(hall, ids) {
  const list = ids.map((id) => hall.seatById.get(id)).filter(Boolean);
  if (!list.length) return null;
  const avg = (k) => list.reduce((sum, s) => sum + s[k], 0) / list.length;
  return { x: avg('x'), y: avg('y') + EYE_HEIGHT, z: avg('z') - 0.05 };
}

/** 0–10: how good the view of the screen is from a seat (centred, right distance, not craning your neck). */
export function viewScore(hall, seat) {
  const { screen } = hall;
  const eyeY = seat.y + EYE_HEIGHT;
  const dist = Math.hypot(seat.x, eyeY - screen.cy, seat.z);
  const offCentre = (Math.atan2(Math.abs(seat.x), seat.z) * 180) / Math.PI;
  const lookUp = (Math.atan2(screen.cy - eyeY, seat.z) * 180) / Math.PI;
  const ideal = screen.w * 1.0;
  let score = 10;
  score -= offCentre / 7;
  score -= (Math.abs(dist - ideal) / screen.w) * 3.2;
  score -= Math.max(0, lookUp - 10) / 5;
  return Math.round(Math.min(9.9, Math.max(5, score)) * 10) / 10;
}

/** Runs of neighbouring free seats (same row, same side of the aisle). */
function freeRuns(hall, taken, filter) {
  const groups = new Map();
  for (const s of hall.seats) {
    if (filter && !filter(s)) continue;
    const key = `${s.row}|${s.segment}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(s);
  }
  const runs = [];
  for (const list of groups.values()) {
    list.sort((a, b) => a.col - b.col);
    let run = [];
    for (const s of list) {
      if (taken.has(s.id)) { if (run.length) runs.push(run); run = []; } else run.push(s);
    }
    if (run.length) runs.push(run);
  }
  return runs;
}

/** The n neighbouring free seats with the best average view. Falls back to the best single seats. */
export function bestSeats(hall, taken, n, filter) {
  let best = null;
  for (const run of freeRuns(hall, taken, filter)) {
    for (let i = 0; i + n <= run.length; i++) {
      const pick = run.slice(i, i + n);
      const score = pick.reduce((sum, s) => sum + s.score, 0) / n;
      if (!best || score > best.score) best = { score, seats: pick };
    }
  }
  if (best) return best.seats.map((s) => s.id);
  return hall.seats
    .filter((s) => !taken.has(s.id) && (!filter || filter(s)))
    .sort((a, b) => b.score - a.score)
    .slice(0, n)
    .map((s) => s.id);
}

/** Offer the next tier up: same number of seats, side by side, in a more expensive category. */
export function upgradeOffer(hall, selectedIds, taken) {
  const current = selectedIds.map((id) => hall.seatById.get(id)).filter(Boolean);
  if (!current.length) return null;
  const top = Math.max(...current.map((s) => s.price));
  const tiers = hall.categories.filter((c) => c.price > top).sort((a, b) => a.price - b.price);
  for (const tier of tiers) {
    const ids = bestSeats(hall, taken, current.length, (s) => s.category === tier.name);
    if (ids.length === current.length) {
      const total = ids.length * tier.price;
      const before = current.reduce((sum, s) => sum + s.price, 0);
      return { category: tier.name, price: tier.price, seats: ids, extra: total - before, color: tier.color };
    }
  }
  return null;
}
