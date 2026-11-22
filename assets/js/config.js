// ============================================================
// config.js — โรงเรียนบ้านถิ่นสำราญ | ปีงบประมาณ 2569
// ============================================================

const SYSTEM_CONFIG_FILE_ID = '12lL_8pnlRo7iD9qhxsqisV4BsMCGPbMI';
const SYSTEM_CONFIG_URL = `https://drive.google.com/uc?export=download&id=${SYSTEM_CONFIG_FILE_ID}`;

const GOOGLE_CLIENT_ID = '896724932741-rf7udn0flhj0un5roht9ra3p8gdvqurv.apps.googleusercontent.com';

const FALLBACK_GAS_URL = 'https://script.google.com/macros/s/AKfycby2ya1pNEt5WCqUPtd7d81g7ghy-Jc-T9VVEx28FZSWPavf0qtj1Iy7159L8Oh6JbmDpw/exec';

window.AppConfig = {
  gasUrl:            FALLBACK_GAS_URL,
  currentSheetId:    '14L7bOGl22C1OPktXf4EPtF5UToOY1bTyxtUEAQIe76A',
  currentFiscalYear: 2569,
  schoolName:        'บ้านถิ่นสำราญ',
  loaded:            false,
};

async function loadSystemConfig() {
  const cached = sessionStorage.getItem('system_config');
  if (cached) {
    try {
      const cfg = JSON.parse(cached);
      Object.assign(window.AppConfig, cfg, { loaded: true });
      return window.AppConfig;
    } catch(e) {}
  }
  try {
    const res = await fetch(SYSTEM_CONFIG_URL, { cache: 'no-cache' });
    if (!res.ok) throw new Error('config fetch failed: ' + res.status);
    const cfg = await res.json();
    Object.assign(window.AppConfig, cfg, { loaded: true });
    sessionStorage.setItem('system_config', JSON.stringify(cfg));
    return window.AppConfig;
  } catch(err) {
    console.warn('loadSystemConfig fallback:', err.message);
    window.AppConfig.loaded = true;
    return window.AppConfig;
  }
}

function resetConfigCache() {
  sessionStorage.removeItem('system_config');
  window.AppConfig.loaded = false;
}
