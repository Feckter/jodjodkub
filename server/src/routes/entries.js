// routes/entries.js — รายการรายรับรายจ่าย (เห็นและแก้ได้เฉพาะของตัวเองเท่านั้น)
import { Router } from 'express';
import { q } from '../db.js';
import { requireAuth } from '../auth.js';

const router = Router();
router.use(requireAuth);

const COLUMNS = `id, type, amount, category, note, occurred_at, slip_id, txid, created_at`;

/** ตรวจจำนวนเงิน: ต้องเป็นตัวเลขบวก ปัดเหลือ 2 ตำแหน่ง */
function readAmount(v) {
  const n = Math.round(Number(v) * 100) / 100;
  return Number.isFinite(n) && n > 0 ? n : null;
}

function readType(v) {
  return v === 'income' || v === 'expense' ? v : null;
}

// GET /api/entries?month=YYYY-MM&type=&category=&limit=&offset=
router.get('/', async (req, res) => {
  const where = ['user_id = $1'];
  const params = [req.user.id];

  if (/^\d{4}-\d{2}$/.test(req.query.month || '')) {
    params.push(req.query.month);
    where.push(`to_char(occurred_at, 'YYYY-MM') = $${params.length}`);
  }
  if (readType(req.query.type)) {
    params.push(req.query.type);
    where.push(`type = $${params.length}`);
  }
  if (req.query.category) {
    params.push(req.query.category);
    where.push(`category = $${params.length}`);
  }

  const limit = Math.min(Math.max(+req.query.limit || 50, 1), 200);
  const offset = Math.max(+req.query.offset || 0, 0);
  params.push(limit, offset);

  const { rows } = await q(
    `SELECT ${COLUMNS} FROM entries
     WHERE ${where.join(' AND ')}
     ORDER BY occurred_at DESC, id DESC
     LIMIT $${params.length - 1} OFFSET $${params.length}`,
    params
  );

  const total = await q(
    `SELECT COUNT(*)::int AS n FROM entries WHERE ${where.join(' AND ')}`,
    params.slice(0, params.length - 2)
  );

  res.json({ items: rows, total: total.rows[0].n });
});

// GET /api/entries/categories — หมวดที่เคยใช้ รวมทั้งจากรายการและจากงบประมาณ
// (ต้องอยู่เหนือ route ที่มี :id เพื่อไม่ให้ถูกจับเป็น id)
router.get('/categories', async (req, res) => {
  const { rows } = await q(
    `SELECT DISTINCT category FROM (
       SELECT category FROM entries WHERE user_id = $1
       UNION
       SELECT category FROM budgets WHERE user_id = $1
     ) t
     WHERE category IS NOT NULL AND category <> ''
     ORDER BY category`,
    [req.user.id]
  );
  res.json({ items: rows.map((r) => r.category) });
});

// POST /api/entries
router.post('/', async (req, res) => {
  const type = readType(req.body.type);
  const amount = readAmount(req.body.amount);
  if (!type) return res.status(400).json({ error: 'ต้องเลือกว่าเป็นรายรับหรือรายจ่าย' });
  if (!amount) return res.status(400).json({ error: 'จำนวนเงินต้องมากกว่า 0' });

  const txid = req.body.txid ? String(req.body.txid).slice(0, 80) : null;
  const slipId = req.body.slip_id ? +req.body.slip_id : null;

  // สลิปที่อ้างถึงต้องเป็นของเจ้าของบัญชีเอง
  if (slipId) {
    const own = await q(`SELECT 1 FROM slips WHERE id = $1 AND user_id = $2`, [slipId, req.user.id]);
    if (!own.rows.length) return res.status(400).json({ error: 'ไม่พบสลิปที่อ้างถึง' });
  }

  // สลิปใบเดิมบันทึกซ้ำไม่ได้
  if (txid) {
    const dup = await q(
      `SELECT id, occurred_at FROM entries WHERE user_id = $1 AND txid = $2`,
      [req.user.id, txid]
    );
    if (dup.rows.length) {
      return res.status(409).json({
        error: 'สลิปใบนี้ถูกบันทึกไปแล้ว',
        entry_id: dup.rows[0].id,
        occurred_at: dup.rows[0].occurred_at,
      });
    }
  }

  const { rows } = await q(
    `INSERT INTO entries (user_id, type, amount, category, note, occurred_at, slip_id, txid)
     VALUES ($1, $2, $3, $4, $5, COALESCE($6::timestamptz, NOW()), $7, $8)
     RETURNING ${COLUMNS}`,
    [
      req.user.id, type, amount,
      req.body.category ? String(req.body.category).slice(0, 60) : null,
      req.body.note ? String(req.body.note).slice(0, 300) : null,
      req.body.occurred_at || null, slipId, txid,
    ]
  );

  res.status(201).json(rows[0]);
});

// PATCH /api/entries/:id — แก้เฉพาะช่องที่ส่งมา
router.patch('/:id', async (req, res) => {
  const sets = [];
  const params = [];

  const add = (col, value) => { params.push(value); sets.push(`${col} = $${params.length}`); };

  if (req.body.type !== undefined) {
    const type = readType(req.body.type);
    if (!type) return res.status(400).json({ error: 'ประเภทไม่ถูกต้อง' });
    add('type', type);
  }
  if (req.body.amount !== undefined) {
    const amount = readAmount(req.body.amount);
    if (!amount) return res.status(400).json({ error: 'จำนวนเงินต้องมากกว่า 0' });
    add('amount', amount);
  }
  if (req.body.category !== undefined) add('category', String(req.body.category).slice(0, 60) || null);
  if (req.body.note !== undefined) add('note', String(req.body.note).slice(0, 300) || null);
  if (req.body.occurred_at !== undefined) add('occurred_at', req.body.occurred_at);

  if (!sets.length) return res.status(400).json({ error: 'ไม่มีข้อมูลที่จะแก้ไข' });

  params.push(+req.params.id || 0, req.user.id);
  const { rows } = await q(
    `UPDATE entries SET ${sets.join(', ')}
     WHERE id = $${params.length - 1} AND user_id = $${params.length}
     RETURNING ${COLUMNS}`,
    params
  );

  if (!rows.length) return res.status(404).json({ error: 'ไม่พบรายการนี้' });
  res.json(rows[0]);
});

// DELETE /api/entries/:id
router.delete('/:id', async (req, res) => {
  const { rowCount } = await q(
    `DELETE FROM entries WHERE id = $1 AND user_id = $2`,
    [+req.params.id || 0, req.user.id]
  );
  if (!rowCount) return res.status(404).json({ error: 'ไม่พบรายการนี้' });
  res.json({ ok: true });
});

export default router;
