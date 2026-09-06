/* report.js — รายงานรายเดือน กราฟรายวัน กราฟแยกหมวด และส่งออก CSV */
'use strict';

const repMonth = document.getElementById('repMonth');
const reportMsg = document.getElementById('reportMsg');

// จานสีโทนฟ้าสำหรับกราฟวงกลม ไล่จากเข้มไปอ่อน
const PIE_COLORS = ['#0e2a4a', '#25689f', '#2f7fc4', '#6aa9dd', '#9cc7ea', '#c6def4', '#17835a', '#b07000'];

repMonth.value = currentMonth();

function drawPie(canvasId, rows) {
  App.charts[canvasId]?.destroy();
  App.charts[canvasId] = new Chart(document.getElementById(canvasId), {
    type: 'doughnut',
    data: {
      labels: rows.map((r) => r.category),
      datasets: [{ data: rows.map((r) => r.total), backgroundColor: PIE_COLORS, borderWidth: 2, borderColor: '#fff' }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: '58%',
      plugins: {
        legend: { position: 'bottom', labels: { boxWidth: 8, boxHeight: 8, usePointStyle: true, pointStyle: 'circle', padding: 12 } },
        tooltip: { callbacks: { label: (c) => ` ${c.label} ${money(c.parsed)} บาท` } },
      },
    },
  });
}

async function loadReport() {
  showMsg(reportMsg, 'กำลังโหลดรายงาน...');
  try {
    const r = await Api.get('/summary/report?month=' + repMonth.value);
    document.getElementById('reportMonthLabel').textContent = thaiMonthName(r.month);

    drawBarChart('chartDaily',
      r.daily.map((d) => d.day),
      r.daily.map((d) => d.income),
      r.daily.map((d) => d.expense));

    drawPie('chartExpenseCat', r.expense_by_category);
    drawPie('chartIncomeCat', r.income_by_category);

    showMsg(reportMsg, r.daily.length ? '' : 'เดือนนี้ยังไม่มีรายการ');
    document.getElementById('chartDaily').closest('.card').classList.toggle('hide', !r.daily.length);
  } catch (err) {
    showMsg(reportMsg, err.message, 'error');
  }
}

/** ดาวน์โหลด CSV — ต้องแนบโทเคน จึงดึงเป็น blob แล้วค่อยสั่งเซฟ */
document.getElementById('btnExport').onclick = async () => {
  const month = repMonth.value;
  const from = month + '-01';
  const to = new Date(new Date(from).getFullYear(), new Date(from).getMonth() + 1, 0)
    .toLocaleDateString('sv-SE');

  showMsg(reportMsg, 'กำลังเตรียมไฟล์...');
  try {
    const res = await fetch(`/api/export/csv?from=${from}&to=${to}`, {
      headers: { Authorization: 'Bearer ' + Api.getToken() },
    });
    if (!res.ok) throw new Error('ส่งออกไม่สำเร็จ');

    const url = URL.createObjectURL(await res.blob());
    const a = document.createElement('a');
    a.href = url;
    a.download = `jodjodkub-${month}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    showMsg(reportMsg, 'ดาวน์โหลดไฟล์ CSV แล้ว', 'ok');
  } catch (err) {
    showMsg(reportMsg, err.message, 'error');
  }
};

document.getElementById('btnLoadReport').onclick = () => loadReport();
document.addEventListener('tab:report', () => loadReport());
