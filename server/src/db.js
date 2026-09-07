// db.js — จุดเชื่อมต่อ PostgreSQL เพียงจุดเดียวของทั้งโปรเจค
import pg from 'pg';

const { Pool } = pg;

// อ่านตัวเลข NUMERIC ให้เป็น Number ของ JS (ปกติ pg คืนมาเป็นสตริง)
pg.types.setTypeParser(1700, (v) => (v === null ? null : Number(v)));

const url = process.env.DATABASE_URL || '';
// ฐานข้อมูลบนคลาวด์บังคับให้เชื่อมต่อแบบเข้ารหัส ส่วนบนเครื่องตัวเองไม่ต้อง
const isLocal = /@(localhost|127\.0\.0\.1|\[::1\])[:/]/.test(url);

export const pool = new Pool({
  connectionString: url,
  ssl: isLocal ? false : { rejectUnauthorized: false },
});

/** รัน SQL หนึ่งคำสั่ง — ใช้ $1, $2 เสมอ ห้ามต่อสตริงค่าเข้าไปใน sql
 *
 *  บังคับเขตเวลาไทยครั้งแรกที่หยิบ connection แต่ละเส้นมาใช้ เพื่อให้การสรุปยอด
 *  "วันนี้" และ "เดือนนี้" ตรงกับเวลาบ้านเรา — ทำด้วย SQL ธรรมดาแทนการส่ง options
 *  ตอนเชื่อมต่อ เพราะผู้ให้บริการที่มี connection pooler คั่นอยู่มักไม่ยอมรับ options
 */
export async function q(sql, params = []) {
  const client = await pool.connect();
  try {
    if (!client.timezoneReady) {
      await client.query("SET TIME ZONE 'Asia/Bangkok'");
      client.timezoneReady = true;
    }
    return await client.query(sql, params);
  } finally {
    client.release();
  }
}

/** สร้างตารางทั้งหมดถ้ายังไม่มี — เรียกตอนเซิร์ฟเวอร์บูต */
export async function migrate() {
  await q(`
    CREATE TABLE IF NOT EXISTS users (
      id            SERIAL PRIMARY KEY,
      email         TEXT UNIQUE NOT NULL,
      display_name  TEXT NOT NULL,
      password_hash TEXT NOT NULL,
      role          TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('user','admin')),
      created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  await q(`
    CREATE TABLE IF NOT EXISTS slips (
      id         SERIAL PRIMARY KEY,
      user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      file_path  TEXT NOT NULL,
      mime       TEXT,
      bytes      INTEGER,
      ocr_text   TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  await q(`
    CREATE TABLE IF NOT EXISTS entries (
      id          SERIAL PRIMARY KEY,
      user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      type        TEXT NOT NULL CHECK (type IN ('income','expense')),
      amount      NUMERIC(12,2) NOT NULL CHECK (amount > 0),
      category    TEXT,
      note        TEXT,
      occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      slip_id     INTEGER REFERENCES slips(id) ON DELETE SET NULL,
      txid        TEXT,
      created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  await q(`
    CREATE TABLE IF NOT EXISTS budgets (
      id       SERIAL PRIMARY KEY,
      user_id  INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      month    TEXT NOT NULL,          -- รูปแบบ 'YYYY-MM'
      category TEXT,                   -- NULL = งบรวมทั้งเดือน
      amount   NUMERIC(12,2) NOT NULL CHECK (amount > 0)
    );
  `);

  // กันบันทึกสลิปใบเดิมซ้ำ (เฉพาะรายการที่มีเลขอ้างอิง)
  await q(`
    CREATE UNIQUE INDEX IF NOT EXISTS entries_user_txid_uniq
    ON entries (user_id, txid) WHERE txid IS NOT NULL;
  `);

  // งบหนึ่งเดือน หนึ่งหมวด ตั้งได้ครั้งเดียว
  await q(`
    CREATE UNIQUE INDEX IF NOT EXISTS budgets_user_month_cat_uniq
    ON budgets (user_id, month, COALESCE(category, ''));
  `);

  await q(`CREATE INDEX IF NOT EXISTS entries_user_time_idx ON entries (user_id, occurred_at DESC);`);
}
