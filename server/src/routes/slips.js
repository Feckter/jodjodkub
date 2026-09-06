// routes/slips.js — อัปโหลดรูปสลิป อ่านด้วย OCR แล้วส่งค่าที่เดาได้กลับไปให้ผู้ใช้ยืนยัน
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { Router } from 'express';
import multer from 'multer';
import { q } from '../db.js';
import { requireAuth } from '../auth.js';
import { readText, readQr } from '../ocr.js';
import { parseSlip } from '../parseSlip.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const UPLOADS = path.join(HERE, '..', '..', 'uploads');
const ALLOWED = { 'image/jpeg': '.jpg', 'image/png': '.png', 'image/webp': '.webp' };

const router = Router();
router.use(requireAuth);

const storage = multer.diskStorage({
  destination(req, file, cb) {
    const dir = path.join(UPLOADS, String(req.user.id)); // แยกโฟลเดอร์ตามสมาชิก
    fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename(req, file, cb) {
    cb(null, crypto.randomUUID() + (ALLOWED[file.mimetype] || '.jpg'));
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 8 * 1024 * 1024, files: 1 },
  fileFilter(req, file, cb) {
    if (ALLOWED[file.mimetype]) return cb(null, true);
    cb(new Error('รับเฉพาะไฟล์ JPG, PNG หรือ WEBP'));
  },
});

// POST /api/slips — อัปโหลด + อ่าน แต่ยังไม่บันทึกเป็นรายการ
router.post('/', upload.single('image'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'ไม่พบไฟล์รูปสลิป' });

  let text = '';
  try {
    text = await readText(req.file.path);
  } catch (err) {
    console.error('OCR ล้มเหลว:', err.message);
    return res.status(500).json({ error: 'อ่านสลิปไม่สำเร็จ กรุณาลองใหม่หรือกรอกเอง' });
  }

  const parsed = parseSlip(text);
  const qr = await readQr(req.file.path);
  // ใช้เลขอ้างอิงจากข้อความก่อน ถ้าไม่มีค่อยใช้ payload ของ QR เป็นตัวกันซ้ำ
  const txid = parsed.ref || (qr ? qr.slice(0, 80) : null);

  const { rows } = await q(
    `INSERT INTO slips (user_id, file_path, mime, bytes, ocr_text)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING id`,
    [req.user.id, path.relative(UPLOADS, req.file.path), req.file.mimetype, req.file.size, text]
  );
  const slipId = rows[0].id;

  // ถ้าเลขอ้างอิงนี้เคยบันทึกไปแล้ว บอกผู้ใช้ตั้งแต่ตอนนี้เลย
  let duplicateOf = null;
  if (txid) {
    const dup = await q(
      `SELECT id, occurred_at FROM entries WHERE user_id = $1 AND txid = $2`,
      [req.user.id, txid]
    );
    if (dup.rows.length) duplicateOf = dup.rows[0];
  }

  res.status(201).json({
    slip_id: slipId,
    image_url: `/api/slips/${slipId}/image`,
    amount: parsed.amount,
    occurred_at: parsed.occurredAt,
    txid,
    duplicate_of: duplicateOf,
    raw_text: text,
  });
});

// GET /api/slips/:id/image — ดูรูปสลิปย้อนหลัง (เฉพาะเจ้าของ)
router.get('/:id/image', async (req, res) => {
  const { rows } = await q(
    `SELECT file_path, mime FROM slips WHERE id = $1 AND user_id = $2`,
    [+req.params.id || 0, req.user.id]
  );
  if (!rows.length) return res.status(404).json({ error: 'ไม่พบสลิป' });

  const full = path.resolve(UPLOADS, rows[0].file_path);
  if (!full.startsWith(path.resolve(UPLOADS))) return res.status(400).json({ error: 'เส้นทางไฟล์ไม่ถูกต้อง' });

  res.type(rows[0].mime || 'image/jpeg').sendFile(full);
});

export default router;
