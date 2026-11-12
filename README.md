# DompetKu PWA — Aplikasi Pencatat Keuangan & Manajemen Hutang Piutang

Aplikasi pencatat keuangan pribadi berbasis **Progressive Web App (PWA)** yang bekerja **100% offline-first** dan tersinkronisasi dua arah secara otomatis dengan **Google Sheets** saat online, dilengkapi kecerdasan buatan **Groq AI** (Isi Cepat & Chat Interaktif), serta modul **Manajemen Hutang & Piutang** lengkap dengan sistem cicilan.

---

## Fitur Utama

1. **Dashboard Keuangan Komprehensif**
   - Total saldo seluruh rekening aktif, pemasukan, pengeluaran, dan selisih bersih bulan berjalan.
   - Grafik tren pemasukan vs pengeluaran 6 bulan terakhir & rincian pengeluaran per kategori (Canvas HD, tetap berjalan offline).
   - Kartu saldo per rekening/dompet, ringkasan status budget bulanan, serta banner Hutang & Piutang aktif.
2. **Manajemen Transaksi & Transfer**
   - Tambah, edit, hapus, dan transfer antar rekening.
   - Pencarian real-time, filter multi-kriteria (jenis, rekening, kategori, rentang tanggal), dan pagination.
3. **Isi Cepat AI & Chat AI Transaksi (Groq)**
   - **Isi Cepat AI**: Ketik kalimat alami seperti `"makan siang 25rb pakai Gopay"` atau `"transfer 500rb dari BCA ke Dana"`, AI otomatis mengisi form transaksi untuk diperiksa sebelum disimpan.
   - **Chat AI Transaksi**: Diskusikan transaksi secara interaktif. AI akan menanyakan detail yang kurang (nominal/rekening/kategori), lalu menyajikan draft yang bisa diperiksa di form atau disimpan langsung.
   - **Daftar Model Dinamis**: Mengambil daftar model chat aktif langsung dari API Groq (`GET /openai/v1/models`).
4. **Manajemen Hutang & Piutang (Terintegrasi Google Sheets)**
   - **Klasifikasi**: `Hutang` (Payable / kewajiban bayar) dan `Piutang` (Receivable / hak tagih).
   - **Atribut Lengkap**: Nama kontak (pilih dari riwayat kontak atau input baru), nominal pokok, tanggal transaksi, tanggal jatuh tempo, catatan, dan status otomatis (`Belum Lunas`, `Dicicil`, `Lunas`, `Jatuh Tempo`).
   - **Pembayaran Penuh & Cicilan (Partial Payment)**: Catat cicilan bertahap, otomatis menghitung sisa tagihan, menyimpan riwayat tanggal & nominal pembayaran, dan otomatis mengubah status menjadi `Lunas` saat sisa tagihan mencapai `Rp 0`.
   - **Toggle "Pengaruhi Saldo Utama"**: Opsional per transaksi maupun per cicilan — jika aktif, saldo dompet/rekening kas otomatis bertambah/berkurang dan tercatat di riwayat transaksi.
   - **Ringkasan & Pengingat**: Menampilkan Total Hutang Aktif, Total Piutang Aktif, Selisih Bersih (Net Balance), filter status, dan pengurutan jatuh tempo terdekat.
5. **Budget Bulanan & Transaksi Berulang**
   - Atur batas pengeluaran per kategori dengan indikator status (`Aman`, `Hampir Penuh`, `Terlampaui`).
   - Aturan transaksi otomatis (harian, mingguan, bulanan, tahunan) dengan interval dan tanggal mulai/selesai opsional yang dieksekusi otomatis saat aplikasi dibuka.
6. **Laporan & Ekspor (PDF & CSV)**
   - Periode harian, mingguan, bulanan, tahunan, maupun rentang tanggal kustom.
   - Ekspor laporan rapi ke **PDF** (menyertakan profil & avatar pengguna) dan **CSV** untuk Excel/Google Sheets.
7. **Keamanan Lokal & Personalisasi**
   - Kunci aplikasi **PIN 4–6 digit** + **Fingerprint (WebAuthn Platform Authenticator)** sebagai kunci tampilan dengan PIN sebagai fallback.
   - Profil lokal (nama & foto avatar), pilihan tema (**Terang / Gelap / Sistem**), dan **Backup & Restore JSON v2** (kompatibel dengan backup v1).

---

## Cara Deploy ke GitHub Pages

1. Buat repositori baru di GitHub (misal: `dompetku-pwa`).
2. Unggah seluruh file di folder ini (`index.html`, `styles.css`, `app.js`, `sw.js`, `manifest.json`, `icon.svg`, `README.md`, dan folder `google-apps-script/`) ke branch `main`.
3. Buka **Settings → Pages** di repositori GitHub Anda.
4. Pada bagian **Build and deployment**, pilih **Source: Deploy from a branch**, lalu pilih branch `main` dan folder `/ (root)`, klik **Save**.
5. Tunggu beberapa saat hingga URL GitHub Pages aktif (misal: `https://username.github.io/dompetku-pwa/`).
6. Buka URL tersebut di HP/Desktop, lalu pilih **Install App / Tambahkan ke Layar Utama** untuk memasang PWA.

---

## Cara Menghubungkan Google Sheets (Cloud Sync)

1. Buka [Google Sheets](https://sheets.google.com) dan buat spreadsheet baru (misal: `Keuangan DompetKu`).
2. Buka menu **Ekstensi (Extensions) → Apps Script**.
3. Salin seluruh isi file `google-apps-script/Code.gs` dan tempel ke editor Apps Script, lalu simpan.
4. Klik **Terapkan (Deploy) → Deployment baru (New deployment)**.
5. Pilih jenis **Aplikasi web (Web app)**:
   - **Jalankan sebagai**: `Saya (Me)`
   - **Yang memiliki akses**: `Siapa saja (Anyone)`
6. Klik **Terapkan**, selesaikan otorisasi izin Google, lalu salin **URL Web App** (`https://script.google.com/macros/s/.../exec`).
7. Buka aplikasi **DompetKu → Pengaturan → Koneksi Cloud Google Sheets**, tempel URL tersebut, lalu klik **Simpan & Sinkronkan**.
   - Script otomatis membuat 7 tab: `Transaksi`, `Rekening`, `Kategori`, `Budget`, `Transaksi_Berulang`, `Hutang_Piutang`, dan `Riwayat_Cicilan`.
