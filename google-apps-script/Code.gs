
/**
 * ============================================================================
 * DompetKu PWA — Google Apps Script Cloud Sync Backend (Code.gs)
 * ============================================================================
 * Cara Pemasangan:
 * 1. Buka Google Sheets baru (misal: "Database Keuangan DompetKu").
 * 2. Klik menu Ekstensi (Extensions) -> Apps Script.
 * 3. Hapus kode bawaan, tempel seluruh kode ini, lalu klik Simpan (Ctrl+S).
 * 4. Klik Terapkan (Deploy) -> Deployment baru (New deployment).
 * 5. Pilih jenis: Aplikasi web (Web app).
 *    - Jalankan sebagai (Execute as): Saya (Me)
 *    - Yang memiliki akses (Who has access): Siapa saja (Anyone)
 * 6. Klik Terapkan, izinkan akses (Authorize access), lalu salin URL Web App.
 * 7. Tempel URL Web App tersebut ke menu Pengaturan -> Google Sheets di aplikasi.
 * ============================================================================
 */

const SHEETS_SCHEMA = {
  Transaksi: [
    'id', 'tanggal', 'jenis', 'nominal', 'kategoriId', 'kategoriNama',
    'rekeningId', 'rekeningNama', 'rekeningTujuanId', 'rekeningTujuanNama',
    'catatan', 'sumber', 'linkedDebtId', 'updatedAt', 'deleted'
  ],
  Rekening: [
    'id', 'nama', 'tipe', 'saldoAwal', 'warna', 'ikon', 'arsip', 'updatedAt', 'deleted'
  ],
  Kategori: [
    'id', 'nama', 'jenis', 'warna', 'ikon', 'arsip', 'updatedAt', 'deleted'
  ],
  Budget: [
    'id', 'bulan', 'kategoriId', 'kategoriNama', 'limitNominal', 'updatedAt', 'deleted'
  ],
  Transaksi_Berulang: [
    'id', 'jenis', 'nominal', 'kategoriId', 'rekeningId', 'rekeningTujuanId',
    'catatan', 'frekuensi', 'interval', 'tanggalMulai', 'tanggalSelesai',
    'berikutnya', 'aktif', 'updatedAt', 'deleted'
  ],
  Hutang_Piutang: [
    'id', 'jenis', 'kontak', 'nominalPokok', 'terbayar', 'sisaTagihan',
    'tanggalTransaksi', 'tanggalJatuhTempo', 'status', 'pengaruhiSaldo',
    'rekeningId', 'linkedTxId', 'catatan', 'updatedAt', 'deleted'
  ],
  Riwayat_Cicilan: [
    'id', 'debtId', 'kontak', 'jenis', 'tanggalBayar', 'nominalBayar',
    'pengaruhiSaldo', 'rekeningId', 'linkedTxId', 'catatan', 'updatedAt', 'deleted'
  ]
};

function doGet(e) {
  return jsonResponse({
    ok: true,
    service: 'DompetKu Cloud Sync API',
    timestamp: new Date().toISOString()
  });
}

function doPost(e) {
  const lock = LockService.getScriptLock();
  lock.waitLock(25000);
  try {
    const raw = e && e.postData && e.postData.contents ? e.postData.contents : '{}';
    const payload = JSON.parse(raw);
    const action = payload.action || 'sync';

    const ss = SpreadsheetApp.getActiveSpreadsheet();
    ensureAllSheets(ss);

    if (action === 'ping') {
      return jsonResponse({
        ok: true,
        spreadsheetName: ss.getName(),
        timestamp: new Date().toISOString()
      });
    }

    if (action === 'sync') {
      const clientData = payload.data || {};
      const mergedResult = {};

      // Lookup maps for human-readable names in Sheets
      const accMap = buildNameMap(clientData.accounts || []);
      const catMap = buildNameMap(clientData.categories || []);

      // 1. Rekening
      mergedResult.accounts = mergeCollection(
        ss.getSheetByName('Rekening'),
        SHEETS_SCHEMA.Rekening,
        (clientData.accounts || []).map(a => ({
          id: a.id,
          nama: a.nama || '',
          tipe: a.tipe || 'Bank/E-Wallet',
          saldoAwal: Number(a.saldoAwal || 0),
          warna: a.warna || '#0f766e',
          ikon: a.ikon || '💳',
          arsip: Boolean(a.arsip),
          updatedAt: a.updatedAt || new Date().toISOString(),
          deleted: Boolean(a.deleted)
        })),
        row => ({
          id: String(row.id),
          nama: String(row.nama || ''),
          tipe: String(row.tipe || 'Bank/E-Wallet'),
          saldoAwal: Number(row.saldoAwal || 0),
          warna: String(row.warna || '#0f766e'),
          ikon: String(row.ikon || '💳'),
          arsip: toBool(row.arsip),
          updatedAt: String(row.updatedAt || '1970-01-01T00:00:00.000Z'),
          deleted: toBool(row.deleted)
        })
      );

      mergedResult.accounts.forEach(a => { accMap[a.id] = a.nama; });

      // 2. Kategori
      mergedResult.categories = mergeCollection(
        ss.getSheetByName('Kategori'),
        SHEETS_SCHEMA.Kategori,
        (clientData.categories || []).map(c => ({
          id: c.id,
          nama: c.nama || '',
          jenis: c.jenis || 'expense',
          warna: c.warna || '#0d9488',
          ikon: c.ikon || '🏷️',
          arsip: Boolean(c.arsip),
          updatedAt: c.updatedAt || new Date().toISOString(),
          deleted: Boolean(c.deleted)
        })),
        row => ({
          id: String(row.id),
          nama: String(row.nama || ''),
          jenis: String(row.jenis || 'expense'),
          warna: String(row.warna || '#0d9488'),
          ikon: String(row.ikon || '🏷️'),
          arsip: toBool(row.arsip),
          updatedAt: String(row.updatedAt || '1970-01-01T00:00:00.000Z'),
          deleted: toBool(row.deleted)
        })
      );

      mergedResult.categories.forEach(c => { catMap[c.id] = c.nama; });

      // 3. Transaksi
      mergedResult.transactions = mergeCollection(
        ss.getSheetByName('Transaksi'),
        SHEETS_SCHEMA.Transaksi,
        (clientData.transactions || []).map(t => ({
          id: t.id,
          tanggal: t.tanggal || '',
          jenis: t.jenis || 'expense',
          nominal: Number(t.nominal || 0),
          kategoriId: t.kategoriId || '',
          kategoriNama: catMap[t.kategoriId] || t.kategoriNama || '',
          rekeningId: t.rekeningId || '',
          rekeningNama: accMap[t.rekeningId] || t.rekeningNama || '',
          rekeningTujuanId: t.rekeningTujuanId || '',
          rekeningTujuanNama: accMap[t.rekeningTujuanId] || t.rekeningTujuanNama || '',
          catatan: t.catatan || '',
          sumber: t.sumber || 'manual',
          linkedDebtId: t.linkedDebtId || '',
          updatedAt: t.updatedAt || new Date().toISOString(),
          deleted: Boolean(t.deleted)
        })),
        row => ({
          id: String(row.id),
          tanggal: formatSheetDate(row.tanggal),
          jenis: String(row.jenis || 'expense'),
          nominal: Number(row.nominal || 0),
          kategoriId: String(row.kategoriId || ''),
          kategoriNama: String(row.kategoriNama || ''),
          rekeningId: String(row.rekeningId || ''),
          rekeningNama: String(row.rekeningNama || ''),
          rekeningTujuanId: String(row.rekeningTujuanId || ''),
          rekeningTujuanNama: String(row.rekeningTujuanNama || ''),
          catatan: String(row.catatan || ''),
          sumber: String(row.sumber || 'manual'),
          linkedDebtId: String(row.linkedDebtId || ''),
          updatedAt: String(row.updatedAt || '1970-01-01T00:00:00.000Z'),
          deleted: toBool(row.deleted)
        })
      );

      // 4. Budget
      mergedResult.budgets = mergeCollection(
        ss.getSheetByName('Budget'),
        SHEETS_SCHEMA.Budget,
        (clientData.budgets || []).map(b => ({
          id: b.id,
          bulan: b.bulan || '',
          kategoriId: b.kategoriId || '',
          kategoriNama: catMap[b.kategoriId] || b.kategoriNama || '',
          limitNominal: Number(b.limitNominal || 0),
          updatedAt: b.updatedAt || new Date().toISOString(),
          deleted: Boolean(b.deleted)
        })),
        row => ({
          id: String(row.id),
          bulan: String(row.bulan || ''),
          kategoriId: String(row.kategoriId || ''),
          kategoriNama: String(row.kategoriNama || ''),
          limitNominal: Number(row.limitNominal || 0),
          updatedAt: String(row.updatedAt || '1970-01-01T00:00:00.000Z'),
          deleted: toBool(row.deleted)
        })
      );

      // 5. Transaksi_Berulang
      mergedResult.recurringRules = mergeCollection(
        ss.getSheetByName('Transaksi_Berulang'),
        SHEETS_SCHEMA.Transaksi_Berulang,
        (clientData.recurringRules || []).map(r => ({
          id: r.id,
          jenis: r.jenis || 'expense',
          nominal: Number(r.nominal || 0),
          kategoriId: r.kategoriId || '',
          rekeningId: r.rekeningId || '',
          rekeningTujuanId: r.rekeningTujuanId || '',
          catatan: r.catatan || '',
          frekuensi: r.frekuensi || 'monthly',
          interval: Number(r.interval || 1),
          tanggalMulai: r.tanggalMulai || '',
          tanggalSelesai: r.tanggalSelesai || '',
          berikutnya: r.berikutnya || '',
          aktif: r.aktif !== false,
          updatedAt: r.updatedAt || new Date().toISOString(),
          deleted: Boolean(r.deleted)
        })),
        row => ({
          id: String(row.id),
          jenis: String(row.jenis || 'expense'),
          nominal: Number(row.nominal || 0),
          kategoriId: String(row.kategoriId || ''),
          rekeningId: String(row.rekeningId || ''),
          rekeningTujuanId: String(row.rekeningTujuanId || ''),
          catatan: String(row.catatan || ''),
          frekuensi: String(row.frekuensi || 'monthly'),
          interval: Number(row.interval || 1),
          tanggalMulai: formatSheetDate(row.tanggalMulai),
          tanggalSelesai: formatSheetDate(row.tanggalSelesai),
          berikutnya: formatSheetDate(row.berikutnya),
          aktif: toBool(row.aktif),
          updatedAt: String(row.updatedAt || '1970-01-01T00:00:00.000Z'),
          deleted: toBool(row.deleted)
        })
      );

      // 6. Hutang_Piutang
      mergedResult.debtsReceivables = mergeCollection(
        ss.getSheetByName('Hutang_Piutang'),
        SHEETS_SCHEMA.Hutang_Piutang,
        (clientData.debtsReceivables || []).map(d => ({
          id: d.id,
          jenis: d.jenis || 'hutang',
          kontak: d.kontak || '',
          nominalPokok: Number(d.nominalPokok || 0),
          terbayar: Number(d.terbayar || 0),
          sisaTagihan: Number(d.sisaTagihan != null ? d.sisaTagihan : d.nominalPokok || 0),
          tanggalTransaksi: d.tanggalTransaksi || '',
          tanggalJatuhTempo: d.tanggalJatuhTempo || '',
          status: d.status || 'Belum Lunas',
          pengaruhiSaldo: Boolean(d.pengaruhiSaldo),
          rekeningId: d.rekeningId || '',
          linkedTxId: d.linkedTxId || '',
          catatan: d.catatan || '',
          updatedAt: d.updatedAt || new Date().toISOString(),
          deleted: Boolean(d.deleted)
        })),
        row => ({
          id: String(row.id),
          jenis: String(row.jenis || 'hutang'),
          kontak: String(row.kontak || ''),
          nominalPokok: Number(row.nominalPokok || 0),
          terbayar: Number(row.terbayar || 0),
          sisaTagihan: Number(row.sisaTagihan || 0),
          tanggalTransaksi: formatSheetDate(row.tanggalTransaksi),
          tanggalJatuhTempo: formatSheetDate(row.tanggalJatuhTempo),
          status: String(row.status || 'Belum Lunas'),
          pengaruhiSaldo: toBool(row.pengaruhiSaldo),
          rekeningId: String(row.rekeningId || ''),
          linkedTxId: String(row.linkedTxId || ''),
          catatan: String(row.catatan || ''),
          updatedAt: String(row.updatedAt || '1970-01-01T00:00:00.000Z'),
          deleted: toBool(row.deleted)
        })
      );

      // 7. Riwayat_Cicilan
      mergedResult.debtPayments = mergeCollection(
        ss.getSheetByName('Riwayat_Cicilan'),
        SHEETS_SCHEMA.Riwayat_Cicilan,
        (clientData.debtPayments || []).map(p => ({
          id: p.id,
          debtId: p.debtId || '',
          kontak: p.kontak || '',
          jenis: p.jenis || '',
          tanggalBayar: p.tanggalBayar || '',
          nominalBayar: Number(p.nominalBayar || 0),
          pengaruhiSaldo: Boolean(p.pengaruhiSaldo),
          rekeningId: p.rekeningId || '',
          linkedTxId: p.linkedTxId || '',
          catatan: p.catatan || '',
          updatedAt: p.updatedAt || new Date().toISOString(),
          deleted: Boolean(p.deleted)
        })),
        row => ({
          id: String(row.id),
          debtId: String(row.debtId || ''),
          kontak: String(row.kontak || ''),
          jenis: String(row.jenis || ''),
          tanggalBayar: formatSheetDate(row.tanggalBayar),
          nominalBayar: Number(row.nominalBayar || 0),
          pengaruhiSaldo: toBool(row.pengaruhiSaldo),
          rekeningId: String(row.rekeningId || ''),
          linkedTxId: String(row.linkedTxId || ''),
          catatan: String(row.catatan || ''),
          updatedAt: String(row.updatedAt || '1970-01-01T00:00:00.000Z'),
          deleted: toBool(row.deleted)
        })
      );

      return jsonResponse({
        ok: true,
        timestamp: new Date().toISOString(),
        data: mergedResult
      });
    }

    return jsonResponse({ ok: false, error: 'Action tidak dikenal: ' + action });
  } catch (err) {
    return jsonResponse({ ok: false, error: String(err && err.message ? err.message : err) });
  } finally {
    lock.releaseLock();
  }
}

function ensureAllSheets(ss) {
  Object.keys(SHEETS_SCHEMA).forEach(sheetName => {
    const headers = SHEETS_SCHEMA[sheetName];
    let sheet = ss.getSheetByName(sheetName);
    if (!sheet) {
      sheet = ss.insertSheet(sheetName);
      sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
      sheet.getRange(1, 1, 1, headers.length)
        .setFontWeight('bold')
        .setBackground('#0f766e')
        .setFontColor('#ffffff');
      sheet.setFrozenRows(1);
    } else if (sheet.getLastRow() === 0) {
      sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
      sheet.getRange(1, 1, 1, headers.length)
        .setFontWeight('bold')
        .setBackground('#0f766e')
        .setFontColor('#ffffff');
      sheet.setFrozenRows(1);
    }
  });
}

function mergeCollection(sheet, headers, clientItems, normalizeServerRow) {
  const serverItems = readSheetObjects(sheet, headers).map(normalizeServerRow);
  const mergedMap = {};

  serverItems.forEach(item => {
    if (item && item.id) mergedMap[item.id] = item;
  });

  clientItems.forEach(cItem => {
    if (!cItem || !cItem.id) return;
    const existing = mergedMap[cItem.id];
    if (!existing) {
      mergedMap[cItem.id] = cItem;
    } else {
      const cTime = Date.parse(cItem.updatedAt || '') || 0;
      const sTime = Date.parse(existing.updatedAt || '') || 0;
      if (cTime >= sTime) {
        mergedMap[cItem.id] = cItem;
      }
    }
  });

  const finalItems = Object.values(mergedMap);
  writeSheetObjects(sheet, headers, finalItems);
  return finalItems;
}

function readSheetObjects(sheet, headers) {
  const lastRow = sheet.getLastRow();
  if (lastRow <= 1) return [];
  const values = sheet.getRange(2, 1, lastRow - 1, headers.length).getValues();
  return values
    .filter(row => row[0] !== '' && row[0] !== null)
    .map(row => {
      const obj = {};
      headers.forEach((h, idx) => {
        obj[h] = row[idx];
      });
      return obj;
    });
}

function writeSheetObjects(sheet, headers, items) {
  const lastRow = sheet.getLastRow();
  if (lastRow > 1) {
    sheet.getRange(2, 1, lastRow - 1, headers.length).clearContent();
  }
  if (!items || items.length === 0) return;
  const rows = items.map(item => headers.map(h => (item[h] !== undefined && item[h] !== null ? item[h] : '')));
  sheet.getRange(2, 1, rows.length, headers.length).setValues(rows);
}

function buildNameMap(list) {
  const map = {};
  (list || []).forEach(item => {
    if (item && item.id) map[item.id] = item.nama || '';
  });
  return map;
}

function toBool(val) {
  if (typeof val === 'boolean') return val;
  if (typeof val === 'string') return val.toLowerCase() === 'true';
  return Boolean(val);
}

function formatSheetDate(val) {
  if (!val) return '';
  if (Object.prototype.toString.call(val) === '[object Date]' && !isNaN(val)) {
    const y = val.getFullYear();
    const m = String(val.getMonth() + 1).padStart(2, '0');
    const d = String(val.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }
  return String(val);
}

function jsonResponse(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
