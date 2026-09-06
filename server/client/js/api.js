/* api.js — คุยกับ API และฟังก์ชันช่วยเหลือที่ใช้ร่วมกันทุกหน้า */
'use strict';

const TOKEN_KEY = 'jodjodkub_token';

const Api = {
  getToken: () => localStorage.getItem(TOKEN_KEY),
  setToken: (t) => localStorage.setItem(TOKEN_KEY, t),
  clearToken: () => localStorage.removeItem(TOKEN_KEY),

  /** ยิง request ไป /api — ถ้าเซิร์ฟเวอร์ตอบ error จะ throw พร้อมข้อความภาษาไทย */
  async send(method, path, body) {
    const options = { method, headers: {} };
    const token = Api.getToken();
    if (token) options.headers.Authorization = 'Bearer ' + token;

    if (body instanceof FormData) {
      options.body = body; // ปล่อยให้เบราว์เซอร์ตั้ง Content-Type เอง
    } else if (body !== undefined) {
      options.headers['Content-Type'] = 'application/json';
      options.body = JSON.stringify(body);
    }

    const res = await fetch('/api' + path, options);

    if (res.status === 401) {
      Api.clearToken();
      if (!location.pathname.endsWith('/') && !location.pathname.endsWith('index.html')) {
        location.href = '/';
      }
      throw new Error('กรุณาเข้าสู่ระบบใหม่');
    }

    const data = res.status === 204 ? {} : await res.json().catch(() => ({}));
    if (!res.ok) {
      const err = new Error(data.error || 'เกิดข้อผิดพลาด');
      err.status = res.status;
      err.data = data;
      throw err;
    }
    return data;
  },

  get: (p) => Api.send('GET', p),
  post: (p, b) => Api.send('POST', p, b),
  put: (p, b) => Api.send('PUT', p, b),
  patch: (p, b) => Api.send('PATCH', p, b),
  del: (p) => Api.send('DELETE', p),
};

/* ---------- ฟังก์ชันช่วยจัดรูปแบบ ---------- */

/** 1250.5 -> "1,250.50" */
function money(n) {
  return Number(n || 0).toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/** ISO -> "5 ก.ย. 2568 14:32" */
function thaiDateTime(iso) {
  return new Date(iso).toLocaleString('th-TH', {
    day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
  });
}

/** เดือนปัจจุบันในรูปแบบ YYYY-MM ตามเวลาท้องถิ่น */
function currentMonth() {
  return new Date().toLocaleDateString('sv-SE').slice(0, 7);
}

/** กันข้อความจากผู้ใช้ไปแทรกเป็น HTML */
function escapeHtml(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
  ));
}

/** แสดงข้อความสถานะใต้ฟอร์ม */
function showMsg(el, text, kind) {
  el.textContent = text;
  el.className = 'msg' + (kind ? ' ' + kind : '');
}
