// ============================================================
// api.js — Fetch wrapper สำหรับทุก GAS endpoint
// ============================================================

const GET_ACTIONS = new Set([
  'getConfig','getTransactions','getDashboard','getBankAccounts',
  'getVendors','getUserRole','getUsers','checkCloseReady','getDailyReport',
  'getMonthlyReport','getBankRecon','getRegisterReport','getDropdownOptions',
  'getAuditLog','getPendingCloseRequest','getSystemConfig',
]);

async function apiCall(action, data = {}) {
  if (!window.AppConfig.gasUrl) {
    throw new Error('ระบบยังไม่โหลด config กรุณารีเฟรชหน้า');
  }

  const token  = getToken();
  const isGet  = GET_ACTIONS.has(action);
  const url    = window.AppConfig.gasUrl;

  try {
    let res;
    if (isGet) {
      const params = new URLSearchParams({ action, token, ...data });
      res = await fetch(`${url}?${params}`, {
        method: 'GET',
        redirect: 'follow',
      });
    } else {
      res = await fetch(url, {
        method: 'POST',
        redirect: 'follow',
        body: JSON.stringify({ action, token, ...data }),
      });
    }

    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = await res.json();

    if (json.error === 'Unauthorized — token ไม่ถูกต้องหรือหมดอายุ') {
      showToast('Session หมดอายุ กรุณาเข้าสู่ระบบใหม่', 'error');
      setTimeout(() => logout(), 1500);
      throw new Error('Unauthorized');
    }

    return json;
  } catch(err) {
    // Offline check
    if (!navigator.onLine) {
      showOfflineBanner(true);
      throw new Error('ไม่มีการเชื่อมต่ออินเทอร์เน็ต');
    }
    throw err;
  }
}

// ===== Offline Banner =====
function showOfflineBanner(show) {
  let banner = document.getElementById('offline-banner');
  if (!banner) {
    banner = document.createElement('div');
    banner.id = 'offline-banner';
    banner.className = 'offline-banner';
    banner.innerHTML = '⚠️ ไม่มีการเชื่อมต่ออินเทอร์เน็ต — ข้อมูลอาจไม่ทันสมัย';
    document.body.prepend(banner);
  }
  banner.style.display = show ? 'flex' : 'none';
}

window.addEventListener('online',  () => showOfflineBanner(false));
window.addEventListener('offline', () => showOfflineBanner(true));

// ===== Convenience wrappers =====
const API = {
  getDashboard:           ()       => apiCall('getDashboard'),
  getConfig:              ()       => apiCall('getConfig'),
  updateConfig:           (data)   => apiCall('updateConfig', data),
  getTransactions:        (filter) => apiCall('getTransactions', filter),
  addTransaction:         (tx)     => apiCall('addTransaction', tx),
  updateTransaction:      (tx)     => apiCall('updateTransaction', tx),
  deleteTransaction:      (rowIndex) => apiCall('deleteTransaction', { rowIndex }),
  getDropdownOptions:     ()       => apiCall('getDropdownOptions'),
  getBankAccounts:        ()       => apiCall('getBankAccounts'),
  addBankAccount:         (data)   => apiCall('addBankAccount', data),
  updateBankAccount:      (data)   => apiCall('updateBankAccount', data),
  getVendors:             ()       => apiCall('getVendors'),
  addVendor:              (data)   => apiCall('addVendor', data),
  getUsers:               ()       => apiCall('getUsers'),
  addUser:                (data)   => apiCall('addUser', data),
  updateUser:             (data)   => apiCall('updateUser', data),
  checkCloseReady:        ()       => apiCall('checkCloseReady'),
  createCloseRequest:     ()       => apiCall('createCloseRequest'),
  getPendingCloseRequest: ()       => apiCall('getPendingCloseRequest'),
  directorApprove:        (reqId)  => apiCall('directorApprove', { requestId: reqId }),
  getDailyReport:         ()       => apiCall('getDailyReport'),
  getMonthlyReport:       ()       => apiCall('getMonthlyReport'),
  getBankRecon:           ()       => apiCall('getBankRecon'),
  getRegisterReport:      (type)   => apiCall('getRegisterReport', { type }),
  getAuditLog:            ()       => apiCall('getAuditLog'),
};
