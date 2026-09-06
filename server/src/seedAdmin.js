// seedAdmin.js — ตั้งสมาชิกที่มีอยู่แล้วให้เป็นแอดมิน
// วิธีใช้:  npm run seed:admin -- อีเมลของคุณ@example.com
import 'dotenv/config';
import { q, pool } from './db.js';

const email = String(process.argv[2] || '').trim().toLowerCase();

if (!email) {
  console.error('ใช้แบบนี้:  npm run seed:admin -- your@email.com');
  process.exit(1);
}

const { rows } = await q(
  `UPDATE users SET role = 'admin' WHERE email = $1 RETURNING id, email, role`,
  [email]
);

if (!rows.length) console.error(`ไม่พบสมาชิกอีเมล ${email} — กรุณาสมัครสมาชิกในเว็บก่อน`);
else console.log(`ตั้ง ${rows[0].email} เป็นแอดมินเรียบร้อย`);

await pool.end();
