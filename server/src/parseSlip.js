// parseSlip.js — แปลงข้อความดิบที่ได้จาก OCR ให้เป็นข้อมูลรายการ
// คืน { amount, occurredAt, ref } ช่องไหนอ่านไม่ได้จะเป็น null ให้ผู้ใช้กรอกเอง

const THAI_DIGITS = '๐๑๒๓๔๕๖๗๘๙';

/** เลขไทย ๐-๙ -> 0-9, ตัดอักขระล่องหน, ยุบช่องว่างซ้ำ */
export function normalize(raw = '') {
  return String(raw)
    .normalize('NFC')
    .replace(/[​ ]/g, ' ')
    .replace(/[๐-๙]/g, (d) => String(THAI_DIGITS.indexOf(d)))
    .replace(/[ \t]+/g, ' ')
    .trim();
}

function toNumber(s) {
  const n = Number(String(s).replace(/,/g, ''));
  return Number.isFinite(n) && n > 0 ? n : null;
}

// ---------- จำนวนเงิน ----------

export function findAmount(text) {
  const t = normalize(text);

  // 1) มีคำว่า "จำนวน"/"จำนวนเงิน"/"ยอดเงิน" นำหน้า — แม่นที่สุด
  //    OCR มักอ่าน "จำ" เป็น "จํา" จึงยอมรับทั้งสองแบบ
  let m = t.match(/(?:จ[ำํ]านวน(?:เงิน)?|ยอดเงิน|ยอดชำระ)\s*[:：]?\s*([\d,]+(?:\.\d{1,2})?)/);
  if (m) return toNumber(m[1]);

  // 2) ตัวเลขที่ตามด้วยหน่วยเงิน
  m = t.match(/([\d,]+\.\d{2})\s*(?:บาท|THB|฿)/i);
  if (m) return toNumber(m[1]);

  m = t.match(/(?:THB|฿)\s*([\d,]+(?:\.\d{1,2})?)/i);
  if (m) return toNumber(m[1]);

  // 3) เดาจากตัวเลขทศนิยม 2 ตำแหน่งที่มีค่ามากที่สุดในสลิป
  const found = (t.match(/\d[\d,]*\.\d{2}/g) || []).map(toNumber).filter(Boolean);
  return found.length ? Math.max(...found) : null;
}

// ---------- วันเวลา ----------

// ชื่อเดือนแบบเต็ม
const FULL_MONTH_RE = /(\d{1,2})\s*(มกราคม|กุมภาพันธ์|มีนาคม|เมษายน|พฤษภาคม|มิถุนายน|กรกฎาคม|สิงหาคม|กันยายน|ตุลาคม|พฤศจิกายน|ธันวาคม)\s*(\d{2,4})/;

const FULL_MONTH = ['มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน',
  'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'];

// ชื่อเดือนแบบย่อ: จับคำไทยสั้น ๆ ที่ขึ้นต้นและลงท้ายด้วยพยัญชนะ ระหว่างวันที่กับปี
const ABBR_MONTH_RE = /(\d{1,2})\s*([ก-ฮ][ก-ฮะ-๎.]{0,3}[ก-ฮ])\.?\s*(\d{2,4})\b/;

const ABBR_MONTH = {
  มค: 0, กพ: 1, มีค: 2, เมย: 3, พค: 4, มิย: 5,
  กค: 6, สค: 7, กย: 8, ตค: 9, พย: 10, ธค: 11,
};

/** ตัดจุดและสระล่าง (ุ ู ฺ) ทิ้ง — OCR ชอบอ่านจุดของตัวย่อเป็นสระล่าง เช่น "ก.ย." เป็น "กุย."
 *  ตัวย่อเดือนไทยไม่มีสระล่างอยู่แล้ว จึงตัดทิ้งได้ปลอดภัย */
function abbrKey(token) {
  return token.replace(/[.ฺุู]/g, '');
}

/** ปีอาจมาเป็น พ.ศ. 4 หลัก (2568), พ.ศ. 2 หลัก (68) หรือ ค.ศ. (2025) */
function toChristianYear(y) {
  const n = Number(y);
  if (n > 2400) return n - 543;        // พ.ศ. เต็ม
  if (n < 100) return 2500 + n - 543;  // พ.ศ. ย่อ เช่น 68 -> 2025
  return n;                            // ค.ศ. อยู่แล้ว
}

function build(year, monthIdx, day, text) {
  const time = text.match(/\b([01]?\d|2[0-3])[:.]([0-5]\d)\b/);
  const d = new Date(year, monthIdx, day, time ? +time[1] : 0, time ? +time[2] : 0);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function findDate(text) {
  const t = normalize(text);

  // แบบไทยชื่อเต็ม: 5 กันยายน 2568
  let m = t.match(FULL_MONTH_RE);
  if (m) return build(toChristianYear(m[3]), FULL_MONTH.indexOf(m[2]), +m[1], t);

  // แบบไทยตัวย่อ: 5 ก.ย. 68
  m = t.match(ABBR_MONTH_RE);
  if (m) {
    const idx = ABBR_MONTH[abbrKey(m[2])];
    if (idx !== undefined) return build(toChristianYear(m[3]), idx, +m[1], t);
  }

  // แบบตัวเลข: 05/09/2025 หรือ 05-09-68
  m = t.match(/\b(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})\b/);
  if (m) return build(toChristianYear(m[3]), +m[2] - 1, +m[1], t);

  // แบบสากล: 2025-09-05
  m = t.match(/\b(\d{4})-(\d{2})-(\d{2})\b/);
  if (m) return build(+m[1], +m[2] - 1, +m[3], t);

  return null;
}

// ---------- เลขอ้างอิง ----------

const REF_RE = /(?:เลขที่รายการ|รหัสอ้างอิง|หมายเลขอ้างอิง|เลขที่อ้างอิง|Ref(?:erence)?(?:\s*(?:No|Code))?|Transaction\s*ID)\s*[:：#]?\s*([A-Za-z0-9]{8,40})/i;

export function findRef(text) {
  const m = normalize(text).match(REF_RE);
  return m ? m[1] : null;
}

// ---------- รวมทุกอย่าง ----------

export function parseSlip(text) {
  const when = findDate(text);
  return {
    amount: findAmount(text),
    occurredAt: when ? when.toISOString() : null,
    ref: findRef(text),
  };
}
