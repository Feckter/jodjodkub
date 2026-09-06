// routes/auth.js — สมัครสมาชิก / เข้าสู่ระบบ / ดูข้อมูลตัวเอง / เปลี่ยนรหัสผ่าน
import { Router } from 'express';
import { q } from '../db.js';
import { hashPassword, checkPassword, signToken, requireAuth } from '../auth.js';

const router = Router();
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MIN_PASSWORD = 8;

const publicUser = (u) => ({ id: u.id, email: u.email, display_name: u.display_name, role: u.role });

router.post('/register', async (req, res) => {
  const email = String(req.body.email || '').trim().toLowerCase();
  const name = String(req.body.display_name || '').trim();
  const password = String(req.body.password || '');

  if (!EMAIL_RE.test(email)) return res.status(400).json({ error: 'อีเมลไม่ถูกต้อง' });
  if (!name) return res.status(400).json({ error: 'กรุณากรอกชื่อที่จะแสดง' });
  if (password.length < MIN_PASSWORD) {
    return res.status(400).json({ error: `รหัสผ่านต้องยาวอย่างน้อย ${MIN_PASSWORD} ตัวอักษร` });
  }

  const exists = await q(`SELECT 1 FROM users WHERE email = $1`, [email]);
  if (exists.rows.length) return res.status(409).json({ error: 'อีเมลนี้ถูกใช้สมัครไปแล้ว' });

  const { rows } = await q(
    `INSERT INTO users (email, display_name, password_hash)
     VALUES ($1, $2, $3)
     RETURNING id, email, display_name, role`,
    [email, name, await hashPassword(password)]
  );

  res.status(201).json({ token: signToken(rows[0]), user: publicUser(rows[0]) });
});

router.post('/login', async (req, res) => {
  const email = String(req.body.email || '').trim().toLowerCase();
  const password = String(req.body.password || '');

  const { rows } = await q(
    `SELECT id, email, display_name, role, password_hash FROM users WHERE email = $1`,
    [email]
  );
  // ข้อความเดียวกันทั้งกรณีไม่มีบัญชีและรหัสผิด เพื่อไม่ให้เดาได้ว่าอีเมลไหนมีอยู่จริง
  const fail = () => res.status(401).json({ error: 'อีเมลหรือรหัสผ่านไม่ถูกต้อง' });

  if (!rows.length) return fail();
  if (!(await checkPassword(password, rows[0].password_hash))) return fail();

  res.json({ token: signToken(rows[0]), user: publicUser(rows[0]) });
});

router.get('/me', requireAuth, (req, res) => {
  res.json(publicUser(req.user));
});

router.post('/change-password', requireAuth, async (req, res) => {
  const current = String(req.body.current_password || '');
  const next = String(req.body.new_password || '');

  if (next.length < MIN_PASSWORD) {
    return res.status(400).json({ error: `รหัสผ่านใหม่ต้องยาวอย่างน้อย ${MIN_PASSWORD} ตัวอักษร` });
  }

  const { rows } = await q(`SELECT password_hash FROM users WHERE id = $1`, [req.user.id]);
  if (!(await checkPassword(current, rows[0].password_hash))) {
    return res.status(400).json({ error: 'รหัสผ่านเดิมไม่ถูกต้อง' });
  }

  await q(`UPDATE users SET password_hash = $1 WHERE id = $2`, [await hashPassword(next), req.user.id]);
  res.json({ ok: true });
});

export default router;
