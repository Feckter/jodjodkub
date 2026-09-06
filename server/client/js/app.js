/* app.js — โครงหลักของแอป: ตรวจล็อกอิน สลับแท็บ แดชบอร์ด และตารางรายการ */
'use strict';

if (!Api.getToken()) location.replace('/');

/* ---------- ค่าเริ่มต้นของกราฟ ให้เข้ากับธีมทั้งเว็บ ---------- */

Chart.defaults.font.family = '"Sarabun", "Leelawadee UI", "Segoe UI", sans-serif';
Chart.defaults.font.size = 12;
Chart.defaults.color = '#8194a6';

const COLOR = { income: '#17835a', expense: '#c8453f', line: '#e3ebf3' };

// ของกลางที่ไฟล์อื่น (slip.js, budget.js, report.js, admin.js) เรียกใช้ได้
const App = {
  user: null,
  categories: [],
  charts: {},

  /** โหลดข้อมูลใหม่ทั้งแดชบอร์ด ตารางรายการ และรายการหมวดหมู่ */
  async reloadAll() {
    await Promise.all([loadSummary(), loadEntries(), loadCategories()]);
  },

  /** สลับไปแท็บที่ระบุ */
  goTab(name) {
    document.querySelector(`.tabs button[data-tab="${name}"]`)?.click();
  },

  /** วาดแถบงบประมาณ ใช้ร่วมกันระหว่างแดชบอร์ดกับแท็บงบประมาณ */
  renderBudgets(box, list, options = {}) {
    if (!list.length) {
      box.innerHTML = emptyState('฿', options.emptyText || 'ยังไม่ได้ตั้งงบประมาณ');
      return;
    }

    box.innerHTML = list.map((b) => {
      const name = b.category ? escapeHtml(b.category) : 'งบรวมทั้งเดือน';
      const left = b.limit_amount - b.spent;
      const note = b.level === 'over'
        ? `เกินงบไปแล้ว ${money(-left)} บาท`
        : b.level === 'warn'
          ? `ใกล้เต็มงบ เหลืออีก ${money(left)} บาท`
          : `เหลืออีก ${money(left)} บาท`;

      return `
        <div class="budget ${b.level}">
          <div class="head">
            <span class="name">${name}</span>
            <span class="figure">${money(b.spent)} / ${money(b.limit_amount)} · ${b.percent}%</span>
          </div>
          <div class="bar"><span style="width:${Math.min(b.percent, 100)}%"></span></div>
          <div class="note">${note}${options.deletable ? ` · <a href="#" data-del-budget="${b.id}">ลบงบนี้</a>` : ''}</div>
        </div>`;
    }).join('');
  },
};

/** กล่องข้อความตอนยังไม่มีข้อมูล */
function emptyState(mark, text) {
  return `<div class="empty-state"><div class="mark">${mark}</div><p>${text}</p></div>`;
}

/** 'YYYY-MM' -> 'กันยายน 2569' */
function thaiMonthName(ym) {
  const [y, m] = ym.split('-');
  return new Date(+y, +m - 1, 1).toLocaleDateString('th-TH', { month: 'long', year: 'numeric' });
}

/* ---------- แถบหัวและแท็บ ---------- */

Api.get('/auth/me').then((me) => {
  App.user = me;
  document.getElementById('who').textContent = `${me.display_name} · ${me.email}`;
  if (me.role === 'admin') document.getElementById('tabAdmin').classList.remove('hide');
});

document.querySelectorAll('.tabs button').forEach((btn) => {
  btn.onclick = () => {
    document.querySelectorAll('.tabs button').forEach((b) => b.classList.toggle('active', b === btn));
    document.querySelectorAll('.page > section').forEach((s) => {
      s.classList.toggle('hide', s.id !== 'panel-' + btn.dataset.tab);
    });
    scrollTo({ top: 0 });
    document.dispatchEvent(new CustomEvent('tab:' + btn.dataset.tab));
  };
});

// ลิงก์ "ดูทั้งหมด" / "ตั้งงบ" บนแดชบอร์ด
document.addEventListener('click', (e) => {
  const link = e.target.closest('a[data-goto]');
  if (!link) return;
  e.preventDefault();
  App.goTab(link.dataset.goto);
});

document.getElementById('btnLogout').onclick = () => {
  Api.clearToken();
  location.href = '/';
};

/* ---------- เปลี่ยนรหัสผ่าน ---------- */

const pwDialog = document.getElementById('pwDialog');
const pwMsg = document.getElementById('pwMsg');

document.getElementById('btnChangePw').onclick = () => {
  showMsg(pwMsg, '');
  pwDialog.showModal();
};
document.getElementById('pwCancel').onclick = () => pwDialog.close();

document.getElementById('pwForm').onsubmit = async (e) => {
  e.preventDefault();
  try {
    await Api.post('/auth/change-password', {
      current_password: document.getElementById('pwCurrent').value,
      new_password: document.getElementById('pwNew').value,
    });
    e.target.reset();
    pwDialog.close();
    alert('เปลี่ยนรหัสผ่านเรียบร้อย');
  } catch (err) {
    showMsg(pwMsg, err.message, 'error');
  }
};

/* ---------- แดชบอร์ด ---------- */

async function loadSummary() {
  const s = await Api.get('/summary');

  document.getElementById('kpiTodayIn').textContent = money(s.today_income);
  document.getElementById('kpiTodayEx').textContent = money(s.today_expense);
  document.getElementById('kpiMonthIn').textContent = money(s.month_income);
  document.getElementById('kpiMonthEx').textContent = money(s.month_expense);
  document.getElementById('kpiMonthBal').textContent = money(s.month_balance);
  document.getElementById('kpiMonthName').textContent = thaiMonthName(s.month);

  App.renderBudgets(document.getElementById('dashBudgets'), s.budgets, {
    emptyText: 'ยังไม่ได้ตั้งงบประมาณเดือนนี้',
  });

  renderRecent(s.recent);
  renderTopCategories(s.top_categories);

  drawBarChart('chartMonths',
    s.series.map((r) => thaiMonthShort(r.month)),
    s.series.map((r) => r.income),
    s.series.map((r) => r.expense));
}

/** 'YYYY-MM' -> 'ก.ย. 69' สำหรับแกนกราฟที่พื้นที่จำกัด */
function thaiMonthShort(ym) {
  const [y, m] = ym.split('-');
  const d = new Date(+y, +m - 1, 1);
  return `${d.toLocaleDateString('th-TH', { month: 'short' })} ${String(+y + 543).slice(2)}`;
}

function renderRecent(items) {
  const box = document.getElementById('dashRecent');
  if (!items?.length) {
    box.innerHTML = emptyState('+', 'ยังไม่มีรายการ ลองเพิ่มรายการแรกดู');
    return;
  }

  box.innerHTML = items.map((e) => `
    <div class="feed-item">
      <div class="what">
        <div class="title">${escapeHtml(e.note || e.category || (e.type === 'income' ? 'รายรับ' : 'รายจ่าย'))}</div>
        <div class="meta">${thaiDateTime(e.occurred_at)}${e.category ? ' · ' + escapeHtml(e.category) : ''}</div>
      </div>
      <div class="amount ${e.type}-text">${e.type === 'income' ? '+' : '−'}${money(e.amount)}</div>
    </div>`).join('');
}

function renderTopCategories(items) {
  const box = document.getElementById('dashTopCategories');
  if (!items?.length) {
    box.innerHTML = emptyState('%', 'เดือนนี้ยังไม่มีรายจ่าย');
    return;
  }

  const max = Math.max(...items.map((c) => c.total));
  box.innerHTML = items.map((c) => `
    <div class="rank-item">
      <div class="head">
        <span>${escapeHtml(c.category)}</span>
        <span class="amount">${money(c.total)}</span>
      </div>
      <div class="bar"><span style="width:${Math.round((c.total / max) * 100)}%"></span></div>
    </div>`).join('');
}

/** วาดกราฟแท่งรายรับ/รายจ่าย (ใช้ทั้งแดชบอร์ดและรายงาน) */
function drawBarChart(canvasId, labels, income, expense) {
  App.charts[canvasId]?.destroy();
  App.charts[canvasId] = new Chart(document.getElementById(canvasId), {
    type: 'bar',
    data: {
      labels,
      datasets: [
        { label: 'รายรับ', data: income, backgroundColor: COLOR.income, borderRadius: 4, maxBarThickness: 26 },
        { label: 'รายจ่าย', data: expense, backgroundColor: COLOR.expense, borderRadius: 4, maxBarThickness: 26 },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { position: 'top', align: 'end', labels: { boxWidth: 8, boxHeight: 8, usePointStyle: true, pointStyle: 'circle' } },
        tooltip: { callbacks: { label: (c) => `${c.dataset.label} ${money(c.parsed.y)} บาท` } },
      },
      scales: {
        x: { grid: { display: false }, border: { color: COLOR.line } },
        y: { beginAtZero: true, border: { display: false }, grid: { color: COLOR.line }, ticks: { maxTicksLimit: 6 } },
      },
    },
  });
}

/* ---------- ตารางรายการ ---------- */

const entriesBody = document.getElementById('entriesBody');

async function loadEntries() {
  const params = new URLSearchParams({ limit: '100' });
  const month = document.getElementById('fltMonth').value;
  const type = document.getElementById('fltType').value;
  if (month) params.set('month', month);
  if (type) params.set('type', type);

  const { items, total } = await Api.get('/entries?' + params);
  document.getElementById('entriesCount').textContent = total ? `${total} รายการ` : '';

  if (!items.length) {
    entriesBody.innerHTML = `<tr><td colspan="7">${emptyState('+', 'ไม่มีรายการในช่วงที่เลือก')}</td></tr>`;
    return;
  }

  entriesBody.innerHTML = items.map((e) => `
    <tr>
      <td class="when">${thaiDateTime(e.occurred_at)}</td>
      <td><span class="badge ${e.type}">${e.type === 'income' ? 'รายรับ' : 'รายจ่าย'}</span></td>
      <td class="num ${e.type}-text">${e.type === 'income' ? '+' : '−'}${money(e.amount)}</td>
      <td>${e.category ? `<span class="chip">${escapeHtml(e.category)}</span>` : '—'}</td>
      <td>${escapeHtml(e.note || '—')}</td>
      <td>${e.slip_id ? `<a href="/api/slips/${e.slip_id}/image" data-slip="${e.slip_id}">ดูสลิป</a>` : '—'}</td>
      <td><button class="btn ghost small" data-del="${e.id}">ลบ</button></td>
    </tr>`).join('');
}

/** ดึงหมวดหมู่ที่เคยใช้ทั้งหมด (จากรายการและจากงบประมาณ ทุกเดือน)
 *  มาใส่ใน datalist เพื่อให้ทุกช่อง "หมวดหมู่" กดแล้วเลือกได้เลย */
async function loadCategories() {
  const { items } = await Api.get('/entries/categories');
  App.categories = items;
  document.getElementById('categoryList').innerHTML =
    items.map((c) => `<option value="${escapeHtml(c)}"></option>`).join('');
}

entriesBody.onclick = async (e) => {
  // เปิดรูปสลิปในแท็บใหม่ (ต้องแนบโทเคน จึงดึงเป็น blob เอง)
  const link = e.target.closest('a[data-slip]');
  if (link) {
    e.preventDefault();
    const res = await fetch(link.getAttribute('href'), { headers: { Authorization: 'Bearer ' + Api.getToken() } });
    if (res.ok) window.open(URL.createObjectURL(await res.blob()), '_blank');
    return;
  }

  const btn = e.target.closest('button[data-del]');
  if (!btn || !confirm('ยืนยันลบรายการนี้?')) return;

  btn.disabled = true;
  try {
    await Api.del('/entries/' + btn.dataset.del);
    await App.reloadAll();
  } catch (err) {
    alert(err.message);
    btn.disabled = false;
  }
};

document.getElementById('btnFilter').onclick = () => loadEntries();

/* ---------- ฟอร์มเพิ่มรายการเอง ---------- */

const addMsg = document.getElementById('addMsg');

document.getElementById('addForm').onsubmit = async (e) => {
  e.preventDefault();
  const when = document.getElementById('addWhen').value;

  showMsg(addMsg, 'กำลังบันทึก...');
  try {
    await Api.post('/entries', {
      type: document.getElementById('addType').value,
      amount: document.getElementById('addAmount').value,
      category: document.getElementById('addCategory').value,
      note: document.getElementById('addNote').value,
      occurred_at: when ? new Date(when).toISOString() : null,
    });
    showMsg(addMsg, 'บันทึกเรียบร้อย', 'ok');
    document.getElementById('addAmount').value = '';
    document.getElementById('addNote').value = '';
    await App.reloadAll();
  } catch (err) {
    showMsg(addMsg, err.message, 'error');
  }
};

/* ---------- เริ่มทำงาน ---------- */

document.getElementById('fltMonth').value = currentMonth();
App.reloadAll().catch((err) => console.error(err));
