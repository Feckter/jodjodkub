/* slip.js — อัปโหลดสลิป อ่านด้วย OCR แล้วให้ผู้ใช้ตรวจก่อนบันทึกจริง */
'use strict';

const slipFile = document.getElementById('slipFile');
const slipMsg = document.getElementById('slipMsg');
const slipConfirm = document.getElementById('slipConfirm');
const btnReadSlip = document.getElementById('btnReadSlip');

let currentSlip = null; // { slip_id, txid } ของสลิปที่เพิ่งอ่าน

/** ISO -> ค่าที่ input[type=datetime-local] ใช้ได้ (เวลาท้องถิ่น) */
function toLocalInput(iso) {
  const d = iso ? new Date(iso) : new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function hideConfirm() {
  slipConfirm.classList.add('hide');
  currentSlip = null;
}

btnReadSlip.onclick = async () => {
  const file = slipFile.files[0];
  if (!file) return showMsg(slipMsg, 'กรุณาเลือกรูปสลิปก่อน', 'error');

  hideConfirm();
  btnReadSlip.disabled = true;
  showMsg(slipMsg, 'กำลังอ่านสลิป... ครั้งแรกอาจใช้เวลาสักครู่เพราะต้องโหลดไฟล์ภาษาไทย');

  try {
    const body = new FormData();
    body.append('image', file);
    const slip = await Api.post('/slips', body);
    currentSlip = slip;

    // แสดงรูปจากไฟล์ในเครื่องเลย ไม่ต้องดาวน์โหลดกลับมาใหม่
    document.getElementById('slipImage').src = URL.createObjectURL(file);
    document.getElementById('slipAmount').value = slip.amount ?? '';
    document.getElementById('slipWhen').value = toLocalInput(slip.occurred_at);
    document.getElementById('slipNote').value = slip.txid ? 'เลขอ้างอิง ' + slip.txid : '';
    slipConfirm.classList.remove('hide');

    if (slip.duplicate_of) {
      showMsg(slipMsg, `สลิปใบนี้เคยบันทึกไปแล้วเมื่อ ${thaiDateTime(slip.duplicate_of.occurred_at)}`, 'error');
    } else if (slip.amount === null) {
      showMsg(slipMsg, 'อ่านยอดเงินไม่ได้ กรุณากรอกเอง', 'error');
    } else {
      showMsg(slipMsg, 'อ่านสลิปเสร็จแล้ว กรุณาตรวจสอบก่อนกดยืนยัน', 'ok');
    }
  } catch (err) {
    showMsg(slipMsg, err.message, 'error');
  } finally {
    btnReadSlip.disabled = false;
  }
};

document.getElementById('btnCancelSlip').onclick = () => {
  hideConfirm();
  showMsg(slipMsg, '');
};

slipConfirm.onsubmit = async (e) => {
  e.preventDefault();
  if (!currentSlip) return;

  const when = document.getElementById('slipWhen').value;
  showMsg(slipMsg, 'กำลังบันทึก...');

  try {
    await Api.post('/entries', {
      type: document.getElementById('slipType').value,
      amount: document.getElementById('slipAmount').value,
      category: document.getElementById('slipCategory').value,
      note: document.getElementById('slipNote').value,
      occurred_at: when ? new Date(when).toISOString() : null,
      slip_id: currentSlip.slip_id,
      txid: currentSlip.txid,
    });

    hideConfirm();
    slipFile.value = '';
    showMsg(slipMsg, 'บันทึกจากสลิปเรียบร้อย', 'ok');
    await App.reloadAll();
  } catch (err) {
    showMsg(slipMsg, err.message, 'error');
  }
};
