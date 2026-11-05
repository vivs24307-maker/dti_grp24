import { Router } from 'express';
import { db } from '../db.js';
import { config } from '../config.js';
import { requireAuth } from '../middleware/auth.js';
import { badRequest, conflict, forbidden, notFound } from '../lib/errors.js';
import { BOOKING_SELECT, loadShow, newBookingCode, normaliseSeats } from '../lib/booking.js';
import { quote } from '../lib/pricing.js';
import { formatBooking } from '../lib/format.js';
import { parseLocal } from '../lib/time.js';
import { toInt } from '../lib/validate.js';

const router = Router();
router.use(requireAuth);

const PAYMENT_METHODS = ['UPI', 'CARD', 'NETBANKING', 'WALLET'];

function buildQuote(req) {
  const show = loadShow(toInt(req.body.showId, 'show id'));
  const seatIds = normaliseSeats(req.body.seats);
  const food = Array.isArray(req.body.food) ? req.body.food : [];
  const q = quote({ db, show, layout: show.layout, seatIds, food, couponCode: req.body.coupon || null, user: req.user });
  return { show, seatIds, q };
}

/** Price breakdown for the checkout page. Nothing is saved. */
router.post('/preview', (req, res) => {
  const { q } = buildQuote(req);
  res.json({ quote: q });
});

/** Confirm a booking. The seats must currently be held by this user. */
router.post('/', (req, res) => {
  const { show, seatIds, q } = buildQuote(req);
  const method = String(req.body.paymentMethod || '').toUpperCase();
  if (!PAYMENT_METHODS.includes(method)) throw badRequest('Please choose a payment method');
  if (parseLocal(show.starts_at) < new Date()) throw badRequest('This show has already started');

  const code = newBookingCode();
  const bookingId = db.transaction(() => {
    const holds = db
      .prepare('SELECT seat_id FROM seat_holds WHERE show_id = ? AND user_id = ? AND expires_at > ?')
      .all(show.id, req.user.id, Date.now())
      .map((h) => h.seat_id);
    const missing = seatIds.filter((id) => !holds.includes(id));
    if (missing.length) {
      throw conflict('Your seat hold has expired. Please select your seats again.', { missing });
    }

    const info = db.prepare(`
      INSERT INTO bookings (code, user_id, show_id, seats, food, ticket_amount, food_amount, convenience_fee,
                            discount, total, coupon_code, payment_method)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
      code, req.user.id, show.id, JSON.stringify(q.seats), JSON.stringify(q.food), q.ticketAmount, q.foodAmount,
      q.convenienceFee, q.discount, q.total, q.couponCode, method,
    );

    const ins = db.prepare('INSERT INTO booked_seats (show_id, seat_id, booking_id) VALUES (?, ?, ?)');
    try {
      for (const id of seatIds) ins.run(show.id, id, info.lastInsertRowid);
    } catch (e) {
      if (String(e.code).startsWith('SQLITE_CONSTRAINT')) throw conflict('One of your seats was already sold');
      throw e;
    }
    db.prepare('DELETE FROM seat_holds WHERE show_id = ? AND user_id = ?').run(show.id, req.user.id);
    return info.lastInsertRowid;
  })();

  const booking = formatBooking(db.prepare(`${BOOKING_SELECT} WHERE b.id = ?`).get(bookingId));
  res.status(201).json({ booking, perks: q.perks });
});

router.get('/', (req, res) => {
  const rows = db.prepare(`${BOOKING_SELECT} WHERE b.user_id = ? ORDER BY s.starts_at DESC`).all(req.user.id);
  res.json({ bookings: rows.map(formatBooking) });
});

function getOwnBooking(req) {
  const booking = formatBooking(db.prepare(`${BOOKING_SELECT} WHERE b.code = ?`).get(String(req.params.code).toUpperCase()));
  if (!booking) throw notFound('Booking not found');
  if (booking.user_id !== req.user.id && req.user.role !== 'admin') throw forbidden();
  return booking;
}

router.get('/:code', (req, res) => {
  res.json({ booking: getOwnBooking(req) });
});

router.post('/:code/cancel', (req, res) => {
  const booking = getOwnBooking(req);
  if (booking.status === 'CANCELLED') throw badRequest('This booking is already cancelled');
  const hoursLeft = (parseLocal(booking.starts_at) - new Date()) / 36e5;
  if (hoursLeft < config.cancellationCutoffHours) {
    throw badRequest(`Bookings can only be cancelled up to ${config.cancellationCutoffHours} hours before the show`);
  }
  const fee = booking.ticket_amount * config.cancellationFeePercent;
  const refund = Math.max(0, Math.round((booking.total - booking.convenience_fee - fee) * 100) / 100);

  db.transaction(() => {
    db.prepare("UPDATE bookings SET status = 'CANCELLED', refund_amount = ?, cancelled_at = datetime('now') WHERE id = ?").run(refund, booking.id);
    db.prepare('DELETE FROM booked_seats WHERE booking_id = ?').run(booking.id);
  })();

  res.json({ booking: formatBooking(db.prepare(`${BOOKING_SELECT} WHERE b.id = ?`).get(booking.id)), refund });
});

export default router;
