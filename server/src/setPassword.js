// setPassword.js — ตั้งรหัสผ่านใหม่ให้สมาชิกคนหนึ่ง สำหรับตอนลืมรหัสผ่านแอดมิน
//
// วิธีใช้:  npm run set:password -- your@email.com "รหัสผ่านใหม่"
//
// ไม่ได้ import auth.js เพราะไฟล์นั้นบังคับให้มี JWT_SECRET
// ส่วนงานตั้งรหัสผ่านไม่ได้เกี่ยวกับ JWT เลย
import 'dotenv/config';
import bcrypt from 'bcryptjs';
import { q, pool } from './db.js';

const email = String(process.argv[2] || '').trim().toLowerCase();
const password = String(process.argv[3] || '');
const MIN = 8;

if (!email || !password) {
  console.error('ใช้แบบนี้:  npm run set:password -- your@email.com "รหัสผ่านใหม่"');
  process.exit(1);
}
if (password.length < MIN) {
  console.error(`รหัสผ่านต้องยาวอย่างน้อย ${MIN} ตัวอักษร`);
  process.exit(1);
}

const { rows } = await q(
  `UPDATE users SET password_hash = $1 WHERE email = $2
   RETURNING id, email, display_name, role`,
  [await bcrypt.hash(password, 10), email]
);

if (!rows.length) {
  console.error(`ไม่พบสมาชิกอีเมล ${email}`);
  const all = await q(`SELECT email, role FROM users ORDER BY id`);
  if (all.rows.length) {
    console.error('\nอีเมลที่มีอยู่ในระบบ:');
    for (const u of all.rows) console.error(`  ${u.email}  (${u.role})`);
  } else {
    console.error('\nยังไม่มีสมาชิกสักคนในฐานข้อมูลนี้ — สมัครสมาชิกในเว็บก่อน');
  }
  process.exitCode = 1;
} else {
  const u = rows[0];
  console.log(`ตั้งรหัสผ่านใหม่ให้ ${u.email} (${u.display_name} · ${u.role}) เรียบร้อย`);
  if (u.role !== 'admin') {
    console.log(`บัญชีนี้ยังไม่ใช่แอดมิน ถ้าต้องการให้เป็น รัน:  npm run seed:admin -- ${u.email}`);
  }
}

await pool.end();
