// routes/export.js — ส่งออกรายการเป็นไฟล์ CSV ที่ Excel เปิดแล้วอ่านภาษาไทยได้
import { Router } from 'express';
import { q } from '../db.js';
import { requireAuth } from '../auth.js';

const router = Router();
router.use(requireAuth);

/** ครอบด้วยเครื่องหมายคำพูด และ escape " ตามมาตรฐาน CSV */
const cell = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;

router.get('/csv', async (req, res) => {
  const where = ['user_id = $1'];
  const params = [req.user.id];

  if (req.query.from) { params.push(req.query.from); where.push(`occurred_at >= $${params.length}`); }
  if (req.query.to)   { params.push(req.query.to);   where.push(`occurred_at < ($${params.length}::date + 1)`); }

  const { rows } = await q(
    `SELECT occurred_at, type, amount, category, note, txid
     FROM entries WHERE ${where.join(' AND ')}
     ORDER BY occurred_at`,
    params
  );

  const lines = [['วันที่', 'เวลา', 'ประเภท', 'จำนวนเงิน', 'หมวดหมู่', 'โน้ต', 'เลขอ้างอิง'].map(cell).join(',')];

  for (const r of rows) {
    const d = new Date(r.occurred_at);
    lines.push([
      d.toLocaleDateString('th-TH'),
      d.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' }),
      r.type === 'income' ? 'รายรับ' : 'รายจ่าย',
      Number(r.amount).toFixed(2),
      r.category || '',
      r.note || '',
      r.txid || '',
    ].map(cell).join(','));
  }

  const filename = `jodjodkub-${new Date().toISOString().slice(0, 10)}.csv`;
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.send('﻿' + lines.join('\r\n')); // BOM นำหน้า ไม่งั้น Excel อ่านภาษาไทยเป็นตัวยึกยือ
});

export default router;
