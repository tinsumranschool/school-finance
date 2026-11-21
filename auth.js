// ============================================================
// auth.js — Google OAuth2, Token Management, Role Guard
// ============================================================

const TOKEN_KEY    = 'finance_token';
const USER_KEY     = 'finance_user';
const EXPIRY_KEY   = 'finance_token_expiry';
const IDLE_LIMIT   = 2 * 60 * 60 * 1000;  // 2 ชั่วโมง
const REFRESH_BEFORE = 30 * 60 * 1000;     // refresh ถ้าเหลือ < 30 นาที

let _idleTimer = null;

// ===== Google Identity Services (GSI) =====
function initGoogleAuth(callback) {
  google.accounts.id.initialize({
    client_id: GOOGLE_CLIENT_ID,
    callback: async function(response) {
      await handleGoogleSignIn(response.credential);
      if (callback) callback();
    },
    auto_select: false,
    cancel_on_tap_outside: true,
  });
}

function renderGoogleButton(elementId) {
  google.accounts.id.renderButton(
    document.getElementById(elementId),
    { theme: 'outline', size: 'large', text: 'signin_with', locale: 'th', shape: 'rectangular', width: 280 }
  );
}

async function handleGoogleSignIn(idToken) {
  showLoginLoading(true);
  try {
    const res = await fetch(window.AppConfig.gasUrl + '?action=login', {
      method: 'POST',
      body: JSON.stringify({ action: 'login', idToken }),
    });
    const data = await res.json();

    if (!data.success) {
      showLoginError(data.error || 'ไม่สามารถเข้าสู่ระบบได้');
      return;
    }

    // เก็บ token
    localStorage.setItem(TOKEN_KEY,  data.token);
    localStorage.setItem(USER_KEY,   JSON.stringify(data.user));
    localStorage.setItem(EXPIRY_KEY, data.tokenExpiry);

    resetIdleTimer();
    redirectByRole(data.user.role);

  } catch(err) {
    showLoginError('เกิดข้อผิดพลาด: ' + err.message);
  } finally {
    showLoginLoading(false);
  }
}

// ===== Current User =====
function getCurrentUser() {
  try {
    const u = localStorage.getItem(USER_KEY);
    return u ? JSON.parse(u) : null;
  } catch(e) { return null; }
}

function getToken() {
  return localStorage.getItem(TOKEN_KEY) || '';
}

function isLoggedIn() {
  const token  = getToken();
  const expiry = localStorage.getItem(EXPIRY_KEY);
  if (!token || !expiry) return false;
  return new Date(expiry) > new Date();
}

// ===== Role Guard =====
function requireRole(...roles) {
  if (!isLoggedIn()) {
    window.location.href = 'index.html?error=session_expired';
    return false;
  }
  const user = getCurrentUser();
  if (!user || !roles.includes(user.role)) {
    window.location.href = 'index.html?error=unauthorized';
    return false;
  }
  return true;
}

function requireAnyLogin() {
  if (!isLoggedIn()) {
    window.location.href = 'index.html?error=session_expired';
    return false;
  }
  return true;
}

function redirectByRole(role) {
  window.location.href = 'dashboard.html';
}

// ===== Logout =====
async function logout() {
  const token = getToken();
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
  localStorage.removeItem(EXPIRY_KEY);
  clearIdleTimer();
  resetConfigCache();
  google.accounts.id.disableAutoSelect();
  window.location.href = 'index.html';
}

// ===== Idle Timer =====
function resetIdleTimer() {
  clearIdleTimer();
  _idleTimer = setTimeout(() => {
    showToast('หมดเวลาใช้งาน กรุณาเข้าสู่ระบบใหม่', 'warning');
    setTimeout(() => logout(), 2000);
  }, IDLE_LIMIT);
}

function clearIdleTimer() {
  if (_idleTimer) clearTimeout(_idleTimer);
}

// รีเซ็ต idle เมื่อมี user action
['click','keydown','mousemove','touchstart'].forEach(evt => {
  document.addEventListener(evt, () => { if (isLoggedIn()) resetIdleTimer(); }, { passive: true });
});

// ===== Render User Info ใน Sidebar =====
function renderUserInfo() {
  const user = getCurrentUser();
  if (!user) return;
  const nameEl  = document.getElementById('user-name');
  const roleEl  = document.getElementById('user-role');
  const photoEl = document.getElementById('user-photo');
  const roleMap = { admin: 'ผู้ดูแลระบบ', director: 'ผู้อำนวยการ', viewer: 'ผู้ชม' };
  if (nameEl)  nameEl.textContent  = user.displayName || user.email;
  if (roleEl)  roleEl.textContent  = roleMap[user.role] || user.role;
  if (photoEl && user.photoUrl) {
    photoEl.src = user.photoUrl;
    photoEl.onerror = () => { photoEl.src = 'assets/img/default-avatar.png'; };
  }
}

// ===== ซ่อน/แสดง element ตาม role =====
function applyRoleVisibility() {
  const user = getCurrentUser();
  if (!user) return;
  document.querySelectorAll('[data-role]').forEach(el => {
    const allowed = el.dataset.role.split(',').map(r => r.trim());
    el.style.display = allowed.includes(user.role) ? '' : 'none';
  });
}

function showLoginLoading(show) {
  const btn = document.getElementById('google-btn-wrapper');
  const spinner = document.getElementById('login-spinner');
  if (btn)     btn.style.display     = show ? 'none' : 'block';
  if (spinner) spinner.style.display = show ? 'flex' : 'none';
}

function showLoginError(msg) {
  const el = document.getElementById('login-error');
  if (el) { el.textContent = msg; el.style.display = 'block'; }
}
