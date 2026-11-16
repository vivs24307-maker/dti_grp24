import { Router } from 'express';
import { db } from '../db.js';
import { config } from '../config.js';
import { optionalAuth, requireAuth } from '../middleware/auth.js';
import { holdLimiter } from '../middleware/rateLimit.js';
import { badRequest, conflict } from '../lib/errors.js';
import { loadShow, normaliseSeats, unavailableSeats } from '../lib/booking.js';
import { seatMap } from '../lib/pricing.js';
import { parseLocal } from '../lib/time.js';
import { toInt } from '../lib/validate.js';
import { notifySeats, onSeatsChanged } from '../lib/events.js';

const router = Router();

function publicLayout(show) {
  return {
    categories: show.layout.categories.map((c) => ({
      ...c,
      price: Math.round((c.price * show.price_factor) / 10) * 10,
    })),
  };
}

router.get('/:id', optionalAuth, (req, res) => {
  const show = loadShow(toInt(req.params.id, 'show id'));
  const seats = unavailableSeats(show.id, req.user?.id);
  const { layout, ...rest } = show;
  res.json({
    show: { ...rest, layout: publicLayout(show) },
    unavailable: [...seats.booked, ...seats.heldByOthers],
    myHold: seats.mine.length
      ? { seats: seats.mine.map((h) => h.seat_id), expiresAt: Math.min(...seats.mine.map((h) => h.expires_at)) }
      : null,
    isPast: parseLocal(show.starts_at) < new Date(),
  });
});

/**
 * Temporarily lock seats for the current user while they pay (like BookMyShow's 10-minute timer).
 * Replaces any previous hold this user had on the same show.
 */
router.post('/:id/hold', requireAuth, holdLimiter, (req, res) => {
  const show = loadShow(toInt(req.params.id, 'show id'));
  if (parseLocal(show.starts_at) < new Date()) throw badRequest('This show has already started');
  const ids = normaliseSeats(req.body.seats);

  const valid = seatMap(show.layout, show.price_factor);
  const bad = ids.filter((id) => !valid.has(id));
  if (bad.length) throw badRequest(`Seat(s) ${bad.join(', ')} do not exist`);

  const expiresAt = Date.now() + config.seatHoldMinutes * 60 * 1000;

  db.transaction(() => {
    db.prepare('DELETE FROM seat_holds WHERE show_id = ? AND (user_id = ? OR expires_at <= ?)').run(show.id, req.user.id, Date.now());
    const { booked, heldByOthers } = unavailableSeats(show.id, req.user.id);
    const taken = ids.filter((id) => booked.includes(id) || heldByOthers.includes(id));
    if (taken.length) throw conflict(`Sorry, seat(s) ${taken.join(', ')} were just taken. Please pick others.`, { taken });
    const ins = db.prepare('INSERT INTO seat_holds (show_id, seat_id, user_id, expires_at) VALUES (?, ?, ?, ?)');
    for (const id of ids) ins.run(show.id, id, req.user.id, expiresAt);
  })();

  notifySeats(show.id);
  res.json({ seats: ids, expiresAt });
});

router.delete('/:id/hold', requireAuth, (req, res) => {
  const showId = toInt(req.params.id, 'show id');
  db.prepare('DELETE FROM seat_holds WHERE show_id = ? AND user_id = ?').run(showId, req.user.id);
  notifySeats(showId);
  res.json({ ok: true });
});

/**
 * Live seat updates (Server-Sent Events). The stream only says "something changed";
 * the client then re-fetches GET /shows/:id, so no private data ever travels over it.
 */
router.get('/:id/stream', (req, res) => {
  const showId = toInt(req.params.id, 'show id');
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no',
  });
  res.write('retry: 4000\n\n');
  const send = () => res.write(`event: seats\ndata: ${Date.now()}\n\n`);
  const off = onSeatsChanged(showId, send);
  const heartbeat = setInterval(() => res.write(': ping\n\n'), 25_000);
  req.on('close', () => { off(); clearInterval(heartbeat); });
});

export default router;
