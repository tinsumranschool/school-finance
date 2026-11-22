// ============================================================
// transactions.js — CRUD สมุดเงินสด
// ============================================================

let _dropdownOptions = null;
let _currentPage = 1;
let _editingRowIndex = null;
const debouncedLoad = debounce(() => loadTransactions(), 500);

// ===== โหลด dropdown options =====
async function loadDropdowns() {
  try {
    _dropdownOptions = await API.getDropdownOptions();
    if (_dropdownOptions.error) return;

    // ประเภทเงิน
    const mtSelect = document.getElementById('tx-moneytype');
    const filterMt = document.getElementById('filter-moneytype');
    _dropdownOptions.moneyTypes.forEach(t => {
      const opt = `<option value="${t.type}">${t.type}</option>`;
      if (mtSelect) mtSelect.innerHTML += opt;
      if (filterMt) filterMt.innerHTML += opt;
    });

    // บัญชีธนาคาร (เพิ่มหลัง 'เงินสด')
    const accSelect = document.getElementById('tx-account');
    if (accSelect && _dropdownOptions.banks) {
      _dropdownOptions.banks.forEach(b => {
        accSelect.innerHTML += `<option value="${b.id}">${b.bank} — ${b.name} (${b.accountNo})</option>`;
      });
    }

    // ผู้รับเงิน datalist
    const datalist = document.getElementById('vendor-datalist');
    if (datalist && _dropdownOptions.vendors) {
      _dropdownOptions.vendors.forEach(v => {
        datalist.innerHTML += `<option value="${v.name}">`;
      });
    }
  } catch(e) { console.error('loadDropdowns:', e); }
}

// ===== โหลดรายการ =====
async function loadTransactions() {
  renderSkeleton('tx-tbody', 8, 10);
  const filter = {
    startDate: document.getElementById('filter-start')?.value || '',
    endDate:   document.getElementById('filter-end')?.value   || '',
    moneyType: document.getElementById('filter-moneytype')?.value || '',
    status:    document.getElementById('filter-status')?.value    || '',
    search:    document.getElementById('filter-search')?.value    || '',
    page:      _currentPage,
    pageSize:  50,
  };
  try {
    const data = await API.getTransactions(filter);
    if (data.error) { showToast(data.error, 'error'); return; }
    renderTransactions(data.transactions, data);
    renderPagination('tx-pagination', data.page, data.pages, goToPage);
    updateSummary(data.transactions, data.total);
  } catch(e) {
    showToast('โหลดรายการไม่สำเร็จ: ' + e.message, 'error');
  }
}

function goToPage(page) {
  _currentPage = page;
  loadTransactions();
}

function clearFilters() {
  ['filter-start','filter-end','filter-moneytype','filter-status','filter-search'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = '';
  });
  _currentPage = 1;
  loadTransactions();
}

// ===== Render Table =====
function renderTransactions(txList, meta) {
  const tbody = document.getElementById('tx-tbody');
  if (!tbody) return;
  const user = getCurrentUser();
  const isAdmin = user?.role === 'admin';

  if (!txList || !txList.length) {
    tbody.innerHTML = `<tr><td colspan="10" style="text-align:center;padding:32px;color:var(--text-muted)">ไม่มีรายการ</td></tr>`;
    return;
  }

  tbody.innerHTML = txList.map(tx => {
    const statusClass = { 'ปกติ':'badge-success','รอตรวจ':'badge-warning','ขอเอกสารเพิ่ม':'badge-danger','ยกเลิก':'badge-muted' }[tx.status] || 'badge-info';
    const isIncome = ['รับเงินสด','รับเข้าบัญชี'].includes(tx.txType);
    const amtColor = isIncome ? 'var(--success)' : tx.status === 'ยกเลิก' ? 'var(--text-muted)' : 'var(--danger)';

    return `<tr>
      <td style="white-space:nowrap">${formatThaiDate(tx.date)}</td>
      <td><code style="font-size:0.8rem">${tx.docNo}</code></td>
      <td>${tx.moneyType}</td>
      <td>${tx.txType}</td>
      <td style="font-size:0.78rem">${tx.account}</td>
      <td style="max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${tx.description}">${tx.description}</td>
      <td style="color:${amtColor};font-weight:600;white-space:nowrap">${isIncome ? '+' : '−'}${formatMoney(tx.amount)}</td>
      <td><span class="badge badge-info" style="font-size:0.7rem">${tx.category}</span></td>
      <td><span class="badge ${statusClass}">${tx.status}</span></td>
      ${isAdmin ? `<td style="white-space:nowrap">
        <button class="btn btn-sm btn-secondary btn-icon" onclick="editTx(${JSON.stringify(tx).replace(/"/g,'&quot;')})" title="แก้ไข">✏️</button>
        <button class="btn btn-sm btn-danger btn-icon" onclick="deleteTx(${tx.rowIndex},'${tx.docNo}')" title="ลบ">🗑</button>
      </td>` : '<td></td>'}
    </tr>`;
  }).join('');
}

function updateSummary(txList, total) {
  const incomeTypes = ['รับเงินสด','รับเข้าบัญชี'];
  let incomeSum = 0, expenseSum = 0;
  (txList || []).forEach(tx => {
    if (tx.status === 'ยกเลิก') return;
    if (incomeTypes.includes(tx.txType)) incomeSum += tx.amount;
    else expenseSum += tx.amount;
  });
  const el = id => document.getElementById(id);
  if (el('tx-count'))       el('tx-count').textContent       = (total || 0).toLocaleString() + ' รายการ';
  if (el('tx-income-sum'))  el('tx-income-sum').textContent  = formatMoney(incomeSum);
  if (el('tx-expense-sum')) el('tx-expense-sum').textContent = formatMoney(expenseSum);
}

// ===== Modal Open/Close =====
function openAddModal() {
  _editingRowIndex = null;
  document.getElementById('tx-modal-title').textContent = 'เพิ่มรายการใหม่';
  document.getElementById('tx-row-index').value = '';
  clearTxForm();
  document.getElementById('tx-date').value = todayISO();
  openModal('tx-modal');
  suggestNextDocNo();
}

function editTx(tx) {
  _editingRowIndex = tx.rowIndex;
  document.getElementById('tx-modal-title').textContent = 'แก้ไขรายการ';
  document.getElementById('tx-row-index').value = tx.rowIndex;
  document.getElementById('tx-date').value        = tx.date;
  document.getElementById('tx-docno').value       = tx.docNo;
  document.getElementById('tx-moneytype').value   = tx.moneyType;
  document.getElementById('tx-category').value    = tx.category;
  document.getElementById('tx-txtype').value      = tx.txType;
  document.getElementById('tx-account').value     = tx.account;
  document.getElementById('tx-vendor').value      = tx.vendor;
  document.getElementById('tx-description').value = tx.description;
  document.getElementById('tx-amount').value      = tx.amount;
  document.getElementById('tx-status').value      = tx.status;
  clearFieldErrors();
  openModal('tx-modal');
}

function clearTxForm() {
  ['tx-date','tx-docno','tx-moneytype','tx-category','tx-txtype','tx-account','tx-vendor','tx-description','tx-amount'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = '';
  });
  document.getElementById('tx-status').value = 'ปกติ';
  clearFieldErrors();
}

function clearFieldErrors() {
  document.querySelectorAll('.field-error').forEach(e => { e.textContent = ''; e.classList.remove('show'); });
  document.querySelectorAll('input.error,select.error').forEach(e => e.classList.remove('error'));
  const wa = document.getElementById('warn-amount');
  if (wa) wa.style.display = 'none';
}

// ===== Auto-fill =====
function onMoneyTypeChange() {
  const mt  = document.getElementById('tx-moneytype').value;
  const opt = (_dropdownOptions?.moneyTypes || []).find(t => t.type === mt);
  document.getElementById('tx-category').value = opt ? opt.category : '';
}

function onTxTypeChange() {
  const txType  = document.getElementById('tx-txtype').value;
  const accSel  = document.getElementById('tx-account');
  const cashTypes = ['รับเงินสด','จ่ายเงินสด'];
  const bankTypes = ['รับเข้าบัญชี','จ่ายจากบัญชี','ฝากธนาคาร','ถอนธนาคาร'];
  if (cashTypes.includes(txType)) {
    accSel.value = 'เงินสด';
  } else if (bankTypes.includes(txType) && accSel.value === 'เงินสด') {
    accSel.value = '';
  }
}

function onAmountChange() {
  const amt       = Number(document.getElementById('tx-amount').value);
  const threshold = _dropdownOptions?.alertThreshold || 100000;
  const warnEl    = document.getElementById('warn-amount');
  if (warnEl) {
    if (amt > threshold) {
      warnEl.textContent = `⚠️ จำนวนเงินสูงกว่าเกณฑ์ (${threshold.toLocaleString()} บาท) กรุณาตรวจสอบ`;
      warnEl.style.display = 'block';
    } else { warnEl.style.display = 'none'; }
  }
}

let _docNoTimer = null;
function checkDocNoDuplicate() {
  clearTimeout(_docNoTimer);
  _docNoTimer = setTimeout(async () => {
    const docNo = document.getElementById('tx-docno').value.trim();
    if (!docNo) return;
    // Client-side ตรวจกับรายการที่โหลดมาแล้ว (server จะตรวจซ้ำตอน save)
  }, 600);
}

async function suggestNextDocNo() {
  // ดึง docNo ล่าสุดแล้วแนะนำถัดไป
  try {
    const data = await API.getTransactions({ page: 1, pageSize: 1 });
    if (data.transactions && data.transactions.length) {
      const last = data.transactions[0].docNo;
      const match = last.match(/(\D+)(\d+)$/);
      if (match) {
        const prefix = match[1];
        const num    = parseInt(match[2]) + 1;
        document.getElementById('tx-docno').value = prefix + String(num).padStart(match[2].length, '0');
      }
    }
  } catch(e) {}
}

// ===== Save =====
async function saveTx() {
  clearFieldErrors();
  const tx = {
    rowIndex:    _editingRowIndex || undefined,
    date:        document.getElementById('tx-date').value,
    docNo:       document.getElementById('tx-docno').value.trim(),
    moneyType:   document.getElementById('tx-moneytype').value,
    txType:      document.getElementById('tx-txtype').value,
    account:     document.getElementById('tx-account').value,
    vendor:      document.getElementById('tx-vendor').value,
    description: document.getElementById('tx-description').value.trim(),
    amount:      Number(document.getElementById('tx-amount').value),
    status:      document.getElementById('tx-status').value,
  };

  const btn = document.getElementById('btn-save-tx');
  btn.disabled = true; btn.textContent = 'กำลังบันทึก...';

  try {
    const res = _editingRowIndex
      ? await API.updateTransaction(tx)
      : await API.addTransaction(tx);

    if (!res.success && res.errors) {
      res.errors.forEach(err => {
        if (err.severity !== 'warning') {
          const errEl = document.getElementById('err-' + err.field);
          const inEl  = document.getElementById('tx-' + err.field);
          if (errEl) { errEl.textContent = err.msg; errEl.classList.add('show'); }
          if (inEl)  inEl.classList.add('error');
        }
      });
      const warnings = res.errors.filter(e => e.severity === 'warning');
      if (warnings.length && res.errors.every(e => e.severity === 'warning')) {
        // มีเฉพาะ warning → ถาม confirm
        const ok = await confirmDialog('ยืนยันการบันทึก',
          warnings.map(w => '⚠️ ' + w.msg).join('<br>') + '<br><br>ต้องการบันทึกต่อหรือไม่?',
          'บันทึกต่อ');
        if (!ok) return;
        // บันทึกซ้ำ (server จะไม่ block warning)
        const res2 = _editingRowIndex ? await API.updateTransaction({...tx, forceWarning: true}) : await API.addTransaction({...tx, forceWarning: true});
        if (res2.success) { closeModal('tx-modal'); loadTransactions(); showToast('บันทึกสำเร็จ', 'success'); }
      }
      return;
    }
    if (res.error) { showToast(res.error, 'error'); return; }
    closeModal('tx-modal');
    await loadTransactions();
    showToast(_editingRowIndex ? 'แก้ไขรายการสำเร็จ' : 'เพิ่มรายการสำเร็จ', 'success');
    loadSidebarStats();
  } catch(e) {
    showToast('เกิดข้อผิดพลาด: ' + e.message, 'error');
  } finally {
    btn.disabled = false; btn.textContent = '💾 บันทึก';
  }
}

// ===== Delete =====
async function deleteTx(rowIndex, docNo) {
  const ok = await confirmDialog('ยืนยันการยกเลิก', `ยืนยันการยกเลิกรายการ <strong>${docNo}</strong>?<br><small>รายการจะถูกเปลี่ยนสถานะเป็น "ยกเลิก"</small>`, 'ยกเลิกรายการ');
  if (!ok) return;
  try {
    const res = await API.deleteTransaction(rowIndex);
    if (res.success) { showToast('ยกเลิกรายการสำเร็จ', 'success'); loadTransactions(); }
    else showToast(res.error || 'เกิดข้อผิดพลาด', 'error');
  } catch(e) { showToast(e.message, 'error'); }
}

// ===== Export CSV =====
async function exportTxCSV() {
  showLoading(true, 'กำลังดาวน์โหลด...');
  try {
    const filter = {
      startDate: document.getElementById('filter-start')?.value || '',
      endDate:   document.getElementById('filter-end')?.value   || '',
      moneyType: document.getElementById('filter-moneytype')?.value || '',
      status:    document.getElementById('filter-status')?.value    || '',
      search:    document.getElementById('filter-search')?.value    || '',
      pageSize:  9999,
    };
    const data = await API.getTransactions(filter);
    exportCSV(data.transactions, `สมุดเงินสด_${todayISO()}.csv`);
  } catch(e) { showToast(e.message, 'error'); }
  finally { showLoading(false); }
}

// ============================================================
// Import CSV / Bulk Upload
// ============================================================

function openImportModal() {
  const modal = document.getElementById('import-modal');
  if (modal) { document.getElementById('import-file').value = ''; document.getElementById('import-preview').innerHTML = ''; openModal('import-modal'); }
}

async function handleImportFile(e) {
  const file = e.target.files[0];
  if (!file) return;
  const text = await file.text();
  const rows  = parseCSV(text);
  if (!rows.length) { showToast('ไฟล์ไม่มีข้อมูล','warning'); return; }
  renderImportPreview(rows);
}

function parseCSV(text) {
  const lines = text.trim().split('\n').filter(l => l.trim());
  if (lines.length < 2) return [];
  const headers = lines[0].split(',').map(h => h.replace(/^"|"$/g,'').trim());
  return lines.slice(1).map(line => {
    // handle quoted values
    const vals = [];
    let inQ = false, cur = '';
    for (const ch of line) {
      if (ch === '"') { inQ = !inQ; }
      else if (ch === ',' && !inQ) { vals.push(cur.trim()); cur = ''; }
      else cur += ch;
    }
    vals.push(cur.trim());
    const obj = {};
    headers.forEach((h, i) => { obj[h] = vals[i] || ''; });
    return obj;
  });
}

function renderImportPreview(rows) {
  const container = document.getElementById('import-preview');
  const mapped = rows.map(mapCSVRow);
  const colMap = { date:'วันที่', docNo:'เลขที่เอกสาร', moneyType:'ประเภทเงิน', txType:'ประเภทรายการ', account:'บัญชี/ช่องทาง', vendor:'คู่สัญญา', description:'รายละเอียด', amount:'จำนวนเงิน', status:'สถานะ' };
  container.innerHTML = `
    <div style="font-size:.82rem;color:var(--text-muted);margin-bottom:8px">พบ ${rows.length} รายการ — ตรวจสอบก่อนนำเข้า</div>
    <div class="table-wrapper"><table>
      <thead><tr>${Object.values(colMap).map(h=>`<th>${h}</th>`).join('')}</tr></thead>
      <tbody>${mapped.map(r => `<tr>${Object.keys(colMap).map(k=>`<td style="font-size:.78rem">${r[k]||''}</td>`).join('')}</tr>`).join('')}</tbody>
    </table></div>`;
  document.getElementById('import-preview').dataset.rows = JSON.stringify(mapped);
  document.getElementById('btn-confirm-import').disabled = false;
}

function mapCSVRow(row) {
  // รองรับทั้ง header ภาษาไทยและ English
  return {
    date:        row['วันที่']          || row['date']        || '',
    docNo:       row['เลขที่เอกสาร']   || row['docNo']       || '',
    moneyType:   row['ประเภทเงิน']     || row['moneyType']   || '',
    txType:      row['ประเภทรายการ']   || row['txType']      || '',
    account:     row['บัญชี/ช่องทาง'] || row['account']     || '',
    vendor:      row['คู่สัญญา']       || row['vendor']      || '',
    description: row['รายละเอียด']     || row['description'] || '',
    amount:      Number(row['จำนวนเงิน'] || row['amount'] || 0),
    status:      row['สถานะ']          || row['status']      || 'ปกติ',
  };
}

async function confirmImport() {
  const previewEl = document.getElementById('import-preview');
  const rows = JSON.parse(previewEl.dataset.rows || '[]');
  if (!rows.length) return;

  const btn = document.getElementById('btn-confirm-import');
  btn.disabled = true; btn.textContent = '⏳ กำลังนำเข้า...';
  showLoading(true, `กำลังนำเข้า ${rows.length} รายการ...`);

  try {
    const res = await apiCall('importTransactions', { rows });
    if (res.success) {
      let msg = `นำเข้าสำเร็จ ${res.imported} รายการ`;
      if (res.errorCount) msg += ` | มี ${res.errorCount} รายการที่มีข้อผิดพลาด`;
      showToast(msg, res.errorCount ? 'warning' : 'success', 5000);
      if (res.errors && res.errors.length) {
        const errMsg = res.errors.slice(0,3).map(e=>`แถว ${e.row} (${e.docNo}): ${e.errors.join(', ')}`).join('\n');
        console.warn('Import errors:\n' + errMsg);
      }
      closeModal('import-modal');
      loadTransactions();
    } else {
      showToast(res.error || 'เกิดข้อผิดพลาด','error');
    }
  } catch(e) {
    showToast(e.message,'error');
  } finally {
    showLoading(false);
    btn.disabled = false; btn.textContent = '📥 นำเข้าข้อมูล';
  }
}

// Template CSV สำหรับ download
function downloadTemplate() {
  const headers = 'วันที่,เลขที่เอกสาร,ประเภทเงิน,ประเภทรายการ,บัญชี/ช่องทาง,คู่สัญญา,รายละเอียด,จำนวนเงิน,สถานะ';
  const example = '2024-10-01,RB001,เงินอุดหนุน,รับเข้าบัญชี,BNK001,สพฐ.,เงินอุดหนุนภาคเรียนที่ 1/2568,150000,ปกติ';
  const csv     = headers + '\n' + example;
  const blob    = new Blob(['\uFEFF' + csv], { type:'text/csv;charset=utf-8;' });
  const url     = URL.createObjectURL(blob);
  const a       = document.createElement('a');
  a.href = url; a.download = 'template-import.csv'; a.click();
  URL.revokeObjectURL(url);
}
