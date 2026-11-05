import { config } from '../config.js';
import { badRequest } from './errors.js';

const round2 = (n) => Math.round(n * 100) / 100;

/** Build a lookup { seatId -> { category, price } } for a screen layout and show. */
export function seatMap(layout, priceFactor = 1) {
  const map = new Map();
  for (const cat of layout.categories) {
    const price = Math.round((cat.price * priceFactor) / 10) * 10;
    for (const row of cat.rows) {
      for (let c = 1; c <= cat.cols; c++) {
        const id = `${row}${c}`;
        if (cat.blocked?.includes(id)) continue;
        map.set(id, { category: cat.name, price });
      }
    }
  }
  return map;
}

/** Discount for a coupon row on a given amount (0 if not applicable). */
export function couponDiscount(coupon, amount) {
  if (!coupon || !coupon.active || amount < coupon.min_amount) return 0;
  let d = coupon.type === 'PERCENT' ? (amount * coupon.value) / 100 : coupon.value;
  if (coupon.max_discount != null) d = Math.min(d, coupon.max_discount);
  return round2(Math.min(d, amount));
}

/**
 * Single source of truth for what a booking costs.
 * Used both for the checkout preview and the actual booking, so they can never disagree.
 */
export function quote({ db, show, layout, seatIds, food = [], couponCode, user }) {
  const map = seatMap(layout, show.price_factor);
  const seats = seatIds.map((id) => {
    const s = map.get(id);
    if (!s) throw badRequest(`Seat ${id} does not exist in this screen`);
    return { id, ...s };
  });

  const ticketAmount = seats.reduce((sum, s) => sum + s.price, 0);

  // Food & beverages
  const foodLines = [];
  let foodAmount = 0;
  if (food.length) {
    const getItem = db.prepare('SELECT * FROM food_items WHERE id = ?');
    for (const f of food) {
      const qty = Math.floor(Number(f.qty));
      if (!qty || qty < 1) continue;
      if (qty > 20) throw badRequest('Too many food items');
      const item = getItem.get(f.id);
      if (!item) throw badRequest('Unknown food item');
      foodLines.push({ id: item.id, name: item.name, price: item.price, qty, emoji: item.emoji });
      foodAmount += item.price * qty;
    }
  }

  const isPremium = user?.plan === 'Premium';
  const fee = isPremium
    ? 0
    : round2(seats.length * config.convenienceFeePerTicket * (1 + config.gstOnFee));

  const membershipDiscount = isPremium ? round2(ticketAmount * config.premiumDiscount) : 0;

  let coupon = null;
  let couponOff = 0;
  if (couponCode) {
    coupon = db.prepare('SELECT * FROM coupons WHERE code = ?').get(String(couponCode).trim());
    if (!coupon || !coupon.active) throw badRequest('Invalid or expired coupon code');
    const base = ticketAmount - membershipDiscount;
    if (base < coupon.min_amount) {
      throw badRequest(`Coupon ${coupon.code} needs a minimum ticket value of ₹${coupon.min_amount}`);
    }
    couponOff = couponDiscount(coupon, base);
  }

  const discount = round2(membershipDiscount + couponOff);
  const total = round2(Math.max(0, ticketAmount + foodAmount + fee - discount));

  return {
    seats,
    food: foodLines,
    ticketAmount,
    foodAmount: round2(foodAmount),
    convenienceFee: fee,
    membershipDiscount,
    couponDiscount: couponOff,
    couponCode: coupon?.code ?? null,
    discount,
    total,
    perks: isPremium ? ['Free regular popcorn at the counter', 'Zero convenience fee'] : [],
  };
}
