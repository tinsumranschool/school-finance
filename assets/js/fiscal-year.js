// ============================================================
// fiscal-year.js — Checklist + Dual Approval logic
// ============================================================

const CHECKS_META = [
  { code: 'PENDING_DOCS',      label: 'ไม่มีรายการรอตรวจ / ขอเอกสารเพิ่ม' },
  { code: 'NEGATIVE_CASH',     label: 'เงินสดคงเหลือไม่ติดลบ' },
  { code: 'NEGATIVE_CAT',      label: 'ทุกหมวดเงินคงเหลือไม่ติดลบ' },
  { code: 'RECON_FAIL',        label: 'กระทบยอดธนาคารตรงกับ Statement' },
  { code: 'CONFIG_INCOMPLETE', label: 'ตั้งค่าระบบครบถ้วน' },
  { code: 'ZERO_AMOUNT',       label: 'ไม่มีรายการจำนวนเงิน <= 0' },
  { code: 'BALANCE_DIFF',      label: 'ยอดรวม 3 หมวด = เงินสด + ธนาคาร' },
];

let _checkResult = null;
let _pendingRequest = null;
const user = () => getCurrentUser();

async function loadFiscalYearPage() {
  // แสดงปีงบ
  const fyEl = document.getElementById('fy-year-display');
  if (fyEl) fyEl.textContent = window.AppConfig.currentFiscalYear || '';

  // ตรวจว่ามี pending request อยู่ไหม
  await checkPendingRequest();
  // รัน checklist
  await runChecklist();
}

// ===== ตรวจ Pending Request =====
async function checkPendingRequest() {
  try {
    const res = await API.getPendingCloseRequest();
    _pendingRequest = res.request || null;

    const dirBox   = document.getElementById('director-request-box');
    const blockBan = document.getElementById('block-banner');
    const pendMsg  = document.getElementById('admin-pending-msg');

    if (_pendingRequest) {
      // มี pending → แสดง block banner
      if (blockBan) blockBan.style.display = 'flex';

      // Director เห็น approve box
      if (dirBox && user()?.role === 'director') {
        dirBox.style.display = 'block';
        const infoEl = document.getElementById('dir-request-info');
        if (infoEl) infoEl.textContent = `ส่งโดย ${_pendingRequest.adminEmail} เมื่อ ${formatThaiDateTime(_pendingRequest.createdAt)}`;
      }

      // Admin เห็นข้อความ รอ Director
      if (pendMsg && user()?.role === 'admin') {
        pendMsg.style.display = 'block';
        // ซ่อนปุ่ม Admin confirm
        const btnAdmin = document.getElementById('btn-admin-confirm');
        if (btnAdmin) btnAdmin.style.display = 'none';
      }

      // step2 = waiting
      setStepState(2, 'waiting', '⏳ รอผู้อำนวยการอนุมัติ');
    } else {
      if (blockBan) blockBan.style.display = 'none';
      if (dirBox)   dirBox.style.display   = 'none';
      if (pendMsg)  pendMsg.style.display   = 'none';
    }
  } catch(e) { console.error('checkPendingRequest:', e); }
}

// ===== Checklist =====
async function runChecklist() {
  const container = document.getElementById('checklist-container');
  const btn       = document.getElementById('btn-refresh-check');
  if (btn) { btn.disabled = true; btn.textContent = '⏳ กำลังตรวจสอบ...'; }

  if (container) {
    container.innerHTML = CHECKS_META.map(c =>
      `<div class="check-item" id="check-${c.code}" style="opacity:.5">
        <span class="check-icon">⏳</span>
        <span class="check-label">${c.label}</span>
        <span class="check-detail"></span>
        <span></span>
      </div>`
    ).join('');
  }

  try {
    _checkResult = await API.checkCloseReady();
    renderChecklist(_checkResult);
    updateStepStates(_checkResult);
  } catch(e) {
    showToast('ตรวจสอบไม่สำเร็จ: ' + e.message, 'error');
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = '🔄 ตรวจสอบอีกครั้ง'; }
  }
}

function renderChecklist(result) {
  const container = document.getElementById('checklist-container');
  if (!container) return;
  const failedCodes = (result.issues || []).map(i => i.code);

  container.innerHTML = CHECKS_META.map(c => {
    const failed = failedCodes.includes(c.code);
    const issue  = result.issues?.find(i => i.code === c.code);
    const cls    = failed ? 'failed' : 'passed';
    const icon   = failed ? '❌' : '✅';
    const fixMap = {
      PENDING_DOCS:      'transactions.html?status=รอตรวจ',
      NEGATIVE_CASH:     'transactions.html',
      NEGATIVE_CAT:      'reports.html',
      RECON_FAIL:        'reports.html#recon',
      CONFIG_INCOMPLETE: 'settings.html',
      ZERO_AMOUNT:       'transactions.html?amount=zero',
      BALANCE_DIFF:      'reports.html#balance',
    };
    return `<div class="check-item ${cls}" id="check-${c.code}">
      <span class="check-icon">${icon}</span>
      <span class="check-label">${c.label}</span>
      <span class="check-detail">${failed && issue ? issue.msg : ''}</span>
      ${failed ? `<a class="check-fix-link" href="${fixMap[c.code]||'#'}">แก้ไข →</a>` : '<span></span>'}
    </div>`;
  }).join('');

  // All pass banner
  const bannerPass  = document.getElementById('all-pass-banner');
  if (bannerPass) bannerPass.style.display = result.ready ? 'block' : 'none';
}

function updateStepStates(result) {
  // Step 1 — Checklist
  setStepState(1, result.ready ? 'done' : 'pending', result.ready ? '✅ ผ่านทุกเงื่อนไข' : `❌ ยังไม่ผ่าน ${result.issues?.length} เงื่อนไข`);

  // Step 2 — Admin Confirm (เปิดได้ถ้า ready และไม่มี pending request)
  const btnAdmin = document.getElementById('btn-admin-confirm');
  const canAdmin = result.ready && !_pendingRequest && user()?.role === 'admin';
  if (btnAdmin) { btnAdmin.disabled = !canAdmin; }
  if (!_pendingRequest) {
    setStepState(2, result.ready ? 'pending' : 'locked', result.ready ? '🔓 พร้อมสำหรับ Admin ยืนยัน' : '🔒 รอให้ผ่านทุกเงื่อนไขก่อน');
  }

  // Step 3 — Director (locked จนกว่า Admin จะกด)
  if (!_pendingRequest) {
    setStepState(3, 'locked', '🔒 รอ Admin ยืนยันก่อน');
  } else {
    setStepState(3, 'waiting', '⏳ รอ ผอ. อนุมัติ');
    // Director เปิดปุ่ม approve
    const btnDir = document.getElementById('btn-director-approve');
    if (btnDir && user()?.role === 'director') btnDir.disabled = !result.ready;
  }
}

function setStepState(stepNum, state, statusText) {
  const numEl = document.getElementById(`step${stepNum}-num`);
  const statEl = document.getElementById(`step${stepNum}-status`);
  if (numEl) {
    numEl.className = 'fy-step-num ' + state;
    const icons = { done:'✅', pending:'⚡', waiting:'⏳', locked:'🔒' };
    numEl.textContent = icons[state] || stepNum;
  }
  if (statEl) { statEl.textContent = statusText || ''; statEl.style.color = state === 'done' ? 'var(--success)' : state === 'waiting' ? 'var(--warning)' : 'var(--text-muted)'; }
}

// ===== Admin Confirm =====
async function adminConfirm() {
  if (!_checkResult?.ready) { showToast('กรุณาผ่านทุกเงื่อนไขก่อน', 'warning'); return; }

  const ok = await confirmDialog(
    '✅ Admin ยืนยันการปิดปีงบประมาณ',
    `คุณกำลังจะส่ง Request ปิดปีงบประมาณ <strong>${window.AppConfig.currentFiscalYear}</strong> ไปให้ ผู้อำนวยการอนุมัติ<br><br>ระบบจะ Archive ข้อมูลทั้งหมดและสร้าง Sheet ปีงบใหม่โดยอัตโนมัติ`,
    'ส่ง Request ให้ ผอ. อนุมัติ'
  );
  if (!ok) return;

  const btn = document.getElementById('btn-admin-confirm');
  btn.disabled = true; btn.textContent = '⏳ กำลังส่ง...';
  try {
    const res = await API.createCloseRequest();
    if (res.success) {
      showToast('ส่ง Request ให้ ผอ. แล้ว กรุณารอการอนุมัติ', 'success');
      setStepState(2, 'done', '✅ Admin ยืนยันแล้ว — รอ ผอ. อนุมัติ');
      setStepState(3, 'waiting', '⏳ รอ ผอ. อนุมัติ');
      document.getElementById('admin-pending-msg').style.display = 'block';
      btn.style.display = 'none';
      document.getElementById('block-banner').style.display = 'flex';
      _pendingRequest = { requestId: res.requestId };
    } else if (res.issues) {
      showToast('ข้อมูลยังไม่ครบ: ' + res.issues[0]?.msg, 'error');
    } else {
      showToast(res.error || 'เกิดข้อผิดพลาด', 'error');
    }
  } catch(e) { showToast(e.message, 'error'); }
  finally { btn.disabled = false; btn.textContent = '✅ Admin ยืนยันพร้อมปิดงบ'; }
}

// ===== Director Approve =====
async function directorApprove() {
  const ok = await confirmDialog(
    '🔐 ผู้อำนวยการอนุมัติปิดปีงบประมาณ',
    `ท่านกำลังอนุมัติปิดปีงบประมาณ <strong>${window.AppConfig.currentFiscalYear}</strong><br><br>
    <strong>ระบบจะดำเนินการ:</strong><br>
    📁 Archive Sheet ปัจจุบันไปยัง Google Drive<br>
    📊 สร้าง Sheet ปีงบใหม่โดยอัตโนมัติ<br>
    🔗 Frontend เชื่อมกับ Sheet ใหม่ทันที<br><br>
    <span style="color:var(--danger)">⚠️ การดำเนินการนี้ไม่สามารถย้อนกลับได้</span>`,
    'อนุมัติปิดปีงบประมาณ'
  );
  if (!ok) return;

  // แสดง lock overlay
  document.getElementById('lock-overlay').style.display = 'flex';

  try {
    const requestId = _pendingRequest?.requestId;
    const res = await API.directorApprove(requestId);

    document.getElementById('lock-overlay').style.display = 'none';

    if (res.success) {
      // แสดง success
      const successBox = document.getElementById('archive-success');
      successBox.style.display = 'block';
      document.getElementById('archive-success-msg').textContent =
        `ปีงบ ${res.oldFiscalYear} ถูก Archive แล้ว — ปีงบ ${res.newFiscalYear} พร้อมใช้งาน`;
      const archLink    = document.getElementById('archive-link');
      const newSheetLink = document.getElementById('new-sheet-link');
      if (archLink && res.archiveId)    archLink.href    = `https://docs.google.com/spreadsheets/d/${res.archiveId}`;
      if (newSheetLink && res.newSheetUrl) newSheetLink.href = res.newSheetUrl;

      // รีเซ็ต config cache
      resetConfigCache();
      showToast('🎉 ปิดปีงบประมาณสำเร็จ!', 'success', 6000);
    } else if (res.issues) {
      showToast('ไม่สามารถปิดงบได้: ' + res.issues[0]?.msg, 'error');
      runChecklist();
    } else {
      showToast(res.error || 'เกิดข้อผิดพลาด', 'error');
    }
  } catch(e) {
    document.getElementById('lock-overlay').style.display = 'none';
    showToast('เกิดข้อผิดพลาด: ' + e.message, 'error');
  }
}
