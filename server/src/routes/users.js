import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { db } from '../db.js';
import { config } from '../config.js';
import { publicUser, requireAuth } from '../middleware/auth.js';
import { badRequest } from '../lib/errors.js';
import { assertStrongPassword, cleanString } from '../lib/validate.js';

const router = Router();
router.use(requireAuth);

router.patch('/me', (req, res) => {
  const updates = {};
  if (req.body.name !== undefined) {
    updates.name = cleanString(req.body.name, 60);
    if (!updates.name) throw badRequest('Name cannot be empty');
  }
  if (req.body.phone !== undefined) {
    updates.phone = cleanString(req.body.phone, 15) || null;
    if (updates.phone && !/^[0-9+\-\s]{7,15}$/.test(updates.phone)) throw badRequest('Invalid phone number');
  }
  if (req.body.cityId !== undefined) {
    const id = Number(req.body.cityId);
    if (!db.prepare('SELECT 1 FROM cities WHERE id = ?').get(id)) throw badRequest('Unknown city');
    updates.city_id = id;
  }
  const keys = Object.keys(updates);
  if (keys.length) {
    db.prepare(`UPDATE users SET ${keys.map((k) => `${k} = @${k}`).join(', ')} WHERE id = @id`).run({ ...updates, id: req.user.id });
  }
  res.json({ user: publicUser(db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id)) });
});

router.post('/me/password', (req, res) => {
  const { currentPassword, newPassword } = req.body || {};
  if (!bcrypt.compareSync(String(currentPassword || ''), req.user.password_hash)) {
    throw badRequest('Current password is incorrect');
  }
  assertStrongPassword(newPassword, 'New password');
  db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(bcrypt.hashSync(String(newPassword), 10), req.user.id);
  res.json({ ok: true });
});

/** Mock membership purchase: Premium for 30 days. */
router.post('/me/membership', (req, res) => {
  const base = req.user.plan === 'Premium' && req.user.plan_expires ? new Date(req.user.plan_expires) : new Date();
  base.setDate(base.getDate() + 30);
  db.prepare("UPDATE users SET plan = 'Premium', plan_expires = ? WHERE id = ?").run(base.toISOString(), req.user.id);
  res.json({
    user: publicUser(db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id)),
    charged: config.premiumPlanPrice,
  });
});

router.delete('/me/membership', (req, res) => {
  db.prepare("UPDATE users SET plan = 'Basic', plan_expires = NULL WHERE id = ?").run(req.user.id);
  res.json({ user: publicUser(db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id)) });
});

export default router;
