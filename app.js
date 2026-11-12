/* ==========================================================================
   DompetKu PWA — Core Application Logic (Offline-First + Google Sheets + Groq AI)
   ========================================================================== */

'use strict';

const STORAGE_KEY = 'dompetku_pwa_state_v2';
const SECURITY_KEY = 'dompetku_pwa_security_v2';

// Embedded GAS template so user can copy directly from Settings
const GAS_TEMPLATE_CODE = `// Tempel kode lengkap dari file google-apps-script/Code.gs di repositori GitHub Anda.
// Lihat README.md untuk panduan deployment Web App Google Apps Script.`;

function uid(prefix = 'id') {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
}

function todayISO() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function currentMonthISO() {
  return todayISO().slice(0, 7);
}

function formatRupiah(num) {
  const val = Number(num || 0);
  const abs = Math.abs(val);
  const formatted = new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(abs);
  return val < 0 ? `-${formatted}` : formatted;
}

function formatDateID(isoDate) {
  if (!isoDate) return '-';
  const parts = String(isoDate).split('-');
  if (parts.length !== 3) return isoDate;
  return `${parts[2]}-${parts[1]}-${parts[0]}`;
}

function escapeHTML(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function getDefaultState() {
  const now = new Date().toISOString();
  const today = todayISO();
  const month = currentMonthISO();

  const accounts = [
    { id: 'acc_tunai', nama: 'Tunai', tipe: 'Tunai', saldoAwal: 500000, warna: '#059669', ikon: '💵', arsip: false, updatedAt: now, deleted: false },
    { id: 'acc_bca', nama: 'Bank BCA', tipe: 'Bank', saldoAwal: 3500000, warna: '#2563eb', ikon: '🏦', arsip: false, updatedAt: now, deleted: false },
    { id: 'acc_gopay', nama: 'GoPay', tipe: 'E-Wallet', saldoAwal: 350000, warna: '#0d9488', ikon: '📱', arsip: false, updatedAt: now, deleted: false },
    { id: 'acc_dana', nama: 'DANA', tipe: 'E-Wallet', saldoAwal: 250000, warna: '#0284c7', ikon: '💙', arsip: false, updatedAt: now, deleted: false }
  ];

  const categories = [
    { id: 'cat_makan', nama: 'Makanan & Minuman', jenis: 'expense', warna: '#ea580c', ikon: '🍜', arsip: false, updatedAt: now, deleted: false },
    { id: 'cat_transport', nama: 'Transportasi', jenis: 'expense', warna: '#0284c7', ikon: '🛵', arsip: false, updatedAt: now, deleted: false },
    { id: 'cat_belanja', nama: 'Belanja', jenis: 'expense', warna: '#db2777', ikon: '🛍️', arsip: false, updatedAt: now, deleted: false },
    { id: 'cat_tagihan', nama: 'Tagihan & Utilitas', jenis: 'expense', warna: '#d97706', ikon: '⚡', arsip: false, updatedAt: now, deleted: false },
    { id: 'cat_hiburan', nama: 'Hiburan', jenis: 'expense', warna: '#7c3aed', ikon: '🎬', arsip: false, updatedAt: now, deleted: false },
    { id: 'cat_piutang_out', nama: 'Piutang / Pinjaman Keluar', jenis: 'expense', warna: '#0f766e', ikon: '🤝', arsip: false, updatedAt: now, deleted: false },
    { id: 'cat_lain_exp', nama: 'Pengeluaran Lain', jenis: 'expense', warna: '#64748b', ikon: '📦', arsip: false, updatedAt: now, deleted: false },
    { id: 'cat_gaji', nama: 'Gaji', jenis: 'income', warna: '#059669', ikon: '💼', arsip: false, updatedAt: now, deleted: false },
    { id: 'cat_usaha', nama: 'Usaha / Bonus', jenis: 'income', warna: '#0d9488', ikon: '🏪', arsip: false, updatedAt: now, deleted: false },
    { id: 'cat_hutang_in', nama: 'Hutang / Pinjaman Masuk', jenis: 'income', warna: '#4f46e5', ikon: '🤝', arsip: false, updatedAt: now, deleted: false },
    { id: 'cat_lain_inc', nama: 'Pemasukan Lain', jenis: 'income', warna: '#16a34a', ikon: '💰', arsip: false, updatedAt: now, deleted: false }
  ];

  const transactions = [
    {
      id: 'tx_demo_1',
      tanggal: `${month}-01`,
      jenis: 'income',
      nominal: 5000000,
      kategoriId: 'cat_gaji',
      rekeningId: 'acc_bca',
      rekeningTujuanId: '',
      catatan: 'Gaji Bulanan',
      sumber: 'manual',
      linkedDebtId: '',
      updatedAt: now,
      deleted: false
    },
    {
      id: 'tx_demo_2',
      tanggal: today,
      jenis: 'expense',
      nominal: 35000,
      kategoriId: 'cat_makan',
      rekeningId: 'acc_gopay',
      rekeningTujuanId: '',
      catatan: 'Makan siang & kopi',
      sumber: 'manual',
      linkedDebtId: '',
      updatedAt: now,
      deleted: false
    }
  ];

  const budgets = [
    {
      id: 'bdg_demo_1',
      bulan: month,
      kategoriId: 'cat_makan',
      limitNominal: 1200000,
      updatedAt: now,
      deleted: false
    }
  ];

  const nextWeek = new Date();
  nextWeek.setDate(nextWeek.getDate() + 7);
  const nextWeekISO = nextWeek.toISOString().slice(0, 10);

  const debtsReceivables = [
    {
      id: 'debt_demo_1',
      jenis: 'piutang',
      kontak: 'Budi Santoso',
      nominalPokok: 300000,
      terbayar: 100000,
      sisaTagihan: 200000,
      tanggalTransaksi: today,
      tanggalJatuhTempo: nextWeekISO,
      status: 'Dicicil',
      pengaruhiSaldo: false,
      rekeningId: 'acc_bca',
      linkedTxId: '',
      catatan: 'Pinjaman dana talangan',
      updatedAt: now,
      deleted: false
    }
  ];

  const debtPayments = [
    {
      id: 'pay_demo_1',
      debtId: 'debt_demo_1',
      kontak: 'Budi Santoso',
      jenis: 'piutang',
      tanggalBayar: today,
      nominalBayar: 100000,
      pengaruhiSaldo: false,
      rekeningId: 'acc_bca',
      linkedTxId: '',
      catatan: 'Cicilan pertama',
      updatedAt: now,
      deleted: false
    }
  ];

  return {
    version: 2,
    profile: {
      name: 'Pengguna DompetKu',
      photoDataUrl: ''
    },
    settings: {
      theme: 'system',
      gasUrl: '',
      autoSync: true,
      lastSyncAt: '',
      groqApiKey: '',
      groqModel: 'llama-3.3-70b-versatile'
    },
    accounts,
    categories,
    transactions,
    budgets,
    recurringRules: [],
    debtsReceivables,
    debtPayments
  };
}

let state = loadState();
let securityConfig = loadSecurity();
let txPagination = { page: 1, pageSize: 10 };
let aiChatHistory = [];
let pinBuffer = '';
let isUnlocked = false;
let syncTimer = null;

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return getDefaultState();
    const parsed = JSON.parse(raw);
    return normalizeState(parsed);
  } catch (err) {
    console.error('Gagal memuat state:', err);
    return getDefaultState();
  }
}

function normalizeState(raw) {
  const def = getDefaultState();
  const src = raw && raw.data ? raw.data : (raw || {});
  return {
    version: 2,
    profile: {
      name: src.profile?.name || def.profile.name,
      photoDataUrl: src.profile?.photoDataUrl || ''
    },
    settings: {
      theme: src.settings?.theme || 'system',
      gasUrl: src.settings?.gasUrl || '',
      autoSync: src.settings?.autoSync !== false,
      lastSyncAt: src.settings?.lastSyncAt || '',
      groqApiKey: src.settings?.groqApiKey || '',
      groqModel: src.settings?.groqModel || 'llama-3.3-70b-versatile'
    },
    accounts: Array.isArray(src.accounts) ? src.accounts : def.accounts,
    categories: Array.isArray(src.categories) ? src.categories : def.categories,
    transactions: Array.isArray(src.transactions) ? src.transactions : [],
    budgets: Array.isArray(src.budgets) ? src.budgets : [],
    recurringRules: Array.isArray(src.recurringRules || src.recurring) ? (src.recurringRules || src.recurring) : [],
    debtsReceivables: Array.isArray(src.debtsReceivables || src.hutangPiutang) ? (src.debtsReceivables || src.hutangPiutang) : [],
    debtPayments: Array.isArray(src.debtPayments || src.riwayatCicilan) ? (src.debtPayments || src.riwayatCicilan) : []
  };
}

function saveState({ triggerCloudSync = true } = {}) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (e) {
    showToast('Penyimpanan lokal penuh! Pertimbangkan ekspor backup JSON.', 'error');
  }
  if (triggerCloudSync && state.settings.gasUrl && state.settings.autoSync && navigator.onLine) {
    clearTimeout(syncTimer);
    syncTimer = setTimeout(() => {
      syncWithGoogleSheets(true);
    }, 1400);
  }
}

function loadSecurity() {
  try {
    const raw = localStorage.getItem(SECURITY_KEY);
    if (!raw) return { pinEnabled: false, pinHash: '', pinSalt: '', biometricCredId: '' };
    return JSON.parse(raw);
  } catch {
    return { pinEnabled: false, pinHash: '', pinSalt: '', biometricCredId: '' };
  }
}

function saveSecurity() {
  localStorage.setItem(SECURITY_KEY, JSON.stringify(securityConfig));
}

function showToast(msg, type = 'info') {
  const container = document.getElementById('toast-container');
  const el = document.createElement('div');
  el.className = `toast ${type}`;
  el.textContent = msg;
  container.appendChild(el);
  setTimeout(() => {
    el.style.opacity = '0';
    setTimeout(() => el.remove(), 250);
  }, 3400);
}

/* ==========================================================================
   Theme & Profile UI
   ========================================================================== */

function applyTheme() {
  const mode = state.settings.theme || 'system';
  let resolved = mode;
  if (mode === 'system') {
    resolved = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }
  document.documentElement.setAttribute('data-theme', resolved);
  const sel = document.getElementById('select-theme');
  if (sel) sel.value = mode;
}

function renderAvatarElement(el, name, photoDataUrl) {
  if (!el) return;
  if (photoDataUrl) {
    el.innerHTML = `<img src="${photoDataUrl}" alt="Avatar" style="width:100%;height:100%;border-radius:50%;object-fit:cover;" />`;
  } else {
    const initial = (name || 'U').trim().charAt(0).toUpperCase();
    el.textContent = initial;
  }
}

function updateProfileUI() {
  const name = state.profile.name || 'Pengguna';
  const photo = state.profile.photoDataUrl || '';
  document.getElementById('topbar-greeting').textContent = `Halo, ${name}!`;
  const nowStr = new Date().toLocaleDateString('id-ID', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
  });
  document.getElementById('topbar-date').textContent = nowStr;
  renderAvatarElement(document.getElementById('topbar-avatar'), name, photo);
  renderAvatarElement(document.getElementById('settings-avatar-preview'), name, photo);
  renderAvatarElement(document.getElementById('lock-avatar'), name, photo);
  document.getElementById('lock-user-name').textContent = name;
  document.getElementById('input-profile-name').value = name;
}

/* ==========================================================================
   Security: PIN 4-6 Digit + WebAuthn Fingerprint
   ========================================================================== */

async function sha256Hex(text) {
  if (window.crypto && window.crypto.subtle) {
    const enc = new TextEncoder().encode(text);
    const buf = await crypto.subtle.digest('SHA-256', enc);
    return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
  }
  // Fallback hash if non-secure context
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h += (h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24);
  }
  return (h >>> 0).toString(16);
}

function updatePinDots() {
  const dots = document.querySelectorAll('#pin-dots .pin-dot');
  dots.forEach((d, idx) => {
    d.classList.toggle('filled', idx < pinBuffer.length);
  });
}

function lockApp() {
  if (!securityConfig.pinEnabled) return;
  isUnlocked = false;
  pinBuffer = '';
  updatePinDots();
  document.getElementById('lock-error').textContent = '';
  document.getElementById('lock-screen').classList.remove('hidden');
  const bioBtn = document.getElementById('btn-biometric-unlock');
  bioBtn.style.visibility = securityConfig.biometricCredId ? 'visible' : 'hidden';
}

async function verifyPinInput() {
  if (pinBuffer.length < 4 || pinBuffer.length > 6) {
    document.getElementById('lock-error').textContent = 'PIN harus 4 hingga 6 digit.';
    return;
  }
  const hash = await sha256Hex(`${securityConfig.pinSalt}:${pinBuffer}`);
  if (hash === securityConfig.pinHash) {
    isUnlocked = true;
    pinBuffer = '';
    updatePinDots();
    document.getElementById('lock-screen').classList.add('hidden');
    showToast('Aplikasi terbuka', 'success');
  } else {
    pinBuffer = '';
    updatePinDots();
    document.getElementById('lock-error').textContent = 'PIN salah. Silakan coba lagi.';
  }
}

function bufToBase64Url(buf) {
  const bytes = new Uint8Array(buf);
  let str = '';
  bytes.forEach(b => { str += String.fromCharCode(b); });
  return btoa(str).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function base64UrlToBuf(b64url) {
  const b64 = b64url.replace(/-/g, '+').replace(/_/g, '/');
  const pad = b64.length % 4 ? '='.repeat(4 - (b64.length % 4)) : '';
  const bin = atob(b64 + pad);
  const arr = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
  return arr.buffer;
}

async function registerBiometric() {
  if (!securityConfig.pinEnabled) {
    showToast('Aktifkan PIN 4–6 digit terlebih dahulu sebagai fallback.', 'error');
    return;
  }
  if (!window.PublicKeyCredential || !window.isSecureContext) {
    showToast('WebAuthn memerlukan konteks HTTPS (misal GitHub Pages) atau localhost.', 'error');
    return;
  }
  try {
    const available = await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
    if (!available) {
      showToast('Perangkat ini tidak mendukung sensor biometrik platform.', 'error');
      return;
    }
    const challenge = crypto.getRandomValues(new Uint8Array(32));
    const userId = crypto.getRandomValues(new Uint8Array(16));
    const cred = await navigator.credentials.create({
      publicKey: {
        challenge,
        rp: { name: 'DompetKu PWA' },
        user: {
          id: userId,
          name: state.profile.name || 'user@dompetku',
          displayName: state.profile.name || 'Pengguna DompetKu'
        },
        pubKeyCredParams: [
          { type: 'public-key', alg: -7 },
          { type: 'public-key', alg: -257 }
        ],
        authenticatorSelection: {
          authenticatorAttachment: 'platform',
          userVerification: 'required'
        },
        timeout: 60000
      }
    });
    if (cred && cred.rawId) {
      securityConfig.biometricCredId = bufToBase64Url(cred.rawId);
      saveSecurity();
      updateSecurityUI();
      showToast('Sidik jari berhasil didaftarkan untuk kunci aplikasi!', 'success');
    }
  } catch (err) {
    showToast('Pendaftaran biometrik dibatalkan atau gagal: ' + err.message, 'error');
  }
}

async function unlockWithBiometric() {
  if (!securityConfig.biometricCredId || !window.PublicKeyCredential) return;
  try {
    const challenge = crypto.getRandomValues(new Uint8Array(32));
    const assertion = await navigator.credentials.get({
      publicKey: {
        challenge,
        allowCredentials: [{
          id: base64UrlToBuf(securityConfig.biometricCredId),
          type: 'public-key'
        }],
        userVerification: 'required',
        timeout: 60000
      }
    });
    if (assertion) {
      isUnlocked = true;
      pinBuffer = '';
      document.getElementById('lock-screen').classList.add('hidden');
      showToast('Berhasil dibuka dengan sidik jari', 'success');
    }
  } catch (err) {
    document.getElementById('lock-error').textContent = 'Verifikasi sidik jari gagal. Gunakan PIN.';
  }
}

function updateSecurityUI() {
  const lockBtn = document.getElementById('sidebar-lock-btn');
  const bioStatus = document.getElementById('biometric-status-text');
  const bioRegBtn = document.getElementById('btn-register-biometric');
  const bioRemBtn = document.getElementById('btn-remove-biometric');

  if (lockBtn) lockBtn.style.display = securityConfig.pinEnabled ? 'inline-flex' : 'none';
  if (securityConfig.biometricCredId) {
    bioStatus.textContent = 'Aktif & Terdaftar (PIN tetap tersedia sebagai fallback)';
    bioRegBtn.textContent = '🔄 Daftar Ulang';
    bioRemBtn.style.display = 'inline-flex';
  } else {
    bioStatus.textContent = securityConfig.pinEnabled ? 'Siap didaftarkan' : 'Aktifkan PIN terlebih dahulu';
    bioRegBtn.textContent = '👆 Daftarkan';
    bioRemBtn.style.display = 'none';
  }
}

/* ==========================================================================
   Core Calculations: Account Balances, Debts Status, Recurring Engine
   ========================================================================== */

function getActiveAccounts(includeArchived = false) {
  return state.accounts.filter(a => !a.deleted && (includeArchived || !a.arsip));
}

function getActiveCategories(jenis = null, includeArchived = false) {
  return state.categories.filter(c => {
    if (c.deleted) return false;
    if (!includeArchived && c.arsip) return false;
    if (jenis && c.jenis !== jenis) return false;
    return true;
  });
}

function getActiveTransactions() {
  return state.transactions.filter(t => !t.deleted);
}

function getAccountBalance(accountId) {
  const acc = state.accounts.find(a => a.id === accountId);
  if (!acc) return 0;
  let bal = Number(acc.saldoAwal || 0);
  getActiveTransactions().forEach(tx => {
    const nom = Number(tx.nominal || 0);
    if (tx.jenis === 'income' && tx.rekeningId === accountId) bal += nom;
    else if (tx.jenis === 'expense' && tx.rekeningId === accountId) bal -= nom;
    else if (tx.jenis === 'transfer') {
      if (tx.rekeningId === accountId) bal -= nom;
      if (tx.rekeningTujuanId === accountId) bal += nom;
    }
  });
  return bal;
}

function computeDebtStatus(item) {
  const pokok = Number(item.nominalPokok || 0);
  const paid = Number(item.terbayar || 0);
  const sisa = Math.max(0, pokok - paid);
  if (sisa <= 0) return 'Lunas';
  const today = todayISO();
  if (item.tanggalJatuhTempo && today > item.tanggalJatuhTempo) {
    return 'Jatuh Tempo';
  }
  if (paid > 0) return 'Dicicil';
  return 'Belum Lunas';
}

function recalculateDebtItem(debtId) {
  const debt = state.debtsReceivables.find(d => d.id === debtId);
  if (!debt) return;
  const payments = state.debtPayments.filter(p => p.debtId === debtId && !p.deleted);
  const totalPaid = payments.reduce((sum, p) => sum + Number(p.nominalBayar || 0), 0);
  debt.terbayar = totalPaid;
  debt.sisaTagihan = Math.max(0, Number(debt.nominalPokok || 0) - totalPaid);
  debt.status = computeDebtStatus(debt);
  debt.updatedAt = new Date().toISOString();
}

function advanceDateByRule(isoDate, freq, interval) {
  const [y, m, d] = isoDate.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  const step = Math.max(1, Number(interval || 1));
  if (freq === 'daily') dt.setDate(dt.getDate() + step);
  else if (freq === 'weekly') dt.setDate(dt.getDate() + step * 7);
  else if (freq === 'monthly') dt.setMonth(dt.getMonth() + step);
  else if (freq === 'yearly') dt.setFullYear(dt.getFullYear() + step);
  const ny = dt.getFullYear();
  const nm = String(dt.getMonth() + 1).padStart(2, '0');
  const nd = String(dt.getDate()).padStart(2, '0');
  return `${ny}-${nm}-${nd}`;
}

function processRecurringRules(silent = true) {
  const today = todayISO();
  let createdCount = 0;
  const nowIso = new Date().toISOString();

  state.recurringRules.forEach(rule => {
    if (rule.deleted || rule.aktif === false) return;
    let nextDate = rule.berikutnya || rule.tanggalMulai;
    if (!nextDate) return;

    let guard = 0;
    while (nextDate <= today && guard < 365) {
      if (rule.tanggalSelesai && nextDate > rule.tanggalSelesai) {
        rule.aktif = false;
        break;
      }
      state.transactions.push({
        id: uid('tx_rec'),
        tanggal: nextDate,
        jenis: rule.jenis,
        nominal: Number(rule.nominal || 0),
        kategoriId: rule.kategoriId || '',
        rekeningId: rule.rekeningId || '',
        rekeningTujuanId: rule.rekeningTujuanId || '',
        catatan: `${rule.catatan} (Otomatis Berulang)`,
        sumber: 'recurring',
        linkedDebtId: '',
        updatedAt: nowIso,
        deleted: false
      });
      createdCount++;
      nextDate = advanceDateByRule(nextDate, rule.frekuensi, rule.interval);
      rule.berikutnya = nextDate;
      rule.updatedAt = nowIso;
      if (rule.tanggalSelesai && nextDate > rule.tanggalSelesai) {
        rule.aktif = false;
        break;
      }
      guard++;
    }
  });

  if (createdCount > 0) {
    saveState({ triggerCloudSync: true });
    showToast(`${createdCount} transaksi berulang otomatis dicatat!`, 'success');
  } else if (!silent) {
    showToast('Tidak ada jadwal transaksi berulang yang jatuh tempo hari ini.', 'info');
  }
}

/* ==========================================================================
   Google Sheets Cloud Sync (Bidirectional LWW Merge)
   ========================================================================== */

function updateSyncStatusBadge(status, label) {
  const pill = document.getElementById('sync-status-btn');
  const txt = document.getElementById('sync-status-text');
  pill.classList.remove('online', 'syncing', 'offline');
  if (status) pill.classList.add(status);
  txt.textContent = label;
}

function refreshSyncIndicator() {
  if (!state.settings.gasUrl) {
    updateSyncStatusBadge('', 'Lokal (Belum Konek Sheet)');
    return;
  }
  if (!navigator.onLine) {
    updateSyncStatusBadge('offline', 'Offline (Antre Sync)');
    return;
  }
  updateSyncStatusBadge('online', 'Online • Google Sheet');
}

async function syncWithGoogleSheets(silent = false) {
  const url = (state.settings.gasUrl || '').trim();
  if (!url) {
    if (!silent) showToast('Masukkan URL Google Apps Script di Pengaturan terlebih dahulu.', 'error');
    refreshSyncIndicator();
    return;
  }
  if (!navigator.onLine) {
    refreshSyncIndicator();
    if (!silent) showToast('Sedang offline. Data tersimpan lokal dan akan disinkronkan saat online.', 'info');
    return;
  }

  updateSyncStatusBadge('syncing', 'Menyinkronkan...');
  try {
    const payload = {
      action: 'sync',
      data: {
        accounts: state.accounts,
        categories: state.categories,
        transactions: state.transactions,
        budgets: state.budgets,
        recurringRules: state.recurringRules,
        debtsReceivables: state.debtsReceivables,
        debtPayments: state.debtPayments
      }
    };

    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(payload)
    });
    const json = await res.json();
    if (!json.ok) throw new Error(json.error || 'Respons server tidak valid');

    if (json.data) {
      if (Array.isArray(json.data.accounts) && json.data.accounts.length) state.accounts = json.data.accounts;
      if (Array.isArray(json.data.categories) && json.data.categories.length) state.categories = json.data.categories;
      if (Array.isArray(json.data.transactions)) state.transactions = json.data.transactions;
      if (Array.isArray(json.data.budgets)) state.budgets = json.data.budgets;
      if (Array.isArray(json.data.recurringRules)) state.recurringRules = json.data.recurringRules;
      if (Array.isArray(json.data.debtsReceivables)) state.debtsReceivables = json.data.debtsReceivables;
      if (Array.isArray(json.data.debtPayments)) state.debtPayments = json.data.debtPayments;

      // Refresh dynamic statuses
      state.debtsReceivables.forEach(d => {
        if (!d.deleted) d.status = computeDebtStatus(d);
      });
    }

    state.settings.lastSyncAt = new Date().toLocaleString('id-ID');
    saveState({ triggerCloudSync: false });
    updateSyncStatusBadge('online', 'Tersinkron • Google Sheet');
    document.getElementById('last-sync-info').textContent = `Sinkronisasi terakhir: ${state.settings.lastSyncAt}`;
    renderAll();
    if (!silent) showToast('Sinkronisasi Google Sheets berhasil!', 'success');
  } catch (err) {
    console.error('Sync error:', err);
    updateSyncStatusBadge('offline', 'Gagal Sync');
    if (!silent) showToast('Gagal sinkronisasi Google Sheets: ' + err.message, 'error');
  }
}

/* ==========================================================================
   Navigation & Modal Helpers
   ========================================================================== */

function switchTab(tabName) {
  document.querySelectorAll('.tab-section').forEach(sec => {
    sec.classList.toggle('active', sec.id === `tab-${tabName}`);
  });
  document.querySelectorAll('[data-tab]').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.tab === tabName);
  });
  if (tabName === 'dashboard') {
    renderDashboard();
  } else if (tabName === 'transactions') {
    renderTransactionsTab();
  } else if (tabName === 'debts') {
    renderDebtsTab();
  } else if (tabName === 'budget') {
    renderBudgetAndRecurringTab();
  } else if (tabName === 'reports') {
    renderReportsTab();
  } else if (tabName === 'settings') {
    renderSettingsTab();
  }
}

function openModal(id) {
  const el = document.getElementById(id);
  if (el) el.classList.add('open');
}

function closeModal(id) {
  const el = document.getElementById(id);
  if (el) el.classList.remove('open');
}

/* ==========================================================================
   Select Options Populators
   ========================================================================== */

function populateAccountSelect(selectEl, { includeAll = false, includeArchived = false } = {}) {
  if (!selectEl) return;
  const current = selectEl.value;
  const accs = getActiveAccounts(includeArchived);
  let html = includeAll ? `<option value="all">Semua Rekening</option>` : '';
  accs.forEach(a => {
    html += `<option value="${a.id}">${escapeHTML(a.ikon)} ${escapeHTML(a.nama)}${a.arsip ? ' (Arsip)' : ''}</option>`;
  });
  selectEl.innerHTML = html;
  if (current && Array.from(selectEl.options).some(o => o.value === current)) {
    selectEl.value = current;
  }
}

function populateCategorySelect(selectEl, { jenis = null, includeAll = false, includeArchived = false } = {}) {
  if (!selectEl) return;
  const current = selectEl.value;
  const cats = getActiveCategories(jenis, includeArchived);
  let html = includeAll ? `<option value="all">Semua Kategori</option>` : '';
  cats.forEach(c => {
    html += `<option value="${c.id}">${escapeHTML(c.ikon)} ${escapeHTML(c.nama)}</option>`;
  });
  selectEl.innerHTML = html;
  if (current && Array.from(selectEl.options).some(o => o.value === current)) {
    selectEl.value = current;
  }
}

function getAccountName(id) {
  const acc = state.accounts.find(a => a.id === id);
  return acc ? `${acc.ikon} ${acc.nama}` : '-';
}

function getCategoryObj(id) {
  return state.categories.find(c => c.id === id) || { nama: 'Tanpa Kategori', ikon: '🏷️', warna: '#64748b' };
}

/* ==========================================================================
   Tab 1: Dashboard & HD Offline Canvas Charts
   ========================================================================== */

function renderDashboard() {
  const accs = getActiveAccounts(false);
  const totalBal = accs.reduce((sum, a) => sum + getAccountBalance(a.id), 0);
  const month = currentMonthISO();
  const monthTxs = getActiveTransactions().filter(t => (t.tanggal || '').startsWith(month));

  let mIncome = 0;
  let mExpense = 0;
  monthTxs.forEach(t => {
    if (t.jenis === 'income') mIncome += Number(t.nominal || 0);
    else if (t.jenis === 'expense') mExpense += Number(t.nominal || 0);
  });
  const mNet = mIncome - mExpense;

  document.getElementById('dash-total-balance').textContent = formatRupiah(totalBal);
  document.getElementById('dash-account-count').textContent = `${accs.length} rekening aktif`;
  document.getElementById('dash-month-income').textContent = formatRupiah(mIncome);
  document.getElementById('dash-month-label').textContent = `Periode ${month}`;
  document.getElementById('dash-month-expense').textContent = formatRupiah(mExpense);
  document.getElementById('dash-tx-count').textContent = `${monthTxs.length} transaksi bulan ini`;

  const netEl = document.getElementById('dash-month-net');
  netEl.textContent = formatRupiah(mNet);
  netEl.className = `kpi-value ${mNet >= 0 ? 'text-success' : 'text-danger'}`;

  // Active Hutang & Piutang Summary
  const activeDebts = state.debtsReceivables.filter(d => {
    if (d.deleted) return false;
    d.status = computeDebtStatus(d);
    return d.status !== 'Lunas';
  });
  const hutangList = activeDebts.filter(d => d.jenis === 'hutang');
  const piutangList = activeDebts.filter(d => d.jenis === 'piutang');
  const totalHutang = hutangList.reduce((s, d) => s + Number(d.sisaTagihan || 0), 0);
  const totalPiutang = piutangList.reduce((s, d) => s + Number(d.sisaTagihan || 0), 0);
  const netDebt = totalPiutang - totalHutang;

  document.getElementById('dash-active-hutang').textContent = formatRupiah(totalHutang);
  document.getElementById('dash-hutang-count').textContent = `${hutangList.length} hutang aktif`;
  document.getElementById('dash-active-piutang').textContent = formatRupiah(totalPiutang);
  document.getElementById('dash-piutang-count').textContent = `${piutangList.length} piutang aktif`;
  const debtNetEl = document.getElementById('dash-debt-net');
  debtNetEl.textContent = formatRupiah(netDebt);
  debtNetEl.className = `kpi-value ${netDebt >= 0 ? 'text-success' : 'text-danger'}`;

  // Upcoming due reminder
  const upcoming = [...activeDebts]
    .filter(d => d.tanggalJatuhTempo)
    .sort((a, b) => a.tanggalJatuhTempo.localeCompare(b.tanggalJatuhTempo))
    .slice(0, 3);
  const upContainer = document.getElementById('dash-upcoming-debts');
  if (upcoming.length > 0) {
    upContainer.innerHTML = `<div style="font-size:12px;font-weight:700;color:var(--text-muted);margin-bottom:6px;">⏰ Jatuh Tempo Terdekat:</div>` +
      upcoming.map(d => {
        const isOverdue = d.status === 'Jatuh Tempo';
        return `<div style="display:flex;justify-content:space-between;align-items:center;padding:6px 10px;border-radius:8px;background:var(--surface-2);margin-bottom:5px;font-size:12.5px;">
          <span><strong>${d.jenis === 'hutang' ? 'Hutang ke' : 'Piutang'} ${escapeHTML(d.kontak)}</strong> • Tempo: ${formatDateID(d.tanggalJatuhTempo)}</span>
          <span class="badge ${isOverdue ? 'badge-danger' : 'badge-warning'}">${formatRupiah(d.sisaTagihan)} (${d.status})</span>
        </div>`;
      }).join('');
  } else {
    upContainer.innerHTML = '';
  }

  // Account cards
  const accListEl = document.getElementById('dash-accounts-list');
  accListEl.innerHTML = accs.map(a => {
    const bal = getAccountBalance(a.id);
    return `<div class="account-card" style="border-left-color:${escapeHTML(a.warna)}">
      <div class="flex-between">
        <span style="font-weight:700;">${escapeHTML(a.ikon)} ${escapeHTML(a.nama)}</span>
        <span class="badge badge-neutral">${escapeHTML(a.tipe)}</span>
      </div>
      <div style="font-size:16.5px;font-weight:800;margin-top:4px;">${formatRupiah(bal)}</div>
    </div>`;
  }).join('') || '<div class="text-muted">Belum ada rekening aktif.</div>';

  // Monthly budget summary
  const monthBudgets = state.budgets.filter(b => !b.deleted && b.bulan === month);
  const dashBdgEl = document.getElementById('dash-budget-list');
  if (monthBudgets.length === 0) {
    dashBdgEl.innerHTML = '<div class="text-muted" style="font-size:13px;">Belum ada budget diatur untuk bulan ini.</div>';
  } else {
    dashBdgEl.innerHTML = monthBudgets.slice(0, 4).map(b => {
      const cat = getCategoryObj(b.kategoriId);
      const spent = monthTxs
        .filter(t => t.jenis === 'expense' && t.kategoriId === b.kategoriId)
        .reduce((s, t) => s + Number(t.nominal || 0), 0);
      const limit = Number(b.limitNominal || 1);
      const pct = Math.min(100, Math.round((spent / limit) * 100));
      const realPct = Math.round((spent / limit) * 100);
      let statusBadge = '<span class="badge badge-success">Aman</span>';
      let barColor = 'var(--success)';
      if (realPct > 100) {
        statusBadge = '<span class="badge badge-danger">Terlampaui</span>';
        barColor = 'var(--danger)';
      } else if (realPct >= 80) {
        statusBadge = '<span class="badge badge-warning">Hampir Penuh</span>';
        barColor = 'var(--warning)';
      }
      return `<div>
        <div class="flex-between" style="font-size:13px;margin-bottom:4px;">
          <span><strong>${escapeHTML(cat.ikon)} ${escapeHTML(cat.nama)}</strong></span>
          <span>${formatRupiah(spent)} / ${formatRupiah(limit)} ${statusBadge}</span>
        </div>
        <div class="progress-track"><div class="progress-fill" style="width:${pct}%;background:${barColor};"></div></div>
      </div>`;
    }).join('');
  }

  // Recent transactions
  const recent = [...getActiveTransactions()]
    .sort((a, b) => (b.tanggal || '').localeCompare(a.tanggal || '') || (b.updatedAt || '').localeCompare(a.updatedAt || ''))
    .slice(0, 6);
  const recentEl = document.getElementById('dash-recent-tx');
  if (recent.length === 0) {
    recentEl.innerHTML = '<div class="text-muted">Belum ada transaksi tercatat.</div>';
  } else {
    recentEl.innerHTML = `<div class="table-wrap"><table class="table">
      <thead><tr><th>Tanggal</th><th>Kategori / Info</th><th>Rekening</th><th>Catatan</th><th style="text-align:right;">Nominal</th></tr></thead>
      <tbody>${recent.map(t => {
        const cat = t.jenis === 'transfer' ? { ikon: '🔄', nama: 'Transfer Rekening' } : getCategoryObj(t.kategoriId);
        const rek = t.jenis === 'transfer'
          ? `${getAccountName(t.rekeningId)} → ${getAccountName(t.rekeningTujuanId)}`
          : getAccountName(t.rekeningId);
        const cls = t.jenis === 'income' ? 'text-success' : (t.jenis === 'expense' ? 'text-danger' : 'text-info');
        const sign = t.jenis === 'income' ? '+' : (t.jenis === 'expense' ? '-' : '');
        return `<tr>
          <td>${formatDateID(t.tanggal)}</td>
          <td>${escapeHTML(cat.ikon)} ${escapeHTML(cat.nama)}</td>
          <td>${escapeHTML(rek)}</td>
          <td>${escapeHTML(t.catatan || '-')}</td>
          <td style="text-align:right;font-weight:700;" class="${cls}">${sign}${formatRupiah(t.nominal)}</td>
        </tr>`;
      }).join('')}</tbody>
    </table></div>`;
  }

  renderTrendChart();
  renderCategoryChart();
}

function renderTrendChart() {
  const canvas = document.getElementById('chart-trend');
  if (!canvas) return;
  const rect = canvas.parentElement.getBoundingClientRect();
  const dpr = window.devicePixelRatio || 1;
  const w = Math.max(280, rect.width);
  const h = 240;
  canvas.width = w * dpr;
  canvas.height = h * dpr;
  const ctx = canvas.getContext('2d');
  ctx.scale(dpr, dpr);

  const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
  const textColor = isDark ? '#94a3b8' : '#64748b';
  const gridColor = isDark ? '#263452' : '#e2e8f0';

  // Last 6 months
  const months = [];
  const now = new Date();
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const ym = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    const label = d.toLocaleDateString('id-ID', { month: 'short' });
    months.push({ ym, label, income: 0, expense: 0 });
  }

  getActiveTransactions().forEach(t => {
    const ym = (t.tanggal || '').slice(0, 7);
    const m = months.find(x => x.ym === ym);
    if (!m) return;
    if (t.jenis === 'income') m.income += Number(t.nominal || 0);
    else if (t.jenis === 'expense') m.expense += Number(t.nominal || 0);
  });

  const maxVal = Math.max(100000, ...months.flatMap(m => [m.income, m.expense]));
  const padL = 56, padR = 16, padT = 28, padB = 32;
  const plotW = w - padL - padR;
  const plotH = h - padT - padB;

  ctx.clearRect(0, 0, w, h);

  // Legend
  ctx.font = '600 11px sans-serif';
  ctx.fillStyle = '#10b981';
  ctx.fillRect(padL, 8, 10, 10);
  ctx.fillStyle = textColor;
  ctx.fillText('Pemasukan', padL + 15, 17);

  ctx.fillStyle = '#ef4444';
  ctx.fillRect(padL + 95, 8, 10, 10);
  ctx.fillStyle = textColor;
  ctx.fillText('Pengeluaran', padL + 110, 17);

  // Grid lines
  ctx.strokeStyle = gridColor;
  ctx.lineWidth = 1;
  for (let i = 0; i <= 4; i++) {
    const y = padT + (plotH * i) / 4;
    ctx.beginPath();
    ctx.moveTo(padL, y);
    ctx.lineTo(w - padR, y);
    ctx.stroke();

    const val = Math.round(((4 - i) / 4) * maxVal);
    ctx.fillStyle = textColor;
    ctx.font = '10px sans-serif';
    ctx.textAlign = 'right';
    const shortVal = val >= 1e6 ? `${(val / 1e6).toFixed(1)}jt` : (val >= 1e3 ? `${Math.round(val / 1e3)}rb` : val);
    ctx.fillText(shortVal, padL - 6, y + 3);
  }

  // Bars
  const groupW = plotW / months.length;
  const barW = Math.min(20, groupW * 0.28);
  months.forEach((m, idx) => {
    const cx = padL + groupW * idx + groupW / 2;
    const incH = (m.income / maxVal) * plotH;
    const expH = (m.expense / maxVal) * plotH;

    ctx.fillStyle = '#10b981';
    ctx.fillRect(cx - barW - 2, padT + plotH - incH, barW, incH);

    ctx.fillStyle = '#ef4444';
    ctx.fillRect(cx + 2, padT + plotH - expH, barW, expH);

    ctx.fillStyle = textColor;
    ctx.font = '600 11px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(m.label, cx, h - 10);
  });
}

function renderCategoryChart() {
  const canvas = document.getElementById('chart-category');
  if (!canvas) return;
  const rect = canvas.parentElement.getBoundingClientRect();
  const dpr = window.devicePixelRatio || 1;
  const w = Math.max(280, rect.width);
  const h = 240;
  canvas.width = w * dpr;
  canvas.height = h * dpr;
  const ctx = canvas.getContext('2d');
  ctx.scale(dpr, dpr);

  const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
  const textColor = isDark ? '#f1f5f9' : '#0f172a';
  const mutedColor = isDark ? '#94a3b8' : '#64748b';

  const month = currentMonthISO();
  const map = {};
  getActiveTransactions()
    .filter(t => t.jenis === 'expense' && (t.tanggal || '').startsWith(month))
    .forEach(t => {
      map[t.kategoriId] = (map[t.kategoriId] || 0) + Number(t.nominal || 0);
    });

  const entries = Object.entries(map)
    .map(([catId, total]) => ({ cat: getCategoryObj(catId), total }))
    .sort((a, b) => b.total - a.total);

  ctx.clearRect(0, 0, w, h);

  if (entries.length === 0) {
    ctx.fillStyle = mutedColor;
    ctx.font = '13px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Belum ada pengeluaran bulan ini', w / 2, h / 2);
    return;
  }

  const grandTotal = entries.reduce((s, e) => s + e.total, 0);
  const radius = Math.min(76, h * 0.34);
  const cx = Math.min(115, w * 0.28);
  const cy = h / 2;
  let startAngle = -Math.PI / 2;

  entries.forEach(e => {
    const slice = (e.total / grandTotal) * Math.PI * 2;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.arc(cx, cy, radius, startAngle, startAngle + slice);
    ctx.closePath();
    ctx.fillStyle = e.cat.warna || '#0d9488';
    ctx.fill();
    startAngle += slice;
  });

  // Donut hole
  ctx.beginPath();
  ctx.arc(cx, cy, radius * 0.56, 0, Math.PI * 2);
  ctx.fillStyle = isDark ? '#131c31' : '#ffffff';
  ctx.fill();

  ctx.fillStyle = textColor;
  ctx.font = '700 11px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('Total', cx, cy - 3);
  const shortTot = grandTotal >= 1e6 ? `${(grandTotal / 1e6).toFixed(1)}jt` : `${Math.round(grandTotal / 1e3)}rb`;
  ctx.fillText(shortTot, cx, cy + 12);

  // Legend on right
  const legX = cx + radius + 24;
  let legY = 26;
  entries.slice(0, 6).forEach(e => {
    const pct = Math.round((e.total / grandTotal) * 100);
    ctx.fillStyle = e.cat.warna || '#0d9488';
    ctx.fillRect(legX, legY - 9, 10, 10);
    ctx.fillStyle = textColor;
    ctx.font = '600 11.5px sans-serif';
    ctx.textAlign = 'left';
    const label = `${e.cat.nama} (${pct}%)`;
    ctx.fillText(label.slice(0, 26), legX + 16, legY);
    legY += 28;
  });
}

/* ==========================================================================
   Tab 2: Transaksi (CRUD, Filter, Search, Pagination)
   ========================================================================== */

function renderTransactionsTab() {
  populateAccountSelect(document.getElementById('tx-filter-account'), { includeAll: true, includeArchived: true });
  populateCategorySelect(document.getElementById('tx-filter-category'), { includeAll: true, includeArchived: true });

  const search = (document.getElementById('tx-filter-search').value || '').toLowerCase().trim();
  const type = document.getElementById('tx-filter-type').value;
  const account = document.getElementById('tx-filter-account').value;
  const category = document.getElementById('tx-filter-category').value;
  const start = document.getElementById('tx-filter-start').value;
  const end = document.getElementById('tx-filter-end').value;

  let list = getActiveTransactions().filter(t => {
    if (type !== 'all' && t.jenis !== type) return false;
    if (account !== 'all' && t.rekeningId !== account && t.rekeningTujuanId !== account) return false;
    if (category !== 'all' && t.kategoriId !== category) return false;
    if (start && t.tanggal < start) return false;
    if (end && t.tanggal > end) return false;
    if (search) {
      const catName = getCategoryObj(t.kategoriId).nama.toLowerCase();
      const accName = getAccountName(t.rekeningId).toLowerCase();
      const note = (t.catatan || '').toLowerCase();
      if (!catName.includes(search) && !accName.includes(search) && !note.includes(search)) return false;
    }
    return true;
  });

  list.sort((a, b) => (b.tanggal || '').localeCompare(a.tanggal || '') || (b.updatedAt || '').localeCompare(a.updatedAt || ''));

  const totalItems = list.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / txPagination.pageSize));
  if (txPagination.page > totalPages) txPagination.page = totalPages;
  const startIdx = (txPagination.page - 1) * txPagination.pageSize;
  const paged = list.slice(startIdx, startIdx + txPagination.pageSize);

  document.getElementById('tx-result-info').textContent = `Menampilkan ${paged.length} dari ${totalItems} transaksi`;
  document.getElementById('tx-page-indicator').textContent = `Halaman ${txPagination.page} dari ${totalPages}`;
  document.getElementById('tx-prev-page').disabled = txPagination.page <= 1;
  document.getElementById('tx-next-page').disabled = txPagination.page >= totalPages;

  const tbody = document.getElementById('tx-table-body');
  if (paged.length === 0) {
    tbody.innerHTML = `<tr><td colspan="7" style="text-align:center;padding:24px;" class="text-muted">Tidak ada transaksi yang sesuai filter.</td></tr>`;
    return;
  }

  tbody.innerHTML = paged.map(t => {
    const jenisBadge = t.jenis === 'income'
      ? '<span class="badge badge-success">Pemasukan</span>'
      : (t.jenis === 'expense'
        ? '<span class="badge badge-danger">Pengeluaran</span>'
        : '<span class="badge badge-info">Transfer</span>');
    const cat = t.jenis === 'transfer' ? { ikon: '🔄', nama: 'Transfer Antar Rekening' } : getCategoryObj(t.kategoriId);
    const rek = t.jenis === 'transfer'
      ? `${getAccountName(t.rekeningId)} → ${getAccountName(t.rekeningTujuanId)}`
      : getAccountName(t.rekeningId);
    const cls = t.jenis === 'income' ? 'text-success' : (t.jenis === 'expense' ? 'text-danger' : 'text-info');
    const sign = t.jenis === 'income' ? '+' : (t.jenis === 'expense' ? '-' : '');
    const srcTag = t.sumber === 'recurring' ? ' <span class="badge badge-neutral">🔁 Rutin</span>'
      : (t.linkedDebtId ? ' <span class="badge badge-neutral">🤝 Hutang/Piutang</span>' : '');

    return `<tr>
      <td>${formatDateID(t.tanggal)}</td>
      <td>${jenisBadge}</td>
      <td>${escapeHTML(cat.ikon)} ${escapeHTML(cat.nama)}${srcTag}</td>
      <td>${escapeHTML(rek)}</td>
      <td>${escapeHTML(t.catatan || '-')}</td>
      <td style="text-align:right;font-weight:700;" class="${cls}">${sign}${formatRupiah(t.nominal)}</td>
      <td style="text-align:right;white-space:nowrap;">
        <button type="button" class="btn btn-icon btn-sm" onclick="editTransaction('${t.id}')" title="Edit">✏️</button>
        <button type="button" class="btn btn-icon btn-sm btn-danger" onclick="deleteTransaction('${t.id}')" title="Hapus">🗑️</button>
      </td>
    </tr>`;
  }).join('');
}

function openTransactionModal(prefill = null) {
  const form = document.getElementById('form-tx');
  form.reset();
  document.getElementById('tx-id').value = prefill?.id || '';
  document.getElementById('modal-tx-title').textContent = prefill?.id ? 'Edit Transaksi' : 'Tambah Transaksi';

  const jenis = prefill?.jenis || 'expense';
  document.getElementById('tx-jenis').value = jenis;
  document.getElementById('tx-tanggal').value = prefill?.tanggal || todayISO();
  document.getElementById('tx-nominal').value = prefill?.nominal || '';
  document.getElementById('tx-catatan').value = prefill?.catatan || '';

  populateAccountSelect(document.getElementById('tx-rekening'));
  populateAccountSelect(document.getElementById('tx-rekening-tujuan'));
  syncTxModalFields();

  if (prefill?.rekeningId) document.getElementById('tx-rekening').value = prefill.rekeningId;
  if (prefill?.rekeningTujuanId) document.getElementById('tx-rekening-tujuan').value = prefill.rekeningTujuanId;
  if (prefill?.kategoriId) document.getElementById('tx-kategori').value = prefill.kategoriId;

  openModal('modal-tx');
}

function syncTxModalFields() {
  const jenis = document.getElementById('tx-jenis').value;
  const tujuanWrap = document.getElementById('tx-rekening-tujuan-wrap');
  const catWrap = document.getElementById('tx-kategori-wrap');
  const rekLabel = document.getElementById('tx-rekening-label');

  if (jenis === 'transfer') {
    tujuanWrap.style.display = 'flex';
    catWrap.style.display = 'none';
    rekLabel.textContent = 'Dari Rekening Asal';
  } else {
    tujuanWrap.style.display = 'none';
    catWrap.style.display = 'flex';
    rekLabel.textContent = 'Rekening / Dompet';
    populateCategorySelect(document.getElementById('tx-kategori'), { jenis });
  }
}

window.editTransaction = function (id) {
  const tx = state.transactions.find(t => t.id === id && !t.deleted);
  if (!tx) return;
  openTransactionModal(tx);
};

window.deleteTransaction = function (id) {
  if (!confirm('Hapus transaksi ini? Saldo rekening akan otomatis menyesuaikan.')) return;
  const tx = state.transactions.find(t => t.id === id);
  if (tx) {
    tx.deleted = true;
    tx.updatedAt = new Date().toISOString();
    saveState();
    renderAll();
    showToast('Transaksi dihapus', 'success');
  }
};

/* ==========================================================================
   AI Groq Integration: Quick Fill & Interactive Chat
   ========================================================================== */

async function callGroqChatCompletion(messages, temperature = 0.2) {
  const apiKey = (state.settings.groqApiKey || '').trim();
  if (!apiKey) {
    throw new Error('Groq API Key belum diisi. Silakan atur di menu Pengaturan → Konfigurasi AI (Groq).');
  }
  if (!navigator.onLine) {
    throw new Error('Fitur AI Groq memerlukan koneksi internet.');
  }
  const model = state.settings.groqModel || 'llama-3.3-70b-versatile';
  const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model,
      messages,
      temperature
    })
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error?.message || `Groq API Error (${res.status})`);
  }
  return data.choices?.[0]?.message?.content || '';
}

function buildAiContextPrompt() {
  const accs = getActiveAccounts(false).map(a => `${a.id}: ${a.nama} (${a.tipe})`).join(', ');
  const cats = getActiveCategories(null, false).map(c => `${c.id}: ${c.nama} [${c.jenis}]`).join(', ');
  return `Tanggal hari ini: ${todayISO()}.
Daftar Rekening pengguna: [${accs}].
Daftar Kategori pengguna: [${cats}].`;
}

async function runQuickAiFill() {
  const text = (document.getElementById('quick-ai-input').value || '').trim();
  if (!text) {
    showToast('Tuliskan kalimat transaksi terlebih dahulu.', 'error');
    return;
  }
  const statusEl = document.getElementById('quick-ai-status');
  const btn = document.getElementById('btn-run-quick-ai');
  btn.disabled = true;
  statusEl.textContent = '⏳ AI sedang menganalisis kalimat Anda...';

  try {
    const sysPrompt = `Kamu adalah asisten pencatat keuangan Indonesia. Ekstrak input pengguna menjadi JSON murni tanpa markdown backticks.
${buildAiContextPrompt()}
Format JSON wajib:
{
  "jenis": "expense" | "income" | "transfer",
  "nominal": number,
  "tanggal": "YYYY-MM-DD",
  "kategoriId": "id kategori yang paling cocok atau kosong jika transfer",
  "rekeningId": "id rekening yang paling cocok (default rekening pertama jika tidak disebut)",
  "rekeningTujuanId": "id rekening tujuan jika transfer, selain itu kosong",
  "catatan": "deskripsi singkat transaksi"
}`;

    const reply = await callGroqChatCompletion([
      { role: 'system', content: sysPrompt },
      { role: 'user', content: text }
    ], 0.1);

    const jsonMatch = reply.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error('AI tidak mengembalikan format data yang valid.');
    const parsed = JSON.parse(jsonMatch[0]);

    closeModal('modal-quick-ai');
    document.getElementById('quick-ai-input').value = '';
    statusEl.textContent = '';

    openTransactionModal({
      jenis: parsed.jenis || 'expense',
      nominal: Number(parsed.nominal || 0),
      tanggal: parsed.tanggal || todayISO(),
      kategoriId: parsed.kategoriId || '',
      rekeningId: parsed.rekeningId || getActiveAccounts(false)[0]?.id || '',
      rekeningTujuanId: parsed.rekeningTujuanId || '',
      catatan: parsed.catatan || text
    });
    showToast('Form berhasil diisi AI! Silakan periksa sebelum menyimpan.', 'success');
  } catch (err) {
    statusEl.textContent = '❌ ' + err.message;
  } finally {
    btn.disabled = false;
  }
}

function renderAiChatMessages() {
  const container = document.getElementById('ai-chat-messages');
  if (aiChatHistory.length === 0) {
    container.innerHTML = `<div class="chat-bubble ai">Halo! Ceritakan transaksi Anda (contoh: <em>"tadi beli bensin 30rb pakai DANA"</em> atau <em>"beli makan siang"</em>). Jika nominal atau rekening belum jelas, saya akan bertanya balik sebelum menyiapkan draft transaksi.</div>`;
    return;
  }

  container.innerHTML = aiChatHistory.map((msg, idx) => {
    if (msg.role === 'user') {
      return `<div class="chat-bubble user">${escapeHTML(msg.content)}</div>`;
    }
    const cleanText = msg.content.replace(/<tx_draft>[\s\S]*?<\/tx_draft>/g, '').trim();
    let draftHtml = '';
    if (msg.draft) {
      const d = msg.draft;
      const jenisLabel = d.jenis === 'income' ? 'Pemasukan' : (d.jenis === 'transfer' ? 'Transfer' : 'Pengeluaran');
      const rekLabel = d.jenis === 'transfer'
        ? `${getAccountName(d.rekeningId)} → ${getAccountName(d.rekeningTujuanId)}`
        : getAccountName(d.rekeningId);
      const catLabel = d.jenis === 'transfer' ? '-' : getCategoryObj(d.kategoriId).nama;
      draftHtml = `<div class="ai-draft-card">
        <div style="font-weight:800;margin-bottom:4px;">📋 Draft Transaksi Siap</div>
        <div>Jenis: <strong>${jenisLabel}</strong> • Nominal: <strong>${formatRupiah(d.nominal)}</strong></div>
        <div>Rekening: <strong>${escapeHTML(rekLabel)}</strong> • Kategori: <strong>${escapeHTML(catLabel)}</strong></div>
        <div>Tanggal: ${formatDateID(d.tanggal)} • Catatan: ${escapeHTML(d.catatan || '-')}</div>
        <div class="flex-gap mt-12">
          <button type="button" class="btn btn-sm" onclick="inspectAiDraft(${idx})">🔍 Periksa di Form</button>
          <button type="button" class="btn btn-sm btn-primary" onclick="saveAiDraftDirectly(${idx})">✅ Simpan Langsung</button>
        </div>
      </div>`;
    }
    return `<div class="chat-bubble ai">${escapeHTML(cleanText)}${draftHtml}</div>`;
  }).join('');
  container.scrollTop = container.scrollHeight;
}

window.inspectAiDraft = function (idx) {
  const msg = aiChatHistory[idx];
  if (!msg || !msg.draft) return;
  closeModal('modal-chat-ai');
  openTransactionModal(msg.draft);
};

window.saveAiDraftDirectly = function (idx) {
  const msg = aiChatHistory[idx];
  if (!msg || !msg.draft) return;
  const d = msg.draft;
  state.transactions.push({
    id: uid('tx'),
    tanggal: d.tanggal || todayISO(),
    jenis: d.jenis || 'expense',
    nominal: Number(d.nominal || 0),
    kategoriId: d.jenis === 'transfer' ? '' : (d.kategoriId || getActiveCategories(d.jenis)[0]?.id || ''),
    rekeningId: d.rekeningId || getActiveAccounts(false)[0]?.id || '',
    rekeningTujuanId: d.jenis === 'transfer' ? (d.rekeningTujuanId || '') : '',
    catatan: d.catatan || 'Transaksi via Chat AI',
    sumber: 'ai-chat',
    linkedDebtId: '',
    updatedAt: new Date().toISOString(),
    deleted: false
  });
  saveState();
  renderAll();
  showToast('Draft transaksi berhasil disimpan langsung!', 'success');
};

async function handleAiChatSubmit(e) {
  e.preventDefault();
  const input = document.getElementById('ai-chat-input');
  const text = (input.value || '').trim();
  if (!text) return;

  aiChatHistory.push({ role: 'user', content: text });
  input.value = '';
  renderAiChatMessages();

  const btn = document.getElementById('btn-send-ai-chat');
  btn.disabled = true;

  try {
    const sysPrompt = `Kamu adalah asisten keuangan pribadi Indonesia yang ramah dan ringkas.
Tugasmu membantu pengguna mencatat transaksi keuangan melalui percakapan.
${buildAiContextPrompt()}
Aturan penting:
1. Jika nominal atau jenis transaksi (pemasukan/pengeluaran/transfer) atau rekening sumber belum jelas dari percakapan, tanyakan balik secara singkat dan sopan.
2. Jika informasi sudah cukup jelas (minimal jenis, nominal > 0, dan rekening sudah diketahui/dapat dipastikan), berikan konfirmasi singkat dan sertakan blok JSON di akhir pesan dengan tag persis:
<tx_draft>{"jenis":"expense","nominal":25000,"tanggal":"${todayISO()}","kategoriId":"cat_makan","rekeningId":"acc_gopay","rekeningTujuanId":"","catatan":"Makan siang"}</tx_draft>`;

    const apiMessages = [
      { role: 'system', content: sysPrompt },
      ...aiChatHistory.map(m => ({ role: m.role, content: m.content }))
    ];

    const reply = await callGroqChatCompletion(apiMessages, 0.25);
    let draft = null;
    const match = reply.match(/<tx_draft>([\s\S]*?)<\/tx_draft>/);
    if (match) {
      try {
        draft = JSON.parse(match[1]);
      } catch (err) {
        console.warn('Gagal parse draft JSON:', err);
      }
    }
    aiChatHistory.push({ role: 'assistant', content: reply, draft });
    renderAiChatMessages();
  } catch (err) {
    aiChatHistory.push({ role: 'assistant', content: '❌ ' + err.message });
    renderAiChatMessages();
  } finally {
    btn.disabled = false;
  }
}

/* ==========================================================================
   Tab 3: Manajemen Hutang & Piutang + Cicilan + Integrasi Saldo Kas
   ========================================================================== */

function getKnownContacts() {
  const set = new Set();
  state.debtsReceivables.forEach(d => {
    if (!d.deleted && d.kontak) set.add(d.kontak.trim());
  });
  return Array.from(set).sort((a, b) => a.localeCompare(b));
}

function renderDebtsTab() {
  const allActiveItems = state.debtsReceivables.filter(d => !d.deleted);
  allActiveItems.forEach(d => {
    d.status = computeDebtStatus(d);
  });

  const activeHutang = allActiveItems.filter(d => d.jenis === 'hutang' && d.status !== 'Lunas');
  const activePiutang = allActiveItems.filter(d => d.jenis === 'piutang' && d.status !== 'Lunas');

  const sumHutang = activeHutang.reduce((s, d) => s + Number(d.sisaTagihan || 0), 0);
  const sumPiutang = activePiutang.reduce((s, d) => s + Number(d.sisaTagihan || 0), 0);
  const netBalance = sumPiutang - sumHutang;

  document.getElementById('debt-kpi-hutang').textContent = formatRupiah(sumHutang);
  document.getElementById('debt-kpi-hutang-sub').textContent = `${activeHutang.length} kewajiban aktif`;
  document.getElementById('debt-kpi-piutang').textContent = formatRupiah(sumPiutang);
  document.getElementById('debt-kpi-piutang-sub').textContent = `${activePiutang.length} tagihan aktif`;
  const netEl = document.getElementById('debt-kpi-net');
  netEl.textContent = formatRupiah(netBalance);
  netEl.className = `kpi-value ${netBalance >= 0 ? 'text-success' : 'text-danger'}`;

  const search = (document.getElementById('debt-filter-search').value || '').toLowerCase().trim();
  const typeFilter = document.getElementById('debt-filter-type').value;
  const statusFilter = document.getElementById('debt-filter-status').value;
  const sortBy = document.getElementById('debt-sort-by').value;

  let filtered = allActiveItems.filter(d => {
    if (typeFilter !== 'all' && d.jenis !== typeFilter) return false;
    if (statusFilter === 'active' && d.status === 'Lunas') return false;
    if (statusFilter !== 'all' && statusFilter !== 'active' && d.status !== statusFilter) return false;
    if (search) {
      const k = (d.kontak || '').toLowerCase();
      const c = (d.catatan || '').toLowerCase();
      if (!k.includes(search) && !c.includes(search)) return false;
    }
    return true;
  });

  filtered.sort((a, b) => {
    if (sortBy === 'due_asc') {
      const da = a.tanggalJatuhTempo || '9999-12-31';
      const db = b.tanggalJatuhTempo || '9999-12-31';
      return da.localeCompare(db);
    }
    if (sortBy === 'remaining_desc') {
      return Number(b.sisaTagihan || 0) - Number(a.sisaTagihan || 0);
    }
    return (b.tanggalTransaksi || '').localeCompare(a.tanggalTransaksi || '');
  });

  const container = document.getElementById('debts-list');
  if (filtered.length === 0) {
    container.innerHTML = `<div class="text-muted" style="text-align:center;padding:24px;">Tidak ada data hutang/piutang yang sesuai filter.</div>`;
    return;
  }

  container.innerHTML = filtered.map(d => {
    const isHutang = d.jenis === 'hutang';
    const typeBadge = isHutang
      ? '<span class="badge badge-danger">HUTANG (Payable)</span>'
      : '<span class="badge badge-success">PIUTANG (Receivable)</span>';

    let statusBadge = '<span class="badge badge-warning">Belum Lunas</span>';
    if (d.status === 'Lunas') statusBadge = '<span class="badge badge-success">Lunas</span>';
    else if (d.status === 'Dicicil') statusBadge = '<span class="badge badge-info">Dicicil</span>';
    else if (d.status === 'Jatuh Tempo') statusBadge = '<span class="badge badge-danger">Jatuh Tempo</span>';

    const pct = d.nominalPokok > 0 ? Math.min(100, Math.round((d.terbayar / d.nominalPokok) * 100)) : 0;
    const payments = state.debtPayments
      .filter(p => p.debtId === d.id && !p.deleted)
      .sort((a, b) => (b.tanggalBayar || '').localeCompare(a.tanggalBayar || ''));

    const walletNote = d.pengaruhiSaldo
      ? `<span class="badge badge-neutral">💳 Kas: ${escapeHTML(getAccountName(d.rekeningId))}</span>`
      : `<span class="badge badge-neutral">📝 Hanya Catatan</span>`;

    const historyHtml = payments.length > 0
      ? `<div class="installment-history">
          <div style="font-weight:700;margin-bottom:6px;">📜 Riwayat Pembayaran / Cicilan (${payments.length}x):</div>
          ${payments.map(p => `
            <div class="flex-between" style="padding:4px 0;border-bottom:1px solid var(--border);">
              <span>${formatDateID(p.tanggalBayar)} • <strong>${formatRupiah(p.nominalBayar)}</strong> ${p.catatan ? `(${escapeHTML(p.catatan)})` : ''} ${p.pengaruhiSaldo ? `[${escapeHTML(getAccountName(p.rekeningId))}]` : ''}</span>
              <button type="button" class="btn btn-icon btn-sm btn-danger" onclick="deleteDebtPayment('${p.id}')" title="Hapus Cicilan">✕</button>
            </div>
          `).join('')}
        </div>`
      : '';

    return `<div class="debt-item ${d.status === 'Jatuh Tempo' ? 'overdue' : ''}">
      <div class="debt-top">
        <div>
          <div class="flex-gap">
            ${typeBadge}
            ${statusBadge}
            ${walletNote}
          </div>
          <div style="font-size:17px;font-weight:800;margin-top:6px;">${escapeHTML(d.kontak)}</div>
          <div class="text-muted" style="font-size:12.5px;">${escapeHTML(d.catatan || 'Tanpa catatan tambahan')}</div>
        </div>
        <div class="debt-actions">
          ${d.status !== 'Lunas' ? `<button type="button" class="btn btn-primary btn-sm" onclick="openDebtPayModal('${d.id}')">💳 Bayar / Cicil</button>` : ''}
          <button type="button" class="btn btn-sm" onclick="editDebtItem('${d.id}')">✏️ Edit</button>
          <button type="button" class="btn btn-sm btn-danger" onclick="deleteDebtItem('${d.id}')">🗑️</button>
        </div>
      </div>

      <div class="debt-meta">
        <div><span class="text-muted">Nominal Pokok</span><br/><strong>${formatRupiah(d.nominalPokok)}</strong></div>
        <div><span class="text-muted">Sudah Dibayar</span><br/><strong class="text-success">${formatRupiah(d.terbayar)} (${pct}%)</strong></div>
        <div><span class="text-muted">Sisa Tagihan</span><br/><strong class="text-danger">${formatRupiah(d.sisaTagihan)}</strong></div>
        <div><span class="text-muted">Tgl Pinjam / Jatuh Tempo</span><br/><strong>${formatDateID(d.tanggalTransaksi)}</strong> → <strong class="${d.status === 'Jatuh Tempo' ? 'text-danger' : ''}">${formatDateID(d.tanggalJatuhTempo)}</strong></div>
      </div>

      <div class="progress-track">
        <div class="progress-fill" style="width:${pct}%;background:${d.status === 'Lunas' ? 'var(--success)' : 'var(--primary)'};"></div>
      </div>

      ${historyHtml}
    </div>`;
  }).join('');
}

function openDebtModal(item = null) {
  const form = document.getElementById('form-debt');
  form.reset();
  document.getElementById('debt-id').value = item?.id || '';
  document.getElementById('modal-debt-title').textContent = item ? 'Edit Hutang / Piutang' : 'Catat Hutang / Piutang';

  const datalist = document.getElementById('debt-contacts-datalist');
  datalist.innerHTML = getKnownContacts().map(c => `<option value="${escapeHTML(c)}"></option>`).join('');

  populateAccountSelect(document.getElementById('debt-rekening'));

  document.getElementById('debt-jenis').value = item?.jenis || 'hutang';
  document.getElementById('debt-kontak').value = item?.kontak || '';
  document.getElementById('debt-nominal').value = item?.nominalPokok || '';
  document.getElementById('debt-tgl-tx').value = item?.tanggalTransaksi || todayISO();
  document.getElementById('debt-tgl-tempo').value = item?.tanggalJatuhTempo || '';
  document.getElementById('debt-catatan').value = item?.catatan || '';

  const affect = Boolean(item?.pengaruhiSaldo);
  document.getElementById('debt-affect-wallet').checked = affect;
  document.getElementById('debt-wallet-select-wrap').style.display = affect ? 'flex' : 'none';
  if (item?.rekeningId) document.getElementById('debt-rekening').value = item.rekeningId;

  openModal('modal-debt');
}

window.editDebtItem = function (id) {
  const item = state.debtsReceivables.find(d => d.id === id && !d.deleted);
  if (item) openDebtModal(item);
};

window.deleteDebtItem = function (id) {
  if (!confirm('Hapus catatan hutang/piutang ini beserta riwayat cicilannya?')) return;
  const nowIso = new Date().toISOString();
  const item = state.debtsReceivables.find(d => d.id === id);
  if (item) {
    item.deleted = true;
    item.updatedAt = nowIso;
    if (item.linkedTxId) {
      const ltx = state.transactions.find(t => t.id === item.linkedTxId);
      if (ltx) { ltx.deleted = true; ltx.updatedAt = nowIso; }
    }
  }
  state.debtPayments.forEach(p => {
    if (p.debtId === id && !p.deleted) {
      p.deleted = true;
      p.updatedAt = nowIso;
      if (p.linkedTxId) {
        const ptx = state.transactions.find(t => t.id === p.linkedTxId);
        if (ptx) { ptx.deleted = true; ptx.updatedAt = nowIso; }
      }
    }
  });
  saveState();
  renderAll();
  showToast('Catatan hutang/piutang dihapus', 'success');
};

window.openDebtPayModal = function (debtId) {
  const item = state.debtsReceivables.find(d => d.id === debtId && !d.deleted);
  if (!item) return;
  recalculateDebtItem(debtId);

  document.getElementById('pay-debt-id').value = item.id;
  document.getElementById('modal-pay-title').textContent = item.jenis === 'hutang'
    ? 'Bayar / Cicil Hutang'
    : 'Terima Pembayaran / Cicilan Piutang';
  document.getElementById('pay-info-kontak').textContent = item.kontak;
  document.getElementById('pay-info-pokok').textContent = formatRupiah(item.nominalPokok);
  document.getElementById('pay-info-paid').textContent = formatRupiah(item.terbayar);
  document.getElementById('pay-info-remaining').textContent = formatRupiah(item.sisaTagihan);

  document.getElementById('pay-nominal').value = item.sisaTagihan;
  document.getElementById('pay-nominal').max = item.sisaTagihan;
  document.getElementById('pay-tanggal').value = todayISO();
  document.getElementById('pay-catatan').value = '';

  populateAccountSelect(document.getElementById('pay-rekening'));
  const affect = Boolean(item.pengaruhiSaldo);
  document.getElementById('pay-affect-wallet').checked = affect;
  document.getElementById('pay-wallet-wrap').style.display = affect ? 'flex' : 'none';
  if (item.rekeningId) document.getElementById('pay-rekening').value = item.rekeningId;

  openModal('modal-debt-pay');
};

window.deleteDebtPayment = function (paymentId) {
  if (!confirm('Hapus riwayat cicilan ini? Sisa tagihan akan dihitung ulang.')) return;
  const pay = state.debtPayments.find(p => p.id === paymentId);
  if (!pay) return;
  const nowIso = new Date().toISOString();
  pay.deleted = true;
  pay.updatedAt = nowIso;
  if (pay.linkedTxId) {
    const ltx = state.transactions.find(t => t.id === pay.linkedTxId);
    if (ltx) { ltx.deleted = true; ltx.updatedAt = nowIso; }
  }
  recalculateDebtItem(pay.debtId);
  saveState();
  renderAll();
  showToast('Riwayat cicilan dihapus & sisa tagihan diperbarui', 'success');
};

/* ==========================================================================
   Tab 4: Budget Bulanan & Transaksi Berulang
   ========================================================================== */

function renderBudgetAndRecurringTab() {
  const monthPicker = document.getElementById('budget-month-picker');
  if (!monthPicker.value) monthPicker.value = currentMonthISO();
  const selectedMonth = monthPicker.value;

  const monthExpenses = getActiveTransactions().filter(t => t.jenis === 'expense' && (t.tanggal || '').startsWith(selectedMonth));
  const budgets = state.budgets.filter(b => !b.deleted && b.bulan === selectedMonth);

  const bdgListEl = document.getElementById('budget-list');
  if (budgets.length === 0) {
    bdgListEl.innerHTML = `<div class="text-muted" style="padding:16px;text-align:center;">Belum ada budget untuk bulan ${selectedMonth}. Klik "+ Atur Budget" untuk menambahkan.</div>`;
  } else {
    bdgListEl.innerHTML = budgets.map(b => {
      const cat = getCategoryObj(b.kategoriId);
      const spent = monthExpenses
        .filter(t => t.kategoriId === b.kategoriId)
        .reduce((s, t) => s + Number(t.nominal || 0), 0);
      const limit = Number(b.limitNominal || 1);
      const sisa = limit - spent;
      const pct = Math.min(100, Math.round((spent / limit) * 100));
      const realPct = Math.round((spent / limit) * 100);

      let statusBadge = '<span class="badge badge-success">Aman</span>';
      let barColor = 'var(--success)';
      if (realPct > 100) {
        statusBadge = '<span class="badge badge-danger">Terlampaui</span>';
        barColor = 'var(--danger)';
      } else if (realPct >= 80) {
        statusBadge = '<span class="badge badge-warning">Hampir Penuh</span>';
        barColor = 'var(--warning)';
      }

      return `<div style="padding:12px;border:1px solid var(--border);border-radius:12px;background:var(--surface-2);">
        <div class="flex-between">
          <div>
            <strong>${escapeHTML(cat.ikon)} ${escapeHTML(cat.nama)}</strong> ${statusBadge}
            <div class="text-muted" style="font-size:12px;margin-top:2px;">
              Terpakai: <strong>${formatRupiah(spent)}</strong> dari ${formatRupiah(limit)} (${realPct}%) • Sisa: <strong class="${sisa < 0 ? 'text-danger' : 'text-success'}">${formatRupiah(sisa)}</strong>
            </div>
          </div>
          <div class="flex-gap">
            <button type="button" class="btn btn-icon btn-sm" onclick="editBudget('${b.id}')">✏️</button>
            <button type="button" class="btn btn-icon btn-sm btn-danger" onclick="deleteBudget('${b.id}')">🗑️</button>
          </div>
        </div>
        <div class="progress-track mt-12">
          <div class="progress-fill" style="width:${pct}%;background:${barColor};"></div>
        </div>
      </div>`;
    }).join('');
  }

  // Recurring Rules
  const recListEl = document.getElementById('recurring-list');
  const rules = state.recurringRules.filter(r => !r.deleted);
  if (rules.length === 0) {
    recListEl.innerHTML = `<div class="text-muted" style="padding:16px;text-align:center;">Belum ada aturan transaksi berulang.</div>`;
  } else {
    const freqMap = { daily: 'Harian', weekly: 'Mingguan', monthly: 'Bulanan', yearly: 'Tahunan' };
    recListEl.innerHTML = rules.map(r => {
      const cat = r.jenis === 'transfer' ? { ikon: '🔄', nama: 'Transfer' } : getCategoryObj(r.kategoriId);
      const statusPill = r.aktif !== false
        ? '<span class="badge badge-success">Aktif</span>'
        : '<span class="badge badge-neutral">Nonaktif / Selesai</span>';
      return `<div style="padding:12px;border:1px solid var(--border);border-radius:12px;background:var(--surface-2);">
        <div class="flex-between">
          <div>
            <strong>${escapeHTML(r.catatan)}</strong> ${statusPill}
            <div class="text-muted" style="font-size:12px;margin-top:3px;">
              ${escapeHTML(cat.ikon)} ${escapeHTML(cat.nama)} • <strong>${formatRupiah(r.nominal)}</strong> (${getAccountName(r.rekeningId)})
            </div>
            <div class="text-muted" style="font-size:11.5px;margin-top:2px;">
              Setiap ${r.interval} ${freqMap[r.frekuensi] || r.frekuensi} • Berikutnya: <strong>${formatDateID(r.berikutnya)}</strong> ${r.tanggalSelesai ? `(s/d ${formatDateID(r.tanggalSelesai)})` : ''}
            </div>
          </div>
          <div class="flex-gap">
            <button type="button" class="btn btn-sm" onclick="toggleRecurringActive('${r.id}')">${r.aktif !== false ? 'Jeda' : 'Aktifkan'}</button>
            <button type="button" class="btn btn-icon btn-sm btn-danger" onclick="deleteRecurring('${r.id}')">🗑️</button>
          </div>
        </div>
      </div>`;
    }).join('');
  }
}

window.editBudget = function (id) {
  const b = state.budgets.find(x => x.id === id && !x.deleted);
  if (!b) return;
  document.getElementById('budget-id').value = b.id;
  document.getElementById('budget-bulan').value = b.bulan;
  populateCategorySelect(document.getElementById('budget-kategori'), { jenis: 'expense' });
  document.getElementById('budget-kategori').value = b.kategoriId;
  document.getElementById('budget-limit').value = b.limitNominal;
  openModal('modal-budget');
};

window.deleteBudget = function (id) {
  if (!confirm('Hapus budget ini?')) return;
  const b = state.budgets.find(x => x.id === id);
  if (b) { b.deleted = true; b.updatedAt = new Date().toISOString(); }
  saveState();
  renderAll();
  showToast('Budget dihapus', 'success');
};

window.toggleRecurringActive = function (id) {
  const r = state.recurringRules.find(x => x.id === id);
  if (!r) return;
  r.aktif = r.aktif === false ? true : false;
  r.updatedAt = new Date().toISOString();
  saveState();
  renderBudgetAndRecurringTab();
};

window.deleteRecurring = function (id) {
  if (!confirm('Hapus aturan transaksi berulang ini?')) return;
  const r = state.recurringRules.find(x => x.id === id);
  if (r) { r.deleted = true; r.updatedAt = new Date().toISOString(); }
  saveState();
  renderBudgetAndRecurringTab();
  showToast('Aturan transaksi berulang dihapus', 'success');
};

/* ==========================================================================
   Tab 5: Laporan + Ekspor PDF & CSV
   ========================================================================== */

function getFilteredReportData() {
  const period = document.getElementById('report-period').value;
  const type = document.getElementById('report-type').value;
  const account = document.getElementById('report-account').value;
  const today = todayISO();
  let start = today;
  let end = today;

  if (period === 'weekly') {
    const d = new Date();
    d.setDate(d.getDate() - 6);
    start = d.toISOString().slice(0, 10);
  } else if (period === 'monthly') {
    start = `${today.slice(0, 7)}-01`;
  } else if (period === 'yearly') {
    start = `${today.slice(0, 4)}-01-01`;
  } else if (period === 'custom') {
    start = document.getElementById('report-start').value || '1970-01-01';
    end = document.getElementById('report-end').value || '2999-12-31';
  }

  const txs = getActiveTransactions().filter(t => {
    if (t.tanggal < start || t.tanggal > end) return false;
    if (type !== 'all' && t.jenis !== type) return false;
    if (account !== 'all' && t.rekeningId !== account && t.rekeningTujuanId !== account) return false;
    return true;
  }).sort((a, b) => (b.tanggal || '').localeCompare(a.tanggal || ''));

  return { period, start, end, type, account, txs };
}

function renderReportsTab() {
  populateAccountSelect(document.getElementById('report-account'), { includeAll: true, includeArchived: true });
  const period = document.getElementById('report-period').value;
  const isCustom = period === 'custom';
  document.getElementById('report-custom-start-wrap').style.display = isCustom ? 'flex' : 'none';
  document.getElementById('report-custom-end-wrap').style.display = isCustom ? 'flex' : 'none';

  const { txs } = getFilteredReportData();
  let income = 0, expense = 0;
  const catSummary = {};

  txs.forEach(t => {
    const nom = Number(t.nominal || 0);
    if (t.jenis === 'income') income += nom;
    else if (t.jenis === 'expense') expense += nom;

    const key = t.jenis === 'transfer' ? 'transfer' : (t.kategoriId || 'uncat');
    if (!catSummary[key]) {
      const cat = t.jenis === 'transfer' ? { nama: 'Transfer Antar Rekening', ikon: '🔄', jenis: 'transfer' } : getCategoryObj(t.kategoriId);
      catSummary[key] = { nama: `${cat.ikon} ${cat.nama}`, jenis: t.jenis, total: 0 };
    }
    catSummary[key].total += nom;
  });

  const net = income - expense;
  document.getElementById('rep-income').textContent = formatRupiah(income);
  document.getElementById('rep-expense').textContent = formatRupiah(expense);
  const netEl = document.getElementById('rep-net');
  netEl.textContent = formatRupiah(net);
  netEl.className = `kpi-value ${net >= 0 ? 'text-success' : 'text-danger'}`;
  document.getElementById('rep-count').textContent = String(txs.length);

  const catBody = document.getElementById('rep-cat-body');
  const catRows = Object.values(catSummary).sort((a, b) => b.total - a.total);
  catBody.innerHTML = catRows.length
    ? catRows.map(r => `<tr>
        <td>${escapeHTML(r.nama)}</td>
        <td>${r.jenis === 'income' ? 'Pemasukan' : (r.jenis === 'expense' ? 'Pengeluaran' : 'Transfer')}</td>
        <td style="text-align:right;font-weight:700;">${formatRupiah(r.total)}</td>
      </tr>`).join('')
    : `<tr><td colspan="3" class="text-muted" style="text-align:center;">Tidak ada data</td></tr>`;

  const txBody = document.getElementById('rep-tx-body');
  txBody.innerHTML = txs.length
    ? txs.map(t => {
        const cat = t.jenis === 'transfer' ? { ikon: '🔄', nama: 'Transfer' } : getCategoryObj(t.kategoriId);
        const cls = t.jenis === 'income' ? 'text-success' : (t.jenis === 'expense' ? 'text-danger' : 'text-info');
        return `<tr>
          <td>${formatDateID(t.tanggal)}</td>
          <td>${escapeHTML(cat.ikon)} ${escapeHTML(cat.nama)}<br/><small class="text-muted">${escapeHTML(t.catatan || '')}</small></td>
          <td>${escapeHTML(getAccountName(t.rekeningId))}</td>
          <td style="text-align:right;font-weight:700;" class="${cls}">${formatRupiah(t.nominal)}</td>
        </tr>`;
      }).join('')
    : `<tr><td colspan="4" class="text-muted" style="text-align:center;">Tidak ada transaksi pada periode ini</td></tr>`;
}

function exportTransactionsToCSV(txs, filename = 'laporan-keuangan.csv') {
  const headers = ['ID', 'Tanggal', 'Jenis', 'Kategori', 'Rekening', 'Rekening_Tujuan', 'Nominal', 'Catatan'];
  const rows = txs.map(t => {
    const catName = t.jenis === 'transfer' ? 'Transfer' : getCategoryObj(t.kategoriId).nama;
    const rekName = state.accounts.find(a => a.id === t.rekeningId)?.nama || '';
    const rekTujuan = state.accounts.find(a => a.id === t.rekeningTujuanId)?.nama || '';
    return [
      t.id,
      t.tanggal,
      t.jenis,
      catName,
      rekName,
      rekTujuan,
      Number(t.nominal || 0),
      (t.catatan || '').replace(/"/g, '""')
    ].map(v => `"${v}"`).join(',');
  });
  const csvContent = '\uFEFF' + [headers.join(','), ...rows].join('\n');
  triggerDownload(csvContent, filename, 'text/csv;charset=utf-8;');
  showToast(`File ${filename} berhasil diunduh!`, 'success');
}

function exportReportToPDF() {
  const { start, end, txs } = getFilteredReportData();
  let income = 0, expense = 0;
  txs.forEach(t => {
    if (t.jenis === 'income') income += Number(t.nominal || 0);
    else if (t.jenis === 'expense') expense += Number(t.nominal || 0);
  });
  const net = income - expense;
  const userName = escapeHTML(state.profile.name || 'Pengguna DompetKu');
  const avatarHtml = state.profile.photoDataUrl
    ? `<img src="${state.profile.photoDataUrl}" style="width:48px;height:48px;border-radius:50%;object-fit:cover;border:2px solid #0f766e;" />`
    : `<div style="width:48px;height:48px;border-radius:50%;background:#0f766e;color:#fff;display:flex;align-items:center;justify-content:center;font-weight:bold;font-size:20px;">${userName.charAt(0).toUpperCase()}</div>`;

  const rowsHtml = txs.map(t => {
    const catName = t.jenis === 'transfer' ? 'Transfer Rekening' : getCategoryObj(t.kategoriId).nama;
    const rekName = t.jenis === 'transfer'
      ? `${getAccountName(t.rekeningId)} → ${getAccountName(t.rekeningTujuanId)}`
      : getAccountName(t.rekeningId);
    const color = t.jenis === 'income' ? '#059669' : (t.jenis === 'expense' ? '#dc2626' : '#2563eb');
    return `<tr>
      <td>${formatDateID(t.tanggal)}</td>
      <td>${escapeHTML(catName)}</td>
      <td>${escapeHTML(rekName)}</td>
      <td>${escapeHTML(t.catatan || '-')}</td>
      <td style="text-align:right;font-weight:700;color:${color};">${formatRupiah(t.nominal)}</td>
    </tr>`;
  }).join('');

  const html = `<!DOCTYPE html>
  <html lang="id">
  <head>
    <meta charset="UTF-8" />
    <title>Laporan Keuangan - ${userName}</title>
    <style>
      @page { size: A4 portrait; margin: 14mm; }
      body { font-family: Arial, Helvetica, sans-serif; color: #0f172a; font-size: 12px; margin: 0; }
      .header { display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #0f766e; padding-bottom: 12px; margin-bottom: 16px; }
      .user-box { display: flex; align-items: center; gap: 12px; }
      .kpis { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; margin-bottom: 18px; }
      .kpi { border: 1px solid #cbd5e1; border-radius: 8px; padding: 10px; background: #f8fafc; }
      .kpi-lbl { font-size: 10px; color: #64748b; text-transform: uppercase; }
      .kpi-val { font-size: 15px; font-weight: 800; margin-top: 4px; }
      table { width: 100%; border-collapse: collapse; }
      th { background: #0f766e; color: #fff; text-align: left; padding: 7px 8px; font-size: 11px; }
      td { border-bottom: 1px solid #e2e8f0; padding: 6px 8px; }
      tr { break-inside: avoid; }
    </style>
  </head>
  <body>
    <div class="header">
      <div class="user-box">
        ${avatarHtml}
        <div>
          <div style="font-size:17px;font-weight:800;color:#0f766e;">Laporan Keuangan Pribadi</div>
          <div style="font-weight:700;">${userName}</div>
        </div>
      </div>
      <div style="text-align:right;font-size:11px;color:#475569;">
        <div><strong>Periode:</strong> ${formatDateID(start)} s/d ${formatDateID(end)}</div>
        <div>Dicetak: ${new Date().toLocaleString('id-ID')}</div>
      </div>
    </div>
    <div class="kpis">
      <div class="kpi"><div class="kpi-lbl">Total Pemasukan</div><div class="kpi-val" style="color:#059669;">${formatRupiah(income)}</div></div>
      <div class="kpi"><div class="kpi-lbl">Total Pengeluaran</div><div class="kpi-val" style="color:#dc2626;">${formatRupiah(expense)}</div></div>
      <div class="kpi"><div class="kpi-lbl">Selisih Bersih</div><div class="kpi-val" style="color:${net >= 0 ? '#059669' : '#dc2626'};">${formatRupiah(net)}</div></div>
    </div>
    <table>
      <thead>
        <tr>
          <th>Tanggal</th>
          <th>Kategori</th>
          <th>Rekening</th>
          <th>Catatan</th>
          <th style="text-align:right;">Nominal</th>
        </tr>
      </thead>
      <tbody>${rowsHtml || '<tr><td colspan="5" style="text-align:center;">Tidak ada transaksi</td></tr>'}</tbody>
    </table>
  </body>
  </html>`;

  const iframe = document.createElement('iframe');
  iframe.style.position = 'fixed';
  iframe.style.right = '0';
  iframe.style.bottom = '0';
  iframe.style.width = '0';
  iframe.style.height = '0';
  iframe.style.border = '0';
  document.body.appendChild(iframe);
  iframe.contentDocument.open();
  iframe.contentDocument.write(html);
  iframe.contentDocument.close();
  setTimeout(() => {
    iframe.contentWindow.focus();
    iframe.contentWindow.print();
    setTimeout(() => iframe.remove(), 2000);
  }, 300);
}

/* ==========================================================================
   Tab 6: Pengaturan (Master Data, Backup JSON v2 & v1 Restore, Groq Models)
   ========================================================================== */

function renderSettingsTab() {
  document.getElementById('input-gas-url').value = state.settings.gasUrl || '';
  document.getElementById('toggle-auto-sync').checked = state.settings.autoSync !== false;
  document.getElementById('input-groq-key').value = state.settings.groqApiKey || '';
  const modelSel = document.getElementById('select-groq-model');
  if (state.settings.groqModel && !Array.from(modelSel.options).some(o => o.value === state.settings.groqModel)) {
    const opt = document.createElement('option');
    opt.value = state.settings.groqModel;
    opt.textContent = state.settings.groqModel;
    modelSel.appendChild(opt);
  }
  modelSel.value = state.settings.groqModel || 'llama-3.3-70b-versatile';
  if (state.settings.lastSyncAt) {
    document.getElementById('last-sync-info').textContent = `Sinkronisasi terakhir: ${state.settings.lastSyncAt}`;
  }

  updateSecurityUI();

  // Master Accounts
  const accList = state.accounts.filter(a => !a.deleted);
  document.getElementById('master-accounts-list').innerHTML = accList.map(a => `
    <div class="flex-between" style="padding:9px 12px;border:1px solid var(--border);border-radius:10px;background:var(--surface-2);opacity:${a.arsip ? '0.6' : '1'};">
      <div>
        <strong>${escapeHTML(a.ikon)} ${escapeHTML(a.nama)}</strong> <span class="badge badge-neutral">${escapeHTML(a.tipe)}</span> ${a.arsip ? '<span class="badge badge-warning">Arsip</span>' : ''}
        <div class="text-muted" style="font-size:12px;">Saldo Awal: ${formatRupiah(a.saldoAwal)} • Saldo Kini: <strong>${formatRupiah(getAccountBalance(a.id))}</strong></div>
      </div>
      <div class="flex-gap">
        <button type="button" class="btn btn-icon btn-sm" onclick="editAccount('${a.id}')" title="Edit">✏️</button>
        <button type="button" class="btn btn-sm" onclick="toggleArchiveAccount('${a.id}')">${a.arsip ? 'Aktifkan' : 'Arsip'}</button>
        <button type="button" class="btn btn-icon btn-sm btn-danger" onclick="deleteAccount('${a.id}')" title="Hapus">🗑️</button>
      </div>
    </div>
  `).join('');

  // Master Categories
  const catList = state.categories.filter(c => !c.deleted);
  document.getElementById('master-categories-list').innerHTML = catList.map(c => `
    <div class="flex-between" style="padding:9px 12px;border:1px solid var(--border);border-radius:10px;background:var(--surface-2);opacity:${c.arsip ? '0.6' : '1'};">
      <div>
        <strong>${escapeHTML(c.ikon)} ${escapeHTML(c.nama)}</strong>
        <span class="badge ${c.jenis === 'income' ? 'badge-success' : 'badge-danger'}">${c.jenis === 'income' ? 'Pemasukan' : 'Pengeluaran'}</span>
        ${c.arsip ? '<span class="badge badge-warning">Arsip</span>' : ''}
      </div>
      <div class="flex-gap">
        <button type="button" class="btn btn-icon btn-sm" onclick="editCategory('${c.id}')" title="Edit">✏️</button>
        <button type="button" class="btn btn-sm" onclick="toggleArchiveCategory('${c.id}')">${c.arsip ? 'Aktifkan' : 'Arsip'}</button>
        <button type="button" class="btn btn-icon btn-sm btn-danger" onclick="deleteCategory('${c.id}')" title="Hapus">🗑️</button>
      </div>
    </div>
  `).join('');
}

window.editAccount = function (id) {
  const a = state.accounts.find(x => x.id === id);
  if (!a) return;
  document.getElementById('acc-id').value = a.id;
  document.getElementById('modal-acc-title').textContent = 'Edit Rekening';
  document.getElementById('acc-nama').value = a.nama;
  document.getElementById('acc-tipe').value = a.tipe;
  document.getElementById('acc-saldo-awal').value = a.saldoAwal;
  document.getElementById('acc-ikon').value = a.ikon || '💳';
  document.getElementById('acc-warna').value = a.warna || '#0f766e';
  openModal('modal-account');
};

window.toggleArchiveAccount = function (id) {
  const a = state.accounts.find(x => x.id === id);
  if (!a) return;
  a.arsip = !a.arsip;
  a.updatedAt = new Date().toISOString();
  saveState();
  renderAll();
  showToast(a.arsip ? 'Rekening diarsipkan' : 'Rekening diaktifkan kembali', 'success');
};

window.deleteAccount = function (id) {
  const used = getActiveTransactions().some(t => t.rekeningId === id || t.rekeningTujuanId === id);
  if (used) {
    showToast('Rekening masih dipakai di transaksi. Gunakan fitur Arsip agar riwayat tetap aman.', 'error');
    return;
  }
  if (!confirm('Hapus rekening ini?')) return;
  const a = state.accounts.find(x => x.id === id);
  if (a) { a.deleted = true; a.updatedAt = new Date().toISOString(); }
  saveState();
  renderAll();
  showToast('Rekening dihapus', 'success');
};

window.editCategory = function (id) {
  const c = state.categories.find(x => x.id === id);
  if (!c) return;
  document.getElementById('cat-id').value = c.id;
  document.getElementById('modal-cat-title').textContent = 'Edit Kategori';
  document.getElementById('cat-nama').value = c.nama;
  document.getElementById('cat-jenis').value = c.jenis;
  document.getElementById('cat-ikon').value = c.ikon || '🏷️';
  document.getElementById('cat-warna').value = c.warna || '#0d9488';
  openModal('modal-category');
};

window.toggleArchiveCategory = function (id) {
  const c = state.categories.find(x => x.id === id);
  if (!c) return;
  c.arsip = !c.arsip;
  c.updatedAt = new Date().toISOString();
  saveState();
  renderAll();
  showToast(c.arsip ? 'Kategori diarsipkan' : 'Kategori diaktifkan kembali', 'success');
};

window.deleteCategory = function (id) {
  const used = getActiveTransactions().some(t => t.kategoriId === id);
  if (used) {
    showToast('Kategori masih dipakai di transaksi. Gunakan fitur Arsip agar riwayat tetap aman.', 'error');
    return;
  }
  if (!confirm('Hapus kategori ini?')) return;
  const c = state.categories.find(x => x.id === id);
  if (c) { c.deleted = true; c.updatedAt = new Date().toISOString(); }
  saveState();
  renderAll();
  showToast('Kategori dihapus', 'success');
};

async function fetchActiveGroqModels() {
  const key = (document.getElementById('input-groq-key').value || state.settings.groqApiKey || '').trim();
  if (!key) {
    showToast('Masukkan Groq API Key terlebih dahulu.', 'error');
    return;
  }
  const btn = document.getElementById('btn-fetch-groq-models');
  btn.disabled = true;
  btn.textContent = '⏳ Memuat...';
  try {
    const res = await fetch('https://api.groq.com/openai/v1/models', {
      headers: { 'Authorization': `Bearer ${key}` }
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error?.message || 'Gagal mengambil daftar model');
    const models = (json.data || [])
      .map(m => m.id)
      .filter(id => !/whisper|tts|guard|embed/i.test(id))
      .sort();

    const sel = document.getElementById('select-groq-model');
    sel.innerHTML = models.map(m => `<option value="${escapeHTML(m)}">${escapeHTML(m)}</option>`).join('');
    if (models.includes('llama-3.3-70b-versatile')) sel.value = 'llama-3.3-70b-versatile';
    showToast(`Berhasil memuat ${models.length} model chat aktif dari Groq!`, 'success');
  } catch (err) {
    showToast('Gagal cek model Groq: ' + err.message, 'error');
  } finally {
    btn.disabled = false;
    btn.textContent = '🔍 Cek Model Groq';
  }
}

function exportBackupJsonV2() {
  const payload = {
    app: 'DompetKu-PWA',
    version: 2,
    exportedAt: new Date().toISOString(),
    data: {
      profile: state.profile,
      accounts: state.accounts,
      categories: state.categories,
      transactions: state.transactions,
      budgets: state.budgets,
      recurringRules: state.recurringRules,
      debtsReceivables: state.debtsReceivables,
      debtPayments: state.debtPayments
    }
  };
  const filename = `dompetku-backup-v2-${todayISO()}.json`;
  triggerDownload(JSON.stringify(payload, null, 2), filename, 'application/json');
  showToast('Backup JSON v2 berhasil diunduh!', 'success');
}

function importBackupJson(file) {
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const parsed = JSON.parse(reader.result);
      const detectedVer = parsed.version || 1;
      const src = parsed.data ? parsed.data : parsed;

      // Support both v2 and legacy v1 keys
      const migrated = normalizeState({
        version: 2,
        profile: src.profile || state.profile,
        settings: state.settings,
        accounts: src.accounts || src.rekening || [],
        categories: src.categories || src.kategori || [],
        transactions: src.transactions || src.transaksi || [],
        budgets: src.budgets || src.anggaran || [],
        recurringRules: src.recurringRules || src.recurring || src.berulang || [],
        debtsReceivables: src.debtsReceivables || src.hutangPiutang || [],
        debtPayments: src.debtPayments || src.riwayatCicilan || []
      });

      const ok = confirm(
        `Pulihkan backup versi ${detectedVer}?\n` +
        `• Rekening: ${migrated.accounts.length}\n` +
        `• Kategori: ${migrated.categories.length}\n` +
        `• Transaksi: ${migrated.transactions.length}\n` +
        `• Budget: ${migrated.budgets.length}\n` +
        `• Transaksi Berulang: ${migrated.recurringRules.length}\n` +
        `• Hutang/Piutang: ${migrated.debtsReceivables.length}`
      );
      if (!ok) return;

      state = migrated;
      saveState();
      updateProfileUI();
      renderAll();
      showToast(`Backup JSON v${detectedVer} berhasil dipulihkan!`, 'success');
    } catch (err) {
      showToast('File JSON tidak valid: ' + err.message, 'error');
    }
  };
  reader.readAsText(file);
}

function triggerDownload(content, filename, mime) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}

/* ==========================================================================
   Global Render & Event Listeners
   ========================================================================== */

function renderAll() {
  renderDashboard();
  renderTransactionsTab();
  renderDebtsTab();
  renderBudgetAndRecurringTab();
  renderReportsTab();
  renderSettingsTab();
}

function initEventListeners() {
  // Navigation tabs
  document.querySelectorAll('[data-tab]').forEach(btn => {
    btn.addEventListener('click', () => switchTab(btn.dataset.tab));
  });
  document.querySelectorAll('[data-goto-tab]').forEach(btn => {
    btn.addEventListener('click', () => switchTab(btn.dataset.gotoTab));
  });

  // Modal close buttons
  document.querySelectorAll('[data-close-modal]').forEach(btn => {
    btn.addEventListener('click', () => closeModal(btn.dataset.closeModal));
  });

  // Topbar & Sidebar actions
  document.getElementById('btn-open-tx-modal').addEventListener('click', () => openTransactionModal());
  document.getElementById('tx-btn-add').addEventListener('click', () => openTransactionModal());
  document.getElementById('btn-open-quick-ai').addEventListener('click', () => openModal('modal-quick-ai'));
  document.getElementById('sidebar-quick-ai').addEventListener('click', () => openModal('modal-quick-ai'));
  document.getElementById('tx-btn-quick-ai').addEventListener('click', () => openModal('modal-quick-ai'));
  document.getElementById('tx-btn-chat-ai').addEventListener('click', () => {
    renderAiChatMessages();
    openModal('modal-chat-ai');
  });
  document.getElementById('btn-open-chat-from-quick').addEventListener('click', () => {
    closeModal('modal-quick-ai');
    renderAiChatMessages();
    openModal('modal-chat-ai');
  });
  document.getElementById('sync-status-btn').addEventListener('click', () => syncWithGoogleSheets(false));
  document.getElementById('sidebar-lock-btn').addEventListener('click', lockApp);

  // Transaction form
  document.getElementById('tx-jenis').addEventListener('change', syncTxModalFields);
  document.getElementById('form-tx').addEventListener('submit', e => {
    e.preventDefault();
    const id = document.getElementById('tx-id').value;
    const jenis = document.getElementById('tx-jenis').value;
    const tanggal = document.getElementById('tx-tanggal').value;
    const nominal = Number(document.getElementById('tx-nominal').value || 0);
    const rekeningId = document.getElementById('tx-rekening').value;
    const rekeningTujuanId = document.getElementById('tx-rekening-tujuan').value;
    const kategoriId = document.getElementById('tx-kategori').value;
    const catatan = document.getElementById('tx-catatan').value.trim();

    if (jenis === 'transfer' && rekeningId === rekeningTujuanId) {
      showToast('Rekening asal dan tujuan tidak boleh sama.', 'error');
      return;
    }

    const nowIso = new Date().toISOString();
    if (id) {
      const existing = state.transactions.find(t => t.id === id);
      if (existing) {
        Object.assign(existing, {
          jenis, tanggal, nominal, rekeningId,
          rekeningTujuanId: jenis === 'transfer' ? rekeningTujuanId : '',
          kategoriId: jenis === 'transfer' ? '' : kategoriId,
          catatan, updatedAt: nowIso
        });
      }
    } else {
      state.transactions.push({
        id: uid('tx'),
        tanggal, jenis, nominal,
        kategoriId: jenis === 'transfer' ? '' : kategoriId,
        rekeningId,
        rekeningTujuanId: jenis === 'transfer' ? rekeningTujuanId : '',
        catatan,
        sumber: 'manual',
        linkedDebtId: '',
        updatedAt: nowIso,
        deleted: false
      });
    }

    closeModal('modal-tx');
    saveState();
    renderAll();
    showToast(id ? 'Transaksi diperbarui!' : 'Transaksi berhasil disimpan!', 'success');
  });

  // Transaction filters & pagination
  ['tx-filter-search', 'tx-filter-type', 'tx-filter-account', 'tx-filter-category', 'tx-filter-start', 'tx-filter-end'].forEach(elId => {
    document.getElementById(elId).addEventListener('input', () => {
      txPagination.page = 1;
      renderTransactionsTab();
    });
  });
  document.getElementById('tx-filter-reset').addEventListener('click', () => {
    document.getElementById('tx-filter-search').value = '';
    document.getElementById('tx-filter-type').value = 'all';
    document.getElementById('tx-filter-account').value = 'all';
    document.getElementById('tx-filter-category').value = 'all';
    document.getElementById('tx-filter-start').value = '';
    document.getElementById('tx-filter-end').value = '';
    txPagination.page = 1;
    renderTransactionsTab();
  });
  document.getElementById('tx-page-size').addEventListener('change', e => {
    txPagination.pageSize = Number(e.target.value || 10);
    txPagination.page = 1;
    renderTransactionsTab();
  });
  document.getElementById('tx-prev-page').addEventListener('click', () => {
    if (txPagination.page > 1) { txPagination.page--; renderTransactionsTab(); }
  });
  document.getElementById('tx-next-page').addEventListener('click', () => {
    txPagination.page++;
    renderTransactionsTab();
  });

  // AI Quick Fill & Chat
  document.getElementById('btn-run-quick-ai').addEventListener('click', runQuickAiFill);
  document.getElementById('form-ai-chat').addEventListener('submit', handleAiChatSubmit);
  document.getElementById('btn-clear-ai-chat').addEventListener('click', () => {
    aiChatHistory = [];
    renderAiChatMessages();
  });

  // Hutang & Piutang events
  document.getElementById('btn-add-debt').addEventListener('click', () => openDebtModal());
  document.getElementById('debt-affect-wallet').addEventListener('change', e => {
    document.getElementById('debt-wallet-select-wrap').style.display = e.target.checked ? 'flex' : 'none';
  });
  ['debt-filter-search', 'debt-filter-type', 'debt-filter-status', 'debt-sort-by'].forEach(id => {
    document.getElementById(id).addEventListener('input', renderDebtsTab);
  });

  document.getElementById('form-debt').addEventListener('submit', e => {
    e.preventDefault();
    const id = document.getElementById('debt-id').value;
    const jenis = document.getElementById('debt-jenis').value;
    const kontak = document.getElementById('debt-kontak').value.trim();
    const nominalPokok = Number(document.getElementById('debt-nominal').value || 0);
    const tanggalTransaksi = document.getElementById('debt-tgl-tx').value;
    const tanggalJatuhTempo = document.getElementById('debt-tgl-tempo').value;
    const catatan = document.getElementById('debt-catatan').value.trim();
    const mempengaruhi = document.getElementById('debt-affect-wallet').checked;
    const rekeningId = document.getElementById('debt-rekening').value;
    const nowIso = new Date().toISOString();

    if (id) {
      const existing = state.debtsReceivables.find(d => d.id === id);
      if (existing) {
        existing.jenis = jenis;
        existing.kontak = kontak;
        existing.nominalPokok = nominalPokok;
        existing.tanggalTransaksi = tanggalTransaksi;
        existing.tanggalJatuhTempo = tanggalJatuhTempo;
        existing.catatan = catatan;
        existing.pengaruhiSaldo = mempengaruhi;
        existing.rekeningId = rekeningId;
        recalculateDebtItem(id);
      }
    } else {
      const debtId = uid('debt');
      let linkedTxId = '';
      if (mempengaruhi && rekeningId) {
        linkedTxId = uid('tx_debt');
        const isPiutang = jenis === 'piutang';
        state.transactions.push({
          id: linkedTxId,
          tanggal: tanggalTransaksi,
          jenis: isPiutang ? 'expense' : 'income',
          nominal: nominalPokok,
          kategoriId: isPiutang ? 'cat_piutang_out' : 'cat_hutang_in',
          rekeningId,
          rekeningTujuanId: '',
          catatan: `${isPiutang ? 'Piutang ke' : 'Hutang dari'} ${kontak}${catatan ? ': ' + catatan : ''}`,
          sumber: 'debt-module',
          linkedDebtId: debtId,
          updatedAt: nowIso,
          deleted: false
        });
      }

      const newDebt = {
        id: debtId,
        jenis,
        kontak,
        nominalPokok,
        terbayar: 0,
        sisaTagihan: nominalPokok,
        tanggalTransaksi,
        tanggalJatuhTempo,
        status: 'Belum Lunas',
        pengaruhiSaldo: mempengaruhi,
        rekeningId,
        linkedTxId,
        catatan,
        updatedAt: nowIso,
        deleted: false
      };
      newDebt.status = computeDebtStatus(newDebt);
      state.debtsReceivables.push(newDebt);
    }

    closeModal('modal-debt');
    saveState();
    renderAll();
    showToast('Data Hutang/Piutang berhasil disimpan!', 'success');
  });

  // Debt Payment & Installment Modal
  document.getElementById('pay-affect-wallet').addEventListener('change', e => {
    document.getElementById('pay-wallet-wrap').style.display = e.target.checked ? 'flex' : 'none';
  });
  document.getElementById('btn-pay-full').addEventListener('click', () => {
    const id = document.getElementById('pay-debt-id').value;
    const item = state.debtsReceivables.find(d => d.id === id);
    if (item) document.getElementById('pay-nominal').value = item.sisaTagihan;
  });
  document.getElementById('btn-pay-half').addEventListener('click', () => {
    const id = document.getElementById('pay-debt-id').value;
    const item = state.debtsReceivables.find(d => d.id === id);
    if (item) document.getElementById('pay-nominal').value = Math.ceil(item.sisaTagihan / 2);
  });

  document.getElementById('form-debt-pay').addEventListener('submit', e => {
    e.preventDefault();
    const debtId = document.getElementById('pay-debt-id').value;
    const item = state.debtsReceivables.find(d => d.id === debtId && !d.deleted);
    if (!item) return;

    const nominalBayar = Number(document.getElementById('pay-nominal').value || 0);
    if (nominalBayar <= 0 || nominalBayar > Number(item.sisaTagihan || 0)) {
      showToast('Nominal pembayaran harus lebih dari 0 dan tidak melebihi sisa tagihan.', 'error');
      return;
    }
    const tanggalBayar = document.getElementById('pay-tanggal').value;
    const catatan = document.getElementById('pay-catatan').value.trim();
    const mempengaruhi = document.getElementById('pay-affect-wallet').checked;
    const rekeningId = document.getElementById('pay-rekening').value;
    const nowIso = new Date().toISOString();

    let linkedTxId = '';
    if (mempengaruhi && rekeningId) {
      linkedTxId = uid('tx_pay');
      // Piutang repaid -> income to wallet; Hutang paid -> expense from wallet
      const isPiutang = item.jenis === 'piutang';
      state.transactions.push({
        id: linkedTxId,
        tanggal: tanggalBayar,
        jenis: isPiutang ? 'income' : 'expense',
        nominal: nominalBayar,
        kategoriId: isPiutang ? 'cat_lain_inc' : 'cat_lain_exp',
        rekeningId,
        rekeningTujuanId: '',
        catatan: `${isPiutang ? 'Terima Cicilan Piutang dari' : 'Bayar Cicilan Hutang ke'} ${item.kontak}${catatan ? ' (' + catatan + ')' : ''}`,
        sumber: 'debt-payment',
        linkedDebtId: debtId,
        updatedAt: nowIso,
        deleted: false
      });
    }

    state.debtPayments.push({
      id: uid('pay'),
      debtId,
      kontak: item.kontak,
      jenis: item.jenis,
      tanggalBayar,
      nominalBayar,
      pengaruhiSaldo: mempengaruhi,
      rekeningId,
      linkedTxId,
      catatan,
      updatedAt: nowIso,
      deleted: false
    });

    recalculateDebtItem(debtId);
    closeModal('modal-debt-pay');
    saveState();
    renderAll();
    showToast(item.status === 'Lunas' ? 'Tagihan telah LUNAS!' : 'Pembayaran cicilan berhasil dicatat!', 'success');
  });

  document.getElementById('btn-export-debts-csv').addEventListener('click', () => {
    const items = state.debtsReceivables.filter(d => !d.deleted);
    const headers = ['ID', 'Jenis', 'Kontak', 'Nominal_Pokok', 'Terbayar', 'Sisa_Tagihan', 'Tgl_Transaksi', 'Jatuh_Tempo', 'Status', 'Pengaruhi_Saldo', 'Catatan'];
    const rows = items.map(d => [
      d.id, d.jenis, d.kontak, d.nominalPokok, d.terbayar, d.sisaTagihan,
      d.tanggalTransaksi, d.tanggalJatuhTempo, computeDebtStatus(d), d.pengaruhiSaldo ? 'Ya' : 'Tidak',
      (d.catatan || '').replace(/"/g, '""')
    ].map(v => `"${v}"`).join(','));
    triggerDownload('\uFEFF' + [headers.join(','), ...rows].join('\n'), `hutang-piutang-${todayISO()}.csv`, 'text/csv;charset=utf-8;');
    showToast('CSV Hutang & Piutang berhasil diunduh!', 'success');
  });

  // Budget & Recurring
  document.getElementById('budget-month-picker').addEventListener('change', renderBudgetAndRecurringTab);
  document.getElementById('btn-add-budget').addEventListener('click', () => {
    document.getElementById('form-budget').reset();
    document.getElementById('budget-id').value = '';
    document.getElementById('budget-bulan').value = document.getElementById('budget-month-picker').value || currentMonthISO();
    populateCategorySelect(document.getElementById('budget-kategori'), { jenis: 'expense' });
    openModal('modal-budget');
  });

  document.getElementById('form-budget').addEventListener('submit', e => {
    e.preventDefault();
    const id = document.getElementById('budget-id').value;
    const bulan = document.getElementById('budget-bulan').value;
    const kategoriId = document.getElementById('budget-kategori').value;
    const limitNominal = Number(document.getElementById('budget-limit').value || 0);
    const nowIso = new Date().toISOString();

    if (id) {
      const existing = state.budgets.find(b => b.id === id);
      if (existing) Object.assign(existing, { bulan, kategoriId, limitNominal, updatedAt: nowIso });
    } else {
      const dup = state.budgets.find(b => !b.deleted && b.bulan === bulan && b.kategoriId === kategoriId);
      if (dup) {
        dup.limitNominal = limitNominal;
        dup.updatedAt = nowIso;
      } else {
        state.budgets.push({ id: uid('bdg'), bulan, kategoriId, limitNominal, updatedAt: nowIso, deleted: false });
      }
    }
    closeModal('modal-budget');
    saveState();
    renderAll();
    showToast('Budget bulanan disimpan!', 'success');
  });

  document.getElementById('btn-add-recurring').addEventListener('click', () => {
    document.getElementById('form-recurring').reset();
    document.getElementById('rec-id').value = '';
    document.getElementById('rec-mulai').value = todayISO();
    populateAccountSelect(document.getElementById('rec-rekening'));
    populateAccountSelect(document.getElementById('rec-rekening-tujuan'));
    populateCategorySelect(document.getElementById('rec-kategori'), { jenis: 'expense' });
    document.getElementById('rec-tujuan-wrap').style.display = 'none';
    document.getElementById('rec-kategori-wrap').style.display = 'flex';
    openModal('modal-recurring');
  });

  document.getElementById('rec-jenis').addEventListener('change', e => {
    const j = e.target.value;
    document.getElementById('rec-tujuan-wrap').style.display = j === 'transfer' ? 'flex' : 'none';
    document.getElementById('rec-kategori-wrap').style.display = j === 'transfer' ? 'none' : 'flex';
    if (j !== 'transfer') populateCategorySelect(document.getElementById('rec-kategori'), { jenis: j });
  });

  document.getElementById('form-recurring').addEventListener('submit', e => {
    e.preventDefault();
    const jenis = document.getElementById('rec-jenis').value;
    const nominal = Number(document.getElementById('rec-nominal').value || 0);
    const rekeningId = document.getElementById('rec-rekening').value;
    const rekeningTujuanId = document.getElementById('rec-rekening-tujuan').value;
    const kategoriId = document.getElementById('rec-kategori').value;
    const frekuensi = document.getElementById('rec-frekuensi').value;
    const interval = Number(document.getElementById('rec-interval').value || 1);
    const tanggalMulai = document.getElementById('rec-mulai').value;
    const tanggalSelesai = document.getElementById('rec-selesai').value;
    const catatan = document.getElementById('rec-catatan').value.trim();

    state.recurringRules.push({
      id: uid('rec'),
      jenis,
      nominal,
      kategoriId: jenis === 'transfer' ? '' : kategoriId,
      rekeningId,
      rekeningTujuanId: jenis === 'transfer' ? rekeningTujuanId : '',
      catatan,
      frekuensi,
      interval,
      tanggalMulai,
      tanggalSelesai,
      berikutnya: tanggalMulai,
      aktif: true,
      updatedAt: new Date().toISOString(),
      deleted: false
    });

    closeModal('modal-recurring');
    processRecurringRules(true);
    saveState();
    renderAll();
    showToast('Aturan transaksi berulang disimpan!', 'success');
  });

  document.getElementById('btn-run-recurring-now').addEventListener('click', () => {
    processRecurringRules(false);
    renderAll();
  });

  // Reports
  ['report-period', 'report-start', 'report-end', 'report-type', 'report-account'].forEach(id => {
    document.getElementById(id).addEventListener('change', renderReportsTab);
  });
  document.getElementById('btn-export-report-csv').addEventListener('click', () => {
    const { start, end, txs } = getFilteredReportData();
    exportTransactionsToCSV(txs, `laporan-dompetku-${start}-sd-${end}.csv`);
  });
  document.getElementById('btn-export-report-pdf').addEventListener('click', exportReportToPDF);

  // Settings: Profile & Theme
  document.getElementById('btn-save-profile').addEventListener('click', () => {
    const name = document.getElementById('input-profile-name').value.trim();
    if (!name) return;
    state.profile.name = name;
    saveState({ triggerCloudSync: false });
    updateProfileUI();
    showToast('Nama profil diperbarui!', 'success');
  });

  document.getElementById('input-profile-photo').addEventListener('change', e => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const size = 160;
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext('2d');
        const minSide = Math.min(img.width, img.height);
        const sx = (img.width - minSide) / 2;
        const sy = (img.height - minSide) / 2;
        ctx.drawImage(img, sx, sy, minSide, minSide, 0, 0, size, size);
        state.profile.photoDataUrl = canvas.toDataURL('image/jpeg', 0.82);
        saveState({ triggerCloudSync: false });
        updateProfileUI();
        showToast('Foto profil diperbarui!', 'success');
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });

  document.getElementById('btn-remove-photo').addEventListener('click', () => {
    state.profile.photoDataUrl = '';
    saveState({ triggerCloudSync: false });
    updateProfileUI();
    showToast('Foto profil dihapus', 'info');
  });

  document.getElementById('select-theme').addEventListener('change', e => {
    state.settings.theme = e.target.value;
    saveState({ triggerCloudSync: false });
    applyTheme();
    renderTrendChart();
    renderCategoryChart();
  });

  // Settings: Google Sheets & Groq
  document.getElementById('btn-save-sync-now').addEventListener('click', () => {
    state.settings.gasUrl = document.getElementById('input-gas-url').value.trim();
    state.settings.autoSync = document.getElementById('toggle-auto-sync').checked;
    saveState({ triggerCloudSync: false });
    refreshSyncIndicator();
    syncWithGoogleSheets(false);
  });

  document.getElementById('toggle-auto-sync').addEventListener('change', e => {
    state.settings.autoSync = e.target.checked;
    saveState({ triggerCloudSync: false });
  });

  document.getElementById('btn-copy-gas-code').addEventListener('click', async () => {
    try {
      const res = await fetch('./google-apps-script/Code.gs');
      const code = res.ok ? await res.text() : GAS_TEMPLATE_CODE;
      await navigator.clipboard.writeText(code);
      showToast('Kode Google Apps Script (Code.gs) disalin ke clipboard!', 'success');
    } catch {
      showToast('Silakan buka file google-apps-script/Code.gs di folder proyek Anda.', 'info');
    }
  });

  document.getElementById('btn-fetch-groq-models').addEventListener('click', fetchActiveGroqModels);
  document.getElementById('btn-save-groq').addEventListener('click', () => {
    state.settings.groqApiKey = document.getElementById('input-groq-key').value.trim();
    state.settings.groqModel = document.getElementById('select-groq-model').value;
    saveState({ triggerCloudSync: false });
    showToast('Pengaturan AI Groq disimpan!', 'success');
  });

  // Settings: Security PIN & Biometric
  document.getElementById('btn-set-pin').addEventListener('click', async () => {
    const rawPin = (document.getElementById('input-new-pin').value || '').trim();
    if (!/^\d{4,6}$/.test(rawPin)) {
      showToast('PIN harus terdiri dari 4 sampai 6 digit angka.', 'error');
      return;
    }
    const salt = uid('salt');
    const hash = await sha256Hex(`${salt}:${rawPin}`);
    securityConfig.pinEnabled = true;
    securityConfig.pinSalt = salt;
    securityConfig.pinHash = hash;
    saveSecurity();
    document.getElementById('input-new-pin').value = '';
    updateSecurityUI();
    showToast('PIN keamanan 4–6 digit berhasil diaktifkan!', 'success');
  });

  document.getElementById('btn-disable-pin').addEventListener('click', () => {
    if (!securityConfig.pinEnabled) return;
    if (!confirm('Nonaktifkan kunci PIN & biometrik?')) return;
    securityConfig = { pinEnabled: false, pinHash: '', pinSalt: '', biometricCredId: '' };
    saveSecurity();
    updateSecurityUI();
    showToast('Kunci PIN dinonaktifkan.', 'info');
  });

  document.getElementById('btn-register-biometric').addEventListener('click', registerBiometric);
  document.getElementById('btn-remove-biometric').addEventListener('click', () => {
    securityConfig.biometricCredId = '';
    saveSecurity();
    updateSecurityUI();
    showToast('Sidik jari dihapus. PIN tetap aktif.', 'info');
  });

  // Lock screen keypad
  document.querySelectorAll('.pin-key[data-digit]').forEach(btn => {
    btn.addEventListener('click', () => {
      if (pinBuffer.length < 6) {
        pinBuffer += btn.dataset.digit;
        updatePinDots();
      }
    });
  });
  document.getElementById('btn-pin-backspace').addEventListener('click', () => {
    pinBuffer = pinBuffer.slice(0, -1);
    updatePinDots();
  });
  document.getElementById('btn-pin-submit').addEventListener('click', verifyPinInput);
  document.getElementById('btn-biometric-unlock').addEventListener('click', unlockWithBiometric);

  // Master Data Modals
  document.getElementById('btn-add-account').addEventListener('click', () => {
    document.getElementById('form-account').reset();
    document.getElementById('acc-id').value = '';
    document.getElementById('modal-acc-title').textContent = 'Tambah Rekening';
    openModal('modal-account');
  });

  document.getElementById('form-account').addEventListener('submit', e => {
    e.preventDefault();
    const id = document.getElementById('acc-id').value;
    const nama = document.getElementById('acc-nama').value.trim();
    const tipe = document.getElementById('acc-tipe').value;
    const saldoAwal = Number(document.getElementById('acc-saldo-awal').value || 0);
    const ikon = document.getElementById('acc-ikon').value.trim() || '💳';
    const warna = document.getElementById('acc-warna').value;
    const nowIso = new Date().toISOString();

    if (id) {
      const existing = state.accounts.find(a => a.id === id);
      if (existing) Object.assign(existing, { nama, tipe, saldoAwal, ikon, warna, updatedAt: nowIso });
    } else {
      state.accounts.push({
        id: uid('acc'), nama, tipe, saldoAwal, ikon, warna, arsip: false, updatedAt: nowIso, deleted: false
      });
    }
    closeModal('modal-account');
    saveState();
    renderAll();
    showToast('Master rekening disimpan!', 'success');
  });

  document.getElementById('btn-add-category').addEventListener('click', () => {
    document.getElementById('form-category').reset();
    document.getElementById('cat-id').value = '';
    document.getElementById('modal-cat-title').textContent = 'Tambah Kategori';
    openModal('modal-category');
  });

  document.getElementById('form-category').addEventListener('submit', e => {
    e.preventDefault();
    const id = document.getElementById('cat-id').value;
    const nama = document.getElementById('cat-nama').value.trim();
    const jenis = document.getElementById('cat-jenis').value;
    const ikon = document.getElementById('cat-ikon').value.trim() || '🏷️';
    const warna = document.getElementById('cat-warna').value;
    const nowIso = new Date().toISOString();

    if (id) {
      const existing = state.categories.find(c => c.id === id);
      if (existing) Object.assign(existing, { nama, jenis, ikon, warna, updatedAt: nowIso });
    } else {
      state.categories.push({
        id: uid('cat'), nama, jenis, ikon, warna, arsip: false, updatedAt: nowIso, deleted: false
      });
    }
    closeModal('modal-category');
    saveState();
    renderAll();
    showToast('Master kategori disimpan!', 'success');
  });

  // Backup, Restore & Export
  document.getElementById('btn-export-json').addEventListener('click', exportBackupJsonV2);
  document.getElementById('input-import-json').addEventListener('change', e => {
    const file = e.target.files?.[0];
    if (file) importBackupJson(file);
    e.target.value = '';
  });
  document.getElementById('btn-export-all-csv').addEventListener('click', () => {
    exportTransactionsToCSV(getActiveTransactions(), `semua-transaksi-dompetku-${todayISO()}.csv`);
  });
  document.getElementById('btn-reset-demo').addEventListener('click', () => {
    if (!confirm('Reset seluruh data lokal ke data contoh awal?')) return;
    state = getDefaultState();
    saveState({ triggerCloudSync: false });
    updateProfileUI();
    renderAll();
    showToast('Data dikembalikan ke pengaturan awal.', 'info');
  });

  // Online/Offline & Resume listeners
  window.addEventListener('online', () => {
    refreshSyncIndicator();
    if (state.settings.gasUrl && state.settings.autoSync) {
      syncWithGoogleSheets(true);
    }
  });
  window.addEventListener('offline', refreshSyncIndicator);
  window.addEventListener('resize', () => {
    if (document.getElementById('tab-dashboard').classList.contains('active')) {
      renderTrendChart();
      renderCategoryChart();
    }
  });
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) {
      processRecurringRules(true);
      renderAll();
    }
  });
}

/* ==========================================================================
   Bootstrap PWA
   ========================================================================== */

document.addEventListener('DOMContentLoaded', () => {
  applyTheme();
  updateProfileUI();
  updateSecurityUI();
  refreshSyncIndicator();

  if (securityConfig.pinEnabled && !isUnlocked) {
    lockApp();
  }

  processRecurringRules(true);
  initEventListeners();
  renderAll();

  if (state.settings.gasUrl && state.settings.autoSync && navigator.onLine) {
    syncWithGoogleSheets(true);
  }

  if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
    navigator.serviceWorker.register('./sw.js').catch(err => {
      console.warn('SW registration skipped:', err);
    });
  }
});
