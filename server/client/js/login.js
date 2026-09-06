/* login.js — สลับฟอร์มเข้าสู่ระบบ/สมัครสมาชิก แล้วพาเข้าแอปเมื่อสำเร็จ */
'use strict';

const loginForm = document.getElementById('loginForm');
const registerForm = document.getElementById('registerForm');
const loginMsg = document.getElementById('loginMsg');
const registerMsg = document.getElementById('registerMsg');

// ถ้ามีโทเคนอยู่แล้วก็ข้ามหน้านี้ไปเลย
if (Api.getToken()) location.replace('/app.html');

document.getElementById('toRegister').onclick = () => {
  loginForm.classList.add('hide');
  registerForm.classList.remove('hide');
};

document.getElementById('toLogin').onclick = () => {
  registerForm.classList.add('hide');
  loginForm.classList.remove('hide');
};

function enterApp(result) {
  Api.setToken(result.token);
  location.href = '/app.html';
}

loginForm.onsubmit = async (e) => {
  e.preventDefault();
  showMsg(loginMsg, 'กำลังเข้าสู่ระบบ...');
  try {
    enterApp(await Api.post('/auth/login', {
      email: document.getElementById('loginEmail').value,
      password: document.getElementById('loginPassword').value,
    }));
  } catch (err) {
    showMsg(loginMsg, err.message, 'error');
  }
};

registerForm.onsubmit = async (e) => {
  e.preventDefault();
  showMsg(registerMsg, 'กำลังสมัครสมาชิก...');
  try {
    enterApp(await Api.post('/auth/register', {
      display_name: document.getElementById('regName').value,
      email: document.getElementById('regEmail').value,
      password: document.getElementById('regPassword').value,
    }));
  } catch (err) {
    showMsg(registerMsg, err.message, 'error');
  }
};
