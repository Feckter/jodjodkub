// auth.js — เข้ารหัสรหัสผ่าน, ออก/ตรวจ JWT และ middleware ตรวจสิทธิ์
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { q } from './db.js';

// ห้ามมีค่าสำรองในโค้ด — ถ้าลืมตั้งบนเซิร์ฟเวอร์จริง ค่าสำรองที่ทุกคนอ่านได้จาก
// โค้ดสาธารณะจะกลายเป็นกุญแจปลอม token เข้าบัญชีใครก็ได้ จึงให้หยุดทำงานไปเลย
const SECRET = process.env.JWT_SECRET;
if (!SECRET || SECRET.length < 16) {
  console.error('\nยังไม่ได้ตั้ง JWT_SECRET (หรือสั้นเกินไป ต้องยาวอย่างน้อย 16 ตัวอักษร)');
  console.error('ตั้งใน server/.env หรือใน environment variables ของผู้ให้บริการ');
  console.error('สุ่มค่าได้ด้วย:  node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"\n');
  process.exit(1);
}
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
