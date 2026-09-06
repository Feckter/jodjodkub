// routes/budgets.js — ตั้งงบประมาณรายเดือน (งบรวม หรือแยกตามหมวด)
import { Router } from 'express';
import { q } from '../db.js';
import { requireAuth } from '../auth.js';

const router = Router();
router.use(requireAuth);

const isMonth = (m) => /^\d{4}-\d{2}$/.test(m || '');

// GET /api/budgets?month=YYYY-MM
router.get('/', async (req, res) => {
  const month = isMonth(req.query.month) ? req.query.month : new Date().toLocaleDateString('sv-SE').slice(0, 7);
  const { rows } = await q(
    `SELECT id, month, category, amount FROM budgets
     WHERE user_id = $1 AND month = $2
     ORDER BY category NULLS FIRST`,
    [req.user.id, month]
  );
  res.json({ month, items: rows });
});

// PUT /api/budgets — ตั้งใหม่หรือทับของเดิม (หนึ่งเดือน หนึ่งหมวด มีได้ค่าเดียว)
router.put('/', async (req, res) => {
  const month = req.body.month;
  const amount = Math.round(Number(req.body.amount) * 100) / 100;
  const category = req.body.category ? String(req.body.category).slice(0, 60) : null;

  if (!isMonth(month)) return res.status(400).json({ error: 'เดือนต้องอยู่ในรูปแบบ YYYY-MM' });
  if (!Number.isFinite(amount) || amount <= 0) return res.status(400).json({ error: 'จำนวนงบต้องมากกว่า 0' });

  const { rows } = await q(
    `INSERT INTO budgets (user_id, month, category, amount)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (user_id, month, COALESCE(category, ''))
     DO UPDATE SET amount = EXCLUDED.amount
     RETURNING id, month, category, amount`,
    [req.user.id, month, category, amount]
  );

  res.json(rows[0]);
});

// DELETE /api/budgets/:id
router.delete('/:id', async (req, res) => {
  const { rowCount } = await q(
    `DELETE FROM budgets WHERE id = $1 AND user_id = $2`,
    [+req.params.id || 0, req.user.id]
  );
  if (!rowCount) return res.status(404).json({ error: 'ไม่พบงบประมาณนี้' });
  res.json({ ok: true });
});

export default router;
