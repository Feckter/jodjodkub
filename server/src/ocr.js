// ocr.js — อ่านข้อความและ QR จากรูปสลิป
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import jsQR from 'jsqr';
import { createWorker } from 'tesseract.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const TESSDATA = path.join(HERE, '..', 'tessdata');

// สร้าง worker ตัวเดียวแล้วใช้ซ้ำ — ถ้าสร้างใหม่ทุกครั้งจะช้ามาก
let workerPromise = null;

function getWorker() {
  if (!workerPromise) {
    // ครั้งแรกจะดาวน์โหลดไฟล์ภาษาไทย (~10MB) มาเก็บไว้ที่ tessdata/ แล้วใช้ซ้ำได้ตลอด
    workerPromise = createWorker('tha+eng', 1, { cachePath: TESSDATA });
  }
  return workerPromise;
}

/** เตรียมภาพให้ OCR อ่านง่ายขึ้น: หมุนตาม EXIF, ขาวดำ, ขยาย, ดันคอนทราสต์ */
function preprocess(filePath) {
  return sharp(filePath)
    .rotate()
    .grayscale()
    .resize({ width: 1600, withoutEnlargement: false })
    .normalise()
    .png()
    .toBuffer();
}

/** อ่านข้อความทั้งหมดในสลิป */
export async function readText(filePath) {
  const image = await preprocess(filePath);
  const worker = await getWorker();
  const { data } = await worker.recognize(image);
  return data.text || '';
}

/** อ่าน QR ในสลิป (ถ้ามี) — ใช้ payload เป็นเลขอ้างอิงสำรองสำหรับกันบันทึกซ้ำ */
export async function readQr(filePath) {
  try {
    const { data, info } = await sharp(filePath)
      .rotate()
      .resize({ width: 1200, withoutEnlargement: true })
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });

    const code = jsQR(new Uint8ClampedArray(data), info.width, info.height);
    return code?.data ? String(code.data).trim() : null;
  } catch {
    return null;
  }
}

/** ปิด worker ตอนเซิร์ฟเวอร์หยุด */
export async function closeOcr() {
  if (!workerPromise) return;
  const worker = await workerPromise;
  await worker.terminate();
  workerPromise = null;
}
