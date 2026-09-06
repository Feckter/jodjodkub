// index.js — ตั้งค่าเซิร์ฟเวอร์ เสิร์ฟหน้าเว็บ และต่อ route ทั้งหมดเข้าด้วยกัน
import 'dotenv/config';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import multer from 'multer';

import { migrate, pool } from './db.js';
import { closeOcr } from './ocr.js';

import authRoutes from './routes/auth.js';
import adminRoutes from './routes/admin.js';
import entriesRoutes from './routes/entries.js';
import slipsRoutes from './routes/slips.js';
import summaryRoutes from './routes/summary.js';
import budgetsRoutes from './routes/budgets.js';
import exportRoutes from './routes/export.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT || 3000);

const app = express();
app.use(express.json({ limit: '1mb' }));

// เสิร์ฟหน้าเว็บจากโฟลเดอร์เดียวกัน จึงไม่ต้องตั้ง CORS
app.use(express.static(path.join(HERE, '..', 'client')));

app.use('/api/auth', authRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/entries', entriesRoutes);
app.use('/api/slips', slipsRoutes);
app.use('/api/summary', summaryRoutes);
app.use('/api/budgets', budgetsRoutes);
app.use('/api/export', exportRoutes);

app.use('/api', (req, res) => res.status(404).json({ error: 'ไม่พบ endpoint นี้' }));

// ตัวจับข้อผิดพลาดรวม (Express 5 ส่ง error จาก async route มาที่นี่ให้เอง)
app.use((err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    const msg = err.code === 'LIMIT_FILE_SIZE' ? 'ไฟล์ใหญ่เกิน 8MB' : 'อัปโหลดไฟล์ไม่สำเร็จ';
    return res.status(400).json({ error: msg });
  }
  if (err?.message?.startsWith('รับเฉพาะไฟล์')) return res.status(400).json({ error: err.message });

  console.error('เกิดข้อผิดพลาด:', err);
  res.status(500).json({ error: 'เซิร์ฟเวอร์ทำงานผิดพลาด' });
});

let server;
try {
  await migrate();
  server = app.listen(PORT, () => console.log(`JodJodKUB พร้อมใช้งานที่ http://localhost:${PORT}`));
} catch (err) {
  console.error('\nต่อฐานข้อมูลไม่สำเร็จ:', err.message);
  console.error('ตรวจสอบว่า PostgreSQL เปิดอยู่ และ DATABASE_URL ใน server/.env ถูกต้อง');
  console.error('ถ้ายังไม่ได้สร้างฐานข้อมูล ให้รัน:  createdb -U postgres jodjodkub\n');
  process.exit(1);
}

// ปิดให้เรียบร้อยตอนกด Ctrl+C
for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, async () => {
    server.close();
    await closeOcr();
    await pool.end();
    process.exit(0);
  });
}
