// routes/summary.js — ตัวเลขสรุปหน้าแดชบอร์ด และรายงานรายเดือน
import { Router } from 'express';
import { q } from '../db.js';
import { requireAuth } from '../auth.js';

const router = Router();
router.use(requireAuth);

const thisMonth = () => new Date().toLocaleDateString('sv-SE').slice(0, 7); // 'YYYY-MM'
const validMonth = (m) => (/^\d{4}-\d{2}$/.test(m || '') ? m : thisMonth());

/** สถานะงบประมาณของเดือนที่ระบุ พร้อมเปอร์เซ็นต์ที่ใช้ไป */
async function budgetStatus(userId, month) {
  const { rows } = await q(
    `SELECT b.id, b.category, b.amount AS limit_amount,
            COALESCE(SUM(e.amount), 0) AS spent
     FROM budgets b
     LEFT JOIN entries e
       ON e.user_id = b.user_id
      AND e.type = 'expense'
      AND to_char(e.occurred_at, 'YYYY-MM') = b.month
      AND (b.category IS NULL OR e.category = b.category)
     WHERE b.user_id = $1 AND b.month = $2
     GROUP BY b.id
     ORDER BY b.category NULLS FIRST`,
    [userId, month]
  );

  return rows.map((b) => ({
    ...b,
    percent: Math.round((b.spent / b.limit_amount) * 100),
    level: b.spent > b.limit_amount ? 'over' : b.spent >= b.limit_amount * 0.8 ? 'warn' : 'ok',
  }));
}

// GET /api/summary — การ์ดสรุป + กราฟ 12 เดือน + สถานะงบเดือนนี้
router.get('/', async (req, res) => {
  const uid = req.user.id;
  const month = thisMonth();

  const totals = await q(
    `SELECT
       COALESCE(SUM(amount) FILTER (WHERE type='income'  AND occurred_at::date = CURRENT_DATE), 0) AS today_income,
       COALESCE(SUM(amount) FILTER (WHERE type='expense' AND occurred_at::date = CURRENT_DATE), 0) AS today_expense,
       COALESCE(SUM(amount) FILTER (WHERE type='income'  AND to_char(occurred_at,'YYYY-MM') = $2), 0) AS month_income,
       COALESCE(SUM(amount) FILTER (WHERE type='expense' AND to_char(occurred_at,'YYYY-MM') = $2), 0) AS month_expense
     FROM entries WHERE user_id = $1`,
    [uid, month]
  );

  const series = await q(
    `SELECT to_char(occurred_at, 'YYYY-MM') AS month,
            COALESCE(SUM(amount) FILTER (WHERE type='income'), 0)  AS income,
            COALESCE(SUM(amount) FILTER (WHERE type='expense'), 0) AS expense
     FROM entries
     WHERE user_id = $1 AND occurred_at >= date_trunc('month', CURRENT_DATE) - INTERVAL '11 months'
     GROUP BY 1 ORDER BY 1`,
    [uid]
  );

  // รายการล่าสุดไว้โชว์บนแดชบอร์ด
  const recent = await q(
    `SELECT id, type, amount, category, note, occurred_at, slip_id
     FROM entries WHERE user_id = $1
     ORDER BY occurred_at DESC, id DESC LIMIT 6`,
    [uid]
  );

  // หมวดที่ใช้จ่ายมากที่สุดในเดือนนี้
  const topCategories = await q(
    `SELECT COALESCE(NULLIF(category, ''), 'ไม่ระบุหมวด') AS category, SUM(amount) AS total
     FROM entries
     WHERE user_id = $1 AND type = 'expense' AND to_char(occurred_at, 'YYYY-MM') = $2
     GROUP BY 1 ORDER BY total DESC LIMIT 5`,
    [uid, month]
  );

  const t = totals.rows[0];
  res.json({
    month,
    ...t,
    month_balance: t.month_income - t.month_expense,
    series: series.rows,
    budgets: await budgetStatus(uid, month),
    recent: recent.rows,
    top_categories: topCategories.rows,
  });
});

// GET /api/summary/report?month=YYYY-MM — ยอดรายวัน + แยกตามหมวด + สถานะงบ
router.get('/report', async (req, res) => {
  const uid = req.user.id;
  const month = validMonth(req.query.month);

  const daily = await q(
    `SELECT to_char(occurred_at, 'DD') AS day,
            COALESCE(SUM(amount) FILTER (WHERE type='income'), 0)  AS income,
            COALESCE(SUM(amount) FILTER (WHERE type='expense'), 0) AS expense
     FROM entries
     WHERE user_id = $1 AND to_char(occurred_at, 'YYYY-MM') = $2
     GROUP BY 1 ORDER BY 1`,
    [uid, month]
  );

  const byCategory = await q(
    `SELECT type, COALESCE(NULLIF(category, ''), 'ไม่ระบุหมวด') AS category, SUM(amount) AS total
     FROM entries
     WHERE user_id = $1 AND to_char(occurred_at, 'YYYY-MM') = $2
     GROUP BY 1, 2 ORDER BY total DESC`,
    [uid, month]
  );

  res.json({
    month,
    daily: daily.rows,
    income_by_category: byCategory.rows.filter((r) => r.type === 'income'),
    expense_by_category: byCategory.rows.filter((r) => r.type === 'expense'),
    budgets: await budgetStatus(uid, month),
  });
});

export default router;
