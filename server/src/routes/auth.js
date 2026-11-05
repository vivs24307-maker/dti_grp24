import { Router } from 'express';
import bcrypt from 'bcryptjs';
import rateLimit from 'express-rate-limit';
import { db } from '../db.js';
import { config } from '../config.js';
import { publicUser, requireAuth, signToken } from '../middleware/auth.js';
import { badRequest, conflict, unauthorized } from '../lib/errors.js';
import { cleanString, isEmail, requireFields } from '../lib/validate.js';

const router = Router();

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: config.isTest ? 1000 : 50,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: 'Too many attempts, please try again in a few minutes' },
});

router.post('/register', authLimiter, (req, res) => {
  requireFields(req.body, ['name', 'email', 'password']);
  const name = cleanString(req.body.name, 60);
  const email = cleanString(req.body.email, 120).toLowerCase();
  const phone = cleanString(req.body.phone, 15);
  const { password } = req.body;

  if (!isEmail(email)) throw badRequest('Please enter a valid email');
  if (String(password).length < 6) throw badRequest('Password must be at least 6 characters');
  if (phone && !/^[0-9+\-\s]{7,15}$/.test(phone)) throw badRequest('Please enter a valid phone number');
  if (db.prepare('SELECT 1 FROM users WHERE email = ?').get(email)) {
    throw conflict('An account with this email already exists');
  }

  const cityId = req.body.cityId ? Number(req.body.cityId) || null : null;
  const info = db
    .prepare('INSERT INTO users (name, email, phone, password_hash, city_id) VALUES (?, ?, ?, ?, ?)')
    .run(name, email, phone, bcrypt.hashSync(String(password), 10), cityId);
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(info.lastInsertRowid);
  res.status(201).json({ token: signToken(user), user: publicUser(user) });
});

router.post('/login', authLimiter, (req, res) => {
  requireFields(req.body, ['email', 'password']);
  const email = String(req.body.email).trim().toLowerCase();
  const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
  if (!user || !bcrypt.compareSync(String(req.body.password), user.password_hash)) {
    throw unauthorized('Incorrect email or password');
  }
  res.json({ token: signToken(user), user: publicUser(user) });
});

router.get('/me', requireAuth, (req, res) => {
  res.json({ user: publicUser(req.user) });
});

export default router;
