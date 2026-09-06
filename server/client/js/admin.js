/* admin.js — แท็บแอดมิน: จัดการบัญชีสมาชิก (ไม่มีข้อมูลการเงินของใครทั้งสิ้น) */
'use strict';

const adminBody = document.getElementById('adminBody');
const adminMsg = document.getElementById('adminMsg');

async function loadUsers() {
  const { items } = await Api.get('/admin/users');

  adminBody.innerHTML = items.map((u) => `
    <tr>
      <td>${escapeHtml(u.email)}</td>
      <td>${escapeHtml(u.display_name)}</td>
      <td>${u.role}</td>
      <td>${thaiDateTime(u.created_at)}</td>
      <td>
        <button class="btn ghost small" data-pw="${u.id}">ตั้งรหัสผ่านใหม่</button>
        <button class="btn ghost small" data-role="${u.id}" data-next="${u.role === 'admin' ? 'user' : 'admin'}">
          ${u.role === 'admin' ? 'ถอดสิทธิ์แอดมิน' : 'ตั้งเป็นแอดมิน'}
        </button>
        <button class="btn danger small" data-remove="${u.id}">ลบ</button>
      </td>
    </tr>`).join('');
}

adminBody.onclick = async (e) => {
  const btn = e.target.closest('button');
  if (!btn) return;

  try {
    if (btn.dataset.pw) {
      const pw = prompt('รหัสผ่านใหม่ (อย่างน้อย 8 ตัวอักษร)');
      if (!pw) return;
      await Api.post(`/admin/users/${btn.dataset.pw}/password`, { new_password: pw });
      showMsg(adminMsg, 'ตั้งรหัสผ่านใหม่เรียบร้อย', 'ok');
      return;
    }

    if (btn.dataset.role) {
      await Api.patch(`/admin/users/${btn.dataset.role}/role`, { role: btn.dataset.next });
      showMsg(adminMsg, 'เปลี่ยนบทบาทเรียบร้อย', 'ok');
    }

    if (btn.dataset.remove) {
      if (!confirm('ลบสมาชิกคนนี้พร้อมข้อมูลทั้งหมดของเขา?')) return;
      await Api.del('/admin/users/' + btn.dataset.remove);
      showMsg(adminMsg, 'ลบสมาชิกเรียบร้อย', 'ok');
    }

    await loadUsers();
  } catch (err) {
    showMsg(adminMsg, err.message, 'error');
  }
};

document.addEventListener('tab:admin', () => loadUsers().catch((err) => showMsg(adminMsg, err.message, 'error')));
