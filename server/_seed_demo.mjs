// _seed_demo.mjs — สร้างบัญชีตัวอย่างพร้อมข้อมูลย้อนหลัง 6 เดือน สำหรับถ่ายภาพหน้าจอ
// รันซ้ำได้ ล้างของเดิมให้ก่อนเสมอ   |   ลบทิ้งได้เมื่อไม่ใช้แล้ว
import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import pg from 'pg';
import bcrypt from 'bcryptjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const UPLOADS = path.join(HERE, 'uploads');

const DEMO_EMAIL = 'demo@jodjodkub.app';
const DEMO_NAME = 'ณัฐพงศ์ (เดโม่)';
const DEMO_PASSWORD = 'demo1234';
const SOURCE_USER = 8; // adminfirst@gmail.com — ก๊อปสลิปมาจากบัญชีนี้

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, options: '-c timezone=Asia/Bangkok' });
const q = (s, p = []) => pool.query(s, p).then((r) => r.rows);

/* ---------- สุ่มแบบกำหนดเมล็ดได้ เพื่อให้รันกี่ครั้งก็ได้ข้อมูลชุดเดิม ---------- */
let seed = 20260907;
const rnd = () => {
  seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};
const pick = (a) => a[Math.floor(rnd() * a.length)];
const between = (lo, hi, step = 1) => Math.round((lo + rnd() * (hi - lo)) / step) * step;
const chance = (p) => rnd() < p;

/* ---------- ข้อมูลที่ใช้แต่งรายการให้ดูเหมือนของจริง ---------- */
const FOOD = [
  ['ข้าวมันไก่หน้ามหาลัย', 50, 60], ['ก๋วยเตี๋ยวหมูตุ๋น', 55, 70], ['กาแฟเย็น', 45, 65],
  ['ข้าวกล่อง 7-11', 42, 79], ['ชานมไข่มุก', 55, 85], ['ข้าวผัดกะเพราไข่ดาว', 60, 75],
  ['ส้มตำ + ไก่ย่าง', 90, 140], ['ข้าวหมูกรอบ', 55, 70], ['ขนมปัง + นม', 35, 55],
];
const FOOD_BIG = [['หมูกระทะกับเพื่อน', 250, 420], ['ชาบูวันหยุด', 320, 520], ['เลี้ยงข้าวที่บ้าน', 400, 700]];
const TRAVEL = [['ค่ารถไฟฟ้าไปมหาลัย', 42, 62], ['ค่าวินมอเตอร์ไซค์', 25, 45], ['เติมน้ำมันรถ', 100, 200], ['ค่ารถเมล์', 15, 25]];
const SHOP = [
  ['เสื้อยืด', 290, 590], ['รองเท้าผ้าใบ', 890, 1690], ['สมุด + ปากกา', 120, 260],
  ['หูฟัง', 590, 1290], ['แผ่นรองเมาส์', 250, 450], ['ที่ชาร์จโทรศัพท์', 320, 690],
];
const FUN = [['ดูหนังกับเพื่อน', 220, 380], ['ค่าเกมในสตีม', 150, 690], ['ค่าสมาชิก Netflix', 99, 199], ['ร้องคาราโอเกะ', 250, 450]];
const EDU = [['ค่าถ่ายเอกสารรายงาน', 60, 180], ['ซื้อหนังสือเรียน', 350, 850], ['คอร์สออนไลน์', 590, 1200], ['ค่าปริ้นท์งานส่ง', 40, 120]];
const HEALTH = [['ยาแก้หวัด', 120, 260], ['หาหมอฟัน', 500, 900], ['วิตามิน', 250, 450]];
const SIDE = [['รับจ้างทำเว็บให้ร้านค้า', 1500, 3500], ['ขายของมือสอง', 400, 1200], ['รับจ้างตัดต่อวิดีโอ', 800, 2000]];

const MONTHS = ['2026-04', '2026-05', '2026-06', '2026-07', '2026-08', '2026-09'];
const LAST_DAY = { '2026-04': 30, '2026-05': 31, '2026-06': 30, '2026-07': 31, '2026-08': 31, '2026-09': 7 };

const at = (month, day, h, m) =>
  `${month}-${String(day).padStart(2, '0')}T${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:00+07:00`;

const txid = () => String(between(100000000000, 999999999999));

const rows = [];
const add = (type, amount, category, note, when, extra = {}) =>
  rows.push({ type, amount, category, note, when, ...extra });

/* ---------- สร้างรายการ 6 เดือน ---------- */
for (const month of MONTHS) {
  const last = LAST_DAY[month];

  // รายรับ
  if (last >= 1) add('income', 5000, 'โอนจากที่บ้าน', 'เงินใช้จ่ายประจำเดือนจากที่บ้าน', at(month, 1, 9, 12));
  if (last >= 25) add('income', between(9000, 12500, 50), 'เงินเดือน', 'เงินเดือนพาร์ทไทม์ IT City', at(month, 25, 17, 5));
  if (last >= 20 && chance(0.5)) {
    const [note, lo, hi] = pick(SIDE);
    add('income', between(lo, hi, 50), 'งานเสริม', note, at(month, between(8, 20), 20, between(0, 59)));
  }

  // ค่าใช้จ่ายประจำ — สามรายการนี้จะผูกกับรูปสลิปทีหลัง
  if (last >= 5) add('expense', 3500, 'ค่าหอพัก', 'ค่าหอพักรายเดือน', at(month, 5, 10, 30), { wantSlip: true });
  if (last >= 8) add('expense', between(420, 980, 5), 'ค่าน้ำค่าไฟ', 'ค่าน้ำค่าไฟหอพัก', at(month, 8, 11, 15), { wantSlip: true });
  if (last >= 12) add('expense', 399, 'โทรศัพท์/เน็ต', 'ค่าแพ็กเกจเน็ตรายเดือน', at(month, 12, 9, 40));

  // ค่าใช้จ่ายรายวัน
  for (let d = 1; d <= last; d++) {
    const weekend = new Date(`${month}-${String(d).padStart(2, '0')}T00:00:00+07:00`).getDay() % 6 === 0;

    const meals = weekend ? between(1, 2) : between(2, 3);
    for (let i = 0; i < meals; i++) {
      const [note, lo, hi] = weekend && chance(0.25) ? pick(FOOD_BIG) : pick(FOOD);
      add('expense', between(lo, hi, 1), 'อาหาร', note, at(month, d, 8 + i * 4, between(0, 59)));
    }

    if (!weekend && chance(0.85)) {
      const [note, lo, hi] = pick(TRAVEL);
      add('expense', between(lo, hi, 1), 'เดินทาง', note, at(month, d, 7, between(20, 55)));
    }
  }

  // ค่าใช้จ่ายเป็นครั้งคราว
  const occasional = (list, category, times) => {
    for (let i = 0; i < times; i++) {
      const [note, lo, hi] = pick(list);
      add('expense', between(lo, hi, 10), category, note, at(month, between(2, last), between(12, 21), between(0, 59)));
    }
  };
  occasional(SHOP, 'ช้อปปิ้ง', month === '2026-09' ? 0 : between(1, 3));
  occasional(FUN, 'บันเทิง', month === '2026-09' ? 0 : between(1, 3));
  occasional(EDU, 'การศึกษา', between(0, 2));
  if (chance(0.45)) occasional(HEALTH, 'สุขภาพ', 1);
}

/* เดือนปัจจุบันจัดฉากให้เห็นแถบงบครบทั้งเขียว เหลือง แดง */
add('expense', 2590, 'ช้อปปิ้ง', 'คีย์บอร์ดสำหรับเขียนโค้ด', at('2026-09', 3, 19, 24)); // เกินงบ 2,000 -> แดง
add('expense', 380, 'บันเทิง', 'ดูหนังกับเพื่อน', at('2026-09', 2, 18, 40));
add('expense', 199, 'บันเทิง', 'ค่าสมาชิก Netflix', at('2026-09', 4, 10, 5));
add('expense', 450, 'บันเทิง', 'ค่าเกมในสตีม', at('2026-09', 6, 21, 12));           // รวม 1,029 / 1,200 -> เหลือง

const BUDGETS = [
  [null, 15000], ['อาหาร', 6000], ['เดินทาง', 1500], ['ช้อปปิ้ง', 2000], ['บันเทิง', 1200],
];

/* ---------- เขียนลงฐานข้อมูล ---------- */
const old = await q(`SELECT id FROM users WHERE email = $1`, [DEMO_EMAIL]);
for (const u of old) {
  await q(`DELETE FROM users WHERE id = $1`, [u.id]); // CASCADE ลบ entries/slips/budgets ให้เอง
  fs.rmSync(path.join(UPLOADS, String(u.id)), { recursive: true, force: true });
}

// ตั้งเป็นแอดมิน เพื่อให้ถ่ายภาพหน้าจอหน้าจัดการสมาชิกได้ด้วย
const [user] = await q(
  `INSERT INTO users (email, display_name, password_hash, role, created_at)
   VALUES ($1, $2, $3, 'admin', $4) RETURNING id`,
  [DEMO_EMAIL, DEMO_NAME, await bcrypt.hash(DEMO_PASSWORD, 10), '2026-04-01T09:00:00+07:00']
);
const uid = user.id;

// ก๊อปรูปสลิปจากบัญชีต้นทางมาเป็นของบัญชีเดโม่ (ไฟล์ใหม่ ชื่อใหม่ ไม่แตะของเดิม)
// เอาเฉพาะรูปสลิปโอนเงินจริง — บัญชีต้นทางมีรูปอื่น (เช่นใบประกาศ) ปนอยู่ด้วย
const srcSlips = await q(
  `SELECT file_path, mime, bytes, ocr_text FROM slips
   WHERE user_id = $1 AND mime = 'image/jpeg'
   ORDER BY id`, [SOURCE_USER]
);
fs.mkdirSync(path.join(UPLOADS, String(uid)), { recursive: true });

const slipIds = [];
for (const s of srcSlips) {
  const from = path.join(UPLOADS, s.file_path);
  if (!fs.existsSync(from)) continue; // บางแถวในฐานข้อมูลไม่มีไฟล์จริงแล้ว
  const name = crypto.randomUUID() + path.extname(s.file_path);
  fs.copyFileSync(from, path.join(UPLOADS, String(uid), name));
  const [row] = await q(
    `INSERT INTO slips (user_id, file_path, mime, bytes, ocr_text) VALUES ($1,$2,$3,$4,$5) RETURNING id`,
    [uid, path.join(String(uid), name), s.mime, s.bytes, s.ocr_text]
  );
  slipIds.push(row.id);
}

// รายการที่ควรมีสลิปแนบ ไล่ใช้สลิปที่ก๊อปมาจนหมด
let nextSlip = 0;
rows.sort((a, b) => (a.when < b.when ? -1 : 1));
for (const r of rows) {
  const slipId = r.wantSlip && nextSlip < slipIds.length ? slipIds[nextSlip++] : null;
  await q(
    `INSERT INTO entries (user_id, type, amount, category, note, occurred_at, slip_id, txid, created_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$6)`,
    [uid, r.type, r.amount, r.category, r.note, r.when, slipId, slipId ? txid() : null]
  );
}

for (const month of MONTHS) {
  for (const [category, amount] of BUDGETS) {
    await q(
      `INSERT INTO budgets (user_id, month, category, amount) VALUES ($1,$2,$3,$4)
       ON CONFLICT (user_id, month, COALESCE(category,'')) DO UPDATE SET amount = EXCLUDED.amount`,
      [uid, month, category, amount]
    );
  }
}

/* ---------- สรุปผล ---------- */
const summary = await q(
  `SELECT to_char(occurred_at,'YYYY-MM') m,
          SUM(amount) FILTER (WHERE type='income')  AS income,
          SUM(amount) FILTER (WHERE type='expense') AS expense,
          COUNT(*)::int n
   FROM entries WHERE user_id = $1 GROUP BY 1 ORDER BY 1`, [uid]
);
console.log('demo user id:', uid, '| email:', DEMO_EMAIL, '| password:', DEMO_PASSWORD);
console.log('slips copied:', slipIds.length);
console.table(summary);
await pool.end();
