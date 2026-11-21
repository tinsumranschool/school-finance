// ============================================================
// dashboard.js — Dashboard logic, Charts, Money Flow SVG
// ============================================================

let monthlyChart = null;
let pieChart     = null;

async function loadDashboard() {
  showLoading(true, 'กำลังโหลด Dashboard...');
  try {
    const data = await API.getDashboard();
    if (data.error) { showToast(data.error, 'error'); return; }
    renderKPIs(data.kpi);
    renderMoneyFlow(data.moneyFlow, data.kpi);
    renderMonthlyChart(data.monthlyData);
    renderPieChart(data.moneyFlow);
    renderBankStatus(data.bankStatus);
    renderAlerts(data.alerts);
    renderCategories(data.categories);
    // ชื่อโรงเรียน
    if (data.config?.schoolName) {
      const el = document.getElementById('school-name-topbar');
      if (el) el.textContent = data.config.schoolName;
    }
    if (data.config?.fiscalYear) {
      const el = document.getElementById('fiscal-year-display');
      if (el) el.textContent = data.config.fiscalYear;
    }
    const updEl = document.getElementById('last-updated');
    if (updEl) updEl.textContent = 'อัปเดต ' + formatThaiDateTime(data.generatedAt);
  } catch(err) {
    showToast('โหลด Dashboard ไม่สำเร็จ: ' + err.message, 'error');
  } finally {
    showLoading(false);
  }
}

// ===== KPI Cards =====
function renderKPIs(kpi) {
  const set = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = formatMoney(val); };
  set('kpi-income',  kpi.totalIncome);
  set('kpi-expense', kpi.totalExpense);
  set('kpi-cash',    kpi.cashBalance);
  set('kpi-bank',    kpi.bankTotal);

  // Cash balance สีแดงถ้าติดลบ
  const cashEl = document.getElementById('kpi-cash');
  if (cashEl) cashEl.style.color = kpi.cashBalance < 0 ? 'var(--danger)' : 'var(--navy)';

  // sidebar cash
  const sideEl = document.getElementById('sidebar-cash-balance');
  if (sideEl) {
    sideEl.textContent = formatMoneyShort(kpi.cashBalance);
    sideEl.classList.toggle('negative', kpi.cashBalance < 0);
  }
}

// ===== Money Flow SVG =====
function renderMoneyFlow(flow, kpi) {
  const svg = document.getElementById('money-flow-svg');
  if (!svg || !flow) return;
  svg.innerHTML = '';

  const sources = flow.sources || [];
  const uses    = flow.uses    || [];
  const W = 600, H = 220;
  const centerX = W / 2;

  // ===== Source nodes (ซ้าย) =====
  const srcColors = ['#2980b9', '#c9a227', '#8e44ad'];
  const srcY = sources.map((_, i) => 40 + i * 65);

  sources.forEach((s, i) => {
    const x = 20, y = srcY[i], w = 140, h = 50;
    const color = srcColors[i % srcColors.length];
    svg.innerHTML += `
      <rect x="${x}" y="${y}" width="${w}" height="${h}" rx="8" fill="${color}" opacity="0.9"/>
      <text x="${x+10}" y="${y+18}" class="flow-label" fill="#fff" font-size="11" font-weight="600">${s.name}</text>
      <text x="${x+10}" y="${y+34}" class="flow-amount" fill="rgba(255,255,255,0.85)" font-size="10">฿${(s.amount||0).toLocaleString('th-TH')}</text>
      <text x="${x+10}" y="${y+46}" class="flow-amount" fill="rgba(255,255,255,0.7)" font-size="10">${s.pct}%</text>`;
  });

  // ===== Center node =====
  const cx = centerX - 55, cy = H / 2 - 35;
  svg.innerHTML += `
    <rect x="${cx}" y="${cy}" width="110" height="70" rx="10" fill="#1e3a5f"/>
    <text x="${cx+55}" y="${cy+22}" class="flow-label" fill="#fff" font-size="11" font-weight="700" text-anchor="middle">โรงเรียน</text>
    <text x="${cx+55}" y="${cy+36}" class="flow-amount" fill="#c9a227" font-size="10" font-weight="700" text-anchor="middle">฿${formatMoneyShort(kpi?.totalIncome||0)}</text>
    <text x="${cx+55}" y="${cy+50}" class="flow-amount" fill="rgba(255,255,255,0.65)" font-size="9" text-anchor="middle">รวมทั้งสิ้น</text>`;

  // ===== Use nodes (ขวา) =====
  const useColors = ['#27ae60', '#e67e22', '#7f8c8d'];
  const useY = uses.map((_, i) => 25 + i * 60);

  uses.forEach((u, i) => {
    const x = W - 160, y = useY[i], w = 140, h = 50;
    const color = useColors[i % useColors.length];
    svg.innerHTML += `
      <rect x="${x}" y="${y}" width="${w}" height="${h}" rx="8" fill="${color}" opacity="0.9"/>
      <text x="${x+10}" y="${y+18}" class="flow-label" fill="#fff" font-size="11" font-weight="600">${u.name}</text>
      <text x="${x+10}" y="${y+34}" class="flow-amount" fill="rgba(255,255,255,0.85)" font-size="10">฿${(u.amount||0).toLocaleString('th-TH')}</text>
      <text x="${x+10}" y="${y+46}" class="flow-amount" fill="rgba(255,255,255,0.7)" font-size="10">${u.pct}%</text>`;
  });

  // ===== Bezier Paths =====
  // source → center
  sources.forEach((s, i) => {
    const x1 = 160, y1 = srcY[i] + 25;
    const x2 = cx, y2 = cy + 35;
    const thickness = Math.max(3, Math.round((s.pct / 100) * 18));
    const ctrl1X = (x1 + x2) / 2, ctrl2X = (x1 + x2) / 2;
    svg.innerHTML += `<path d="M${x1},${y1} C${ctrl1X},${y1} ${ctrl2X},${y2} ${x2},${y2}" fill="none" stroke="${srcColors[i%srcColors.length]}" stroke-width="${thickness}" opacity="0.35"/>`;
  });

  // center → uses
  uses.forEach((u, i) => {
    const x1 = cx + 110, y1 = cy + 35;
    const x2 = W - 160,  y2 = useY[i] + 25;
    const thickness = Math.max(3, Math.round((u.pct / 100) * 18));
    const ctrl1X = (x1 + x2) / 2, ctrl2X = (x1 + x2) / 2;
    svg.innerHTML += `<path d="M${x1},${y1} C${ctrl1X},${y1} ${ctrl2X},${y2} ${x2},${y2}" fill="none" stroke="${useColors[i%useColors.length]}" stroke-width="${thickness}" opacity="0.35"/>`;
  });
}

// ===== Monthly Bar Chart =====
function renderMonthlyChart(monthlyData) {
  const ctx = document.getElementById('monthly-chart');
  if (!ctx) return;
  if (monthlyChart) { monthlyChart.destroy(); monthlyChart = null; }

  const labels  = (monthlyData || []).map(m => m.monthLabel);
  const incomes  = (monthlyData || []).map(m => m.income);
  const expenses = (monthlyData || []).map(m => m.expense);

  // ถ้าไม่มีข้อมูลจาก GAS ใช้ placeholder
  const finalLabels  = labels.length  ? labels  : ['ต.ค.','พ.ย.','ธ.ค.','ม.ค.','ก.พ.','มี.ค.'];
  const finalIncome  = incomes.length ? incomes : [0,0,0,0,0,0];
  const finalExpense = expenses.length? expenses: [0,0,0,0,0,0];

  monthlyChart = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: finalLabels,
      datasets: [
        { label: 'รายรับ', data: finalIncome,  backgroundColor: '#2980b9', borderRadius: 5 },
        { label: 'รายจ่าย', data: finalExpense, backgroundColor: '#e67e22', borderRadius: 5 },
      ]
    },
    options: {
      responsive: true, maintainAspectRatio: true,
      plugins: { legend: { position: 'top', labels: { font: { family: 'Sarabun', size: 11 } } } },
      scales: {
        y: { ticks: {
          callback: v => '฿' + v.toLocaleString('th-TH'),
          font: { family: 'Sarabun', size: 10 }
        }, grid: { color: '#f0f4f8' } },
        x: { ticks: { font: { family: 'Sarabun', size: 11 } }, grid: { display: false } }
      }
    }
  });
}

// ===== Pie Chart =====
function renderPieChart(flow) {
  const ctx = document.getElementById('pie-chart');
  if (!ctx) return;
  if (pieChart) { pieChart.destroy(); pieChart = null; }

  const uses = flow?.uses || [
    { name: 'เงินเดือน/ค่าจ้าง', pct: 40 },
    { name: 'วัสดุ/ครุภัณฑ์',    pct: 35 },
    { name: 'อื่นๆ',             pct: 25 },
  ];
  const colors = ['#27ae60','#e67e22','#7f8c8d'];

  pieChart = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: uses.map(u => u.name),
      datasets: [{ data: uses.map(u => u.pct), backgroundColor: colors, borderWidth: 2, borderColor: '#fff' }]
    },
    options: {
      cutout: '65%', responsive: false,
      plugins: {
        legend: { display: false },
        tooltip: { callbacks: { label: ctx => `${ctx.label}: ${ctx.parsed}%` } }
      }
    }
  });

  // Legend
  const legend = document.getElementById('pie-legend');
  if (legend) {
    legend.innerHTML = uses.map((u, i) =>
      `<div><span style="display:inline-block;width:10px;height:10px;border-radius:2px;background:${colors[i]};margin-right:6px"></span>${u.name} <strong>${u.pct}%</strong></div>`
    ).join('');
  }
}

// ===== Bank Status Table =====
function renderBankStatus(bankStatus) {
  const tbody = document.getElementById('bank-status-tbody');
  if (!tbody) return;
  if (!bankStatus || !bankStatus.length) {
    tbody.innerHTML = '<tr><td colspan="3" style="text-align:center;color:var(--text-muted)">ไม่มีข้อมูล</td></tr>';
    return;
  }
  tbody.innerHTML = bankStatus.map(b => {
    const cls  = b.reconStatus === 'ตรงกัน' ? 'status-ok' : b.reconStatus === 'ยังไม่กระทบ' ? 'status-warn' : 'status-fail';
    const icon = b.reconStatus === 'ตรงกัน' ? '✅' : b.reconStatus === 'ยังไม่กระทบ' ? '⏳' : '❌';
    return `<tr>
      <td><strong>${b.bank}</strong><br><small style="color:var(--text-muted)">${b.name}</small></td>
      <td>${formatMoney(b.balance)}</td>
      <td class="${cls}">${icon} ${b.reconStatus}</td>
    </tr>`;
  }).join('');
}

// ===== Alerts =====
function renderAlerts(alerts) {
  const container = document.getElementById('alerts-container');
  const countBadge = document.getElementById('alert-count');
  if (!container) return;

  const errors = (alerts || []).filter(a => a.status === 'error');
  if (countBadge) {
    countBadge.textContent  = errors.length;
    countBadge.style.display = errors.length ? '' : 'none';
  }

  if (!alerts || !alerts.length) {
    container.innerHTML = '<div class="alert-item alert-ok"><span class="alert-icon">✅</span><span class="alert-msg">ไม่มีรายการแจ้งเตือน</span></div>';
    return;
  }

  container.innerHTML = alerts.map(a => {
    const cls  = a.status === 'error' ? 'alert-error' : a.status === 'warning' ? 'alert-warn' : 'alert-ok';
    const icon = a.status === 'error' ? '🔴' : a.status === 'warning' ? '🟡' : '✅';
    return `<div class="alert-item ${cls}">
      <span class="alert-icon">${icon}</span>
      <div style="flex:1"><div class="alert-msg">${a.message}</div>${a.count ? `<div class="alert-detail">${a.count} รายการ</div>` : ''}</div>
      ${a.fix ? `<a class="alert-fix" href="${a.fix}">แก้ไข</a>` : ''}
    </div>`;
  }).join('');
}

// ===== Categories Table =====
function renderCategories(categories) {
  const tbody = document.getElementById('categories-tbody');
  if (!tbody) return;
  if (!categories || !categories.length) {
    tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;color:var(--text-muted)">ไม่มีข้อมูล</td></tr>';
    return;
  }
  const total = { opening: 0, income: 0, expense: 0, balance: 0 };
  tbody.innerHTML = categories.map(c => {
    total.opening += c.opening || 0;
    total.income  += c.income  || 0;
    total.expense += c.expense || 0;
    total.balance += c.balance || 0;
    const neg = c.balance < 0;
    return `<tr>
      <td><strong>${c.name}</strong></td>
      <td>${formatMoney(c.opening)}</td>
      <td style="color:var(--success)">${formatMoney(c.income)}</td>
      <td style="color:var(--danger)">${formatMoney(c.expense)}</td>
      <td style="color:${neg ? 'var(--danger)' : 'var(--navy)'};font-weight:700">${formatMoney(c.balance)}</td>
    </tr>`;
  }).join('') +
  `<tr style="background:#f7faff;font-weight:700">
    <td>รวมทั้งสิ้น</td>
    <td>${formatMoney(total.opening)}</td>
    <td style="color:var(--success)">${formatMoney(total.income)}</td>
    <td style="color:var(--danger)">${formatMoney(total.expense)}</td>
    <td style="color:${total.balance<0?'var(--danger)':'var(--navy)'}">${formatMoney(total.balance)}</td>
  </tr>`;
}
