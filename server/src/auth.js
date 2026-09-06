// auth.js — เข้ารหัสรหัสผ่าน, ออก/ตรวจ JWT และ middleware ตรวจสิทธิ์
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { q } from './db.js';

const SECRET = process.env.JWT_SECRET || 'dev-secret-change-me';
const TOKEN_DAYS = 7;

export function hashPassword(plain) {
  return bcrypt.hash(plain, 10);
}

export function checkPassword(plain, hash) {
  return bcrypt.compare(plain, hash);
}

export function signToken(user) {
  return jwt.sign({ sub: user.id }, SECRET, { expiresIn: `${TOKEN_DAYS}d` });
}

/** ต้องล็อกอิน — ดึงข้อมูล user จาก DB ใหม่ทุกครั้ง เพื่อให้การเปลี่ยน role มีผลทันที */
export async function requireAuth(req, res, next) {
  try {
    const header = req.headers.authorization || '';
    if (!header.startsWith('Bearer ')) return res.status(401).json({ error: 'ยังไม่ได้เข้าสู่ระบบ' });

    const { sub } = jwt.verify(header.slice(7), SECRET);
    const { rows } = await q(
      `SELECT id, email, display_name, role FROM users WHERE id = $1`,
      [sub]
    );
    if (!rows.length) return res.status(401).json({ error: 'ไม่พบบัญชีผู้ใช้' });

    req.user = rows[0];
    next();
  } catch {
    res.status(401).json({ error: 'เซสชันหมดอายุ กรุณาเข้าสู่ระบบใหม่' });
  }
}

/** ต้องเป็นแอดมิน — ใช้ต่อจาก requireAuth เสมอ */
export function requireAdmin(req, res, next) {
  if (req.user?.role !== 'admin') return res.status(403).json({ error: 'ต้องเป็นแอดมินเท่านั้น' });
  next();
}
