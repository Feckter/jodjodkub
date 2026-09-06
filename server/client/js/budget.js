/* budget.js — ตั้งงบประมาณรายเดือน และแสดงว่าใช้ไปแล้วเท่าไหร่ */
'use strict';

const budMonth = document.getElementById('budMonth');
const budgetMsg = document.getElementById('budgetMsg');
const budgetList = document.getElementById('budgetList');

budMonth.value = currentMonth();

/** ดึงสถานะงบของเดือนที่เลือกจากรายงาน (มียอดที่ใช้ไปคำนวณมาให้แล้ว) */
async function loadBudgets() {
  const report = await Api.get('/summary/report?month=' + budMonth.value);
  document.getElementById('budgetMonthLabel').textContent = thaiMonthName(report.month);
  App.renderBudgets(budgetList, report.budgets, {
    emptyText: 'เดือนนี้ยังไม่ได้ตั้งงบประมาณ',
    deletable: true,
  });
}

loadBudgets().catch(() => {});

document.getElementById('budgetForm').onsubmit = async (e) => {
  e.preventDefault();
  showMsg(budgetMsg, 'กำลังบันทึก...');

  try {
    await Api.put('/budgets', {
      month: budMonth.value,
      category: document.getElementById('budCategory').value.trim(),
      amount: document.getElementById('budAmount').value,
    });
    showMsg(budgetMsg, 'บันทึกงบเรียบร้อย', 'ok');
    document.getElementById('budAmount').value = '';
    await Promise.all([loadBudgets(), App.reloadAll()]);
  } catch (err) {
    showMsg(budgetMsg, err.message, 'error');
  }
};

budgetList.onclick = async (e) => {
  const link = e.target.closest('a[data-del-budget]');
  if (!link) return;
  e.preventDefault();
  if (!confirm('ยืนยันลบงบประมาณนี้?')) return;

  try {
    await Api.del('/budgets/' + link.dataset.delBudget);
    await Promise.all([loadBudgets(), App.reloadAll()]);
  } catch (err) {
    showMsg(budgetMsg, err.message, 'error');
  }
};

budMonth.onchange = () => loadBudgets();
document.addEventListener('tab:budget', () => loadBudgets());
