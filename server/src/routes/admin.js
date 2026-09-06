// routes/admin.js — จัดการสมาชิก
// ตั้งใจไม่มี endpoint ใดคืนรายการเงินของสมาชิกคนอื่น แอดมินก็ดูไม่ได้
import { Router } from 'express';
import { q } from '../db.js';
import { requireAuth, requireAdmin, hashPassword } from '../auth.js';

const router = Router();
router.use(requireAuth, requireAdmin);
const MIN_PASSWORD = 8;

// GET /api/admin/users — รายชื่อสมาชิก (ไม่มีข้อมูลการเงินติดมาด้วย)
router.get('/users', async (req, res) => {
  const { rows } = await q(
    `SELECT id, email, display_name, role, created_at FROM users ORDER BY created_at DESC`
  );
  res.json({ items: rows });
});

// POST /api/admin/users/:id/password — ตั้งรหัสผ่านใหม่ให้สมาชิก
router.post('/users/:id/password', async (req, res) => {
  const password = String(req.body.new_password || '');
  if (password.length < MIN_PASSWORD) {
    return res.status(400).json({ error: `รหัสผ่านต้องยาวอย่างน้อย ${MIN_PASSWORD} ตัวอักษร` });
  }

  const { rowCount } = await q(
    `UPDATE users SET password_hash = $1 WHERE id = $2`,
    [await hashPassword(password), +req.params.id || 0]
  );
  if (!rowCount) return res.status(404).json({ error: 'ไม่พบสมาชิกคนนี้' });
  res.json({ ok: true });
});

// PATCH /api/admin/users/:id/role
router.patch('/users/:id/role', async (req, res) => {
  const role = req.body.role;
  if (role !== 'user' && role !== 'admin') return res.status(400).json({ error: 'บทบาทไม่ถูกต้อง' });

  const id = +req.params.id || 0;
  if (id === req.user.id) return res.status(400).json({ error: 'เปลี่ยนบทบาทของตัวเองไม่ได้' });

  const { rows } = await q(
    `UPDATE users SET role = $1 WHERE id = $2 RETURNING id, email, display_name, role, created_at`,
    [role, id]
  );
  if (!rows.length) return res.status(404).json({ error: 'ไม่พบสมาชิกคนนี้' });
  res.json(rows[0]);
});

// DELETE /api/admin/users/:id — ลบสมาชิกพร้อมข้อมูลทั้งหมดของเขา
router.delete('/users/:id', async (req, res) => {
  const id = +req.params.id || 0;
  if (id === req.user.id) return res.status(400).json({ error: 'ลบบัญชีตัวเองไม่ได้' });

  const { rowCount } = await q(`DELETE FROM users WHERE id = $1`, [id]);
  if (!rowCount) return res.status(404).json({ error: 'ไม่พบสมาชิกคนนี้' });
  res.json({ ok: true });
});

export default router;
