// ============================================================
// utils.js — format เงิน, วันที่ไทย, toast, modal, loading
// ============================================================

// ===== Number & Currency =====
function formatMoney(amount, showSign = false) {
  const n = Number(amount) || 0;
  const str = Math.abs(n).toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  if (showSign && n < 0) return '−฿' + str;
  return '฿' + str;
}

function formatMoneyShort(amount) {
  const n = Math.abs(Number(amount) || 0);
  if (n >= 1_000_000) return '฿' + (n / 1_000_000).toFixed(2) + 'M';
  if (n >= 1_000)     return '฿' + (n / 1_000).toFixed(1) + 'K';
  return '฿' + n.toLocaleString('th-TH');
}

// ===== Date =====
const THAI_MONTHS = ['ม.ค.','ก.พ.','มี.ค.','เม.ย.','พ.ค.','มิ.ย.','ก.ค.','ส.ค.','ก.ย.','ต.ค.','พ.ย.','ธ.ค.'];
const THAI_MONTHS_FULL = ['มกราคม','กุมภาพันธ์','มีนาคม','เมษายน','พฤษภาคม','มิถุนายน','กรกฎาคม','สิงหาคม','กันยายน','ตุลาคม','พฤศจิกายน','ธันวาคม'];

function formatThaiDate(dateStr, full = false) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  if (isNaN(d)) return dateStr;
  const day   = d.getDate();
  const month = full ? THAI_MONTHS_FULL[d.getMonth()] : THAI_MONTHS[d.getMonth()];
  const year  = d.getFullYear() + 543;
  return `${day} ${month} ${year}`;
}

function formatThaiDateTime(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  if (isNaN(d)) return dateStr;
  const time = d.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' });
  return formatThaiDate(dateStr) + ' ' + time + ' น.';
}

function toISODate(d) {
  if (!d) return '';
  const dt = new Date(d);
  if (isNaN(dt)) return '';
  return dt.toISOString().slice(0, 10);
}

function todayISO() { return new Date().toISOString().slice(0, 10); }

// ===== Toast Notification =====
let _toastTimer = null;
function showToast(message, type = 'info', duration = 3500) {
  let toast = document.getElementById('toast-container');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'toast-container';
    document.body.appendChild(toast);
  }
  const icons = { success: '✅', error: '❌', warning: '⚠️', info: 'ℹ️' };
  const item = document.createElement('div');
  item.className = `toast toast-${type}`;
  item.innerHTML = `<span class="toast-icon">${icons[type]||'ℹ️'}</span><span class="toast-msg">${message}</span>`;
  toast.appendChild(item);
  setTimeout(() => item.classList.add('show'), 10);
  setTimeout(() => {
    item.classList.remove('show');
    setTimeout(() => item.remove(), 400);
  }, duration);
}

// ===== Confirm Dialog =====
function confirmDialog(title, message, confirmText = 'ยืนยัน', cancelText = 'ยกเลิก') {
  return new Promise(resolve => {
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.innerHTML = `
      <div class="modal-box confirm-box">
        <div class="modal-title">${title}</div>
        <div class="modal-body">${message}</div>
        <div class="modal-actions">
          <button class="btn btn-secondary" id="modal-cancel">${cancelText}</button>
          <button class="btn btn-danger" id="modal-confirm">${confirmText}</button>
        </div>
      </div>`;
    document.body.appendChild(overlay);
    requestAnimationFrame(() => overlay.classList.add('active'));
    overlay.querySelector('#modal-confirm').onclick = () => { overlay.remove(); resolve(true); };
    overlay.querySelector('#modal-cancel').onclick  = () => { overlay.remove(); resolve(false); };
  });
}

// ===== Generic Modal =====
function openModal(id) {
  const el = document.getElementById(id);
  if (el) { el.style.display = 'flex'; requestAnimationFrame(() => el.classList.add('active')); }
}
function closeModal(id) {
  const el = document.getElementById(id);
  if (el) {
    el.classList.remove('active');
    setTimeout(() => { el.style.display = 'none'; }, 300);
  }
}

// ===== Loading Overlay =====
function showLoading(show, text = 'กำลังโหลด...') {
  let el = document.getElementById('global-loading');
  if (!el) {
    el = document.createElement('div');
    el.id = 'global-loading';
    el.className = 'global-loading';
    el.innerHTML = `<div class="loading-box"><div class="spinner"></div><span id="loading-text">${text}</span></div>`;
    document.body.appendChild(el);
  }
  document.getElementById('loading-text').textContent = text;
  el.style.display = show ? 'flex' : 'none';
}

// ===== Quick Stats Sidebar =====
async function loadSidebarStats() {
  const el = document.getElementById('sidebar-cash-balance');
  if (!el) return;
  try {
    const dash = await API.getDashboard();
    el.textContent = formatMoneyShort(dash.kpi?.cashBalance || 0);
    el.classList.toggle('negative', (dash.kpi?.cashBalance || 0) < 0);
  } catch(e) {}
}

// ===== Pagination Helper =====
function renderPagination(containerId, currentPage, totalPages, onPageChange) {
  const el = document.getElementById(containerId);
  if (!el) return;
  let html = '';
  const prev = currentPage > 1;
  const next  = currentPage < totalPages;
  html += `<button class="page-btn" ${!prev ? 'disabled' : ''} onclick="${onPageChange.name}(${currentPage - 1})">‹</button>`;
  const start = Math.max(1, currentPage - 2);
  const end   = Math.min(totalPages, currentPage + 2);
  for (let p = start; p <= end; p++) {
    html += `<button class="page-btn ${p === currentPage ? 'active' : ''}" onclick="${onPageChange.name}(${p})">${p}</button>`;
  }
  html += `<button class="page-btn" ${!next ? 'disabled' : ''} onclick="${onPageChange.name}(${currentPage + 1})">›</button>`;
  html += `<span class="page-info">หน้า ${currentPage} / ${totalPages}</span>`;
  el.innerHTML = html;
}

// ===== Skeleton Loader =====
function renderSkeleton(containerId, rows = 5, cols = 6) {
  const el = document.getElementById(containerId);
  if (!el) return;
  const cells = Array(cols).fill('<td><div class="skeleton-cell"></div></td>').join('');
  el.innerHTML = Array(rows).fill(`<tr>${cells}</tr>`).join('');
}

// ===== Delta Badge (เปอร์เซ็นต์เปลี่ยนแปลง) =====
function deltaBadge(pct) {
  if (pct === null || pct === undefined) return '';
  const sign  = pct >= 0 ? '+' : '';
  const cls   = pct >= 0 ? 'delta-up' : 'delta-down';
  const arrow = pct >= 0 ? '▲' : '▼';
  return `<span class="delta-badge ${cls}">${arrow} ${sign}${Number(pct).toFixed(1)}%</span>`;
}

// ===== Debounce =====
function debounce(fn, delay = 400) {
  let timer;
  return (...args) => { clearTimeout(timer); timer = setTimeout(() => fn(...args), delay); };
}

// ===== Export to CSV =====
function exportCSV(data, filename = 'export.csv') {
  if (!data || !data.length) return;
  const headers = Object.keys(data[0]);
  const rows = data.map(r => headers.map(h => `"${String(r[h]||'').replace(/"/g,'""')}"`).join(','));
  const csv  = [headers.join(','), ...rows].join('\n');
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

// ===== Print =====
function printPage() {
  window.print();
}
