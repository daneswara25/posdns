# PRD — KasirCloud (Cloud POS SaaS)

## Original Problem Statement
Aplikasi POS berbasis cloud modern: Dashboard Web (Owner/Admin), Mobile POS, Customer Display, satu database cloud real-time. Modul: Master Data, Penjualan POS, Inventory, Pembelian, Customer, Karyawan, Pembayaran, Keuangan, Laporan, Pengaturan. RBAC Owner/Manager/Kasir/Gudang. Transaksi otomatis update stok/kas/laporan. Dashboard grafik, notifikasi stok, aktivitas. SaaS multi-tenant. UI modern responsif light/dark. REST API + JWT, real-time.

## User Choices (MVP)
- Fokus: Master Data (Produk, Kategori) + POS + Pembayaran + Dashboard + Inventory + Laporan
- Auth: JWT username/password dikelola super admin
- Database: MongoDB (bukan PostgreSQL) — disetujui user
- Pembayaran: Tunai, Kartu, QRIS, E-Wallet (manual, tanpa gateway)
- Bahasa: Indonesia

## Architecture
- Backend: FastAPI + MongoDB (Motor), semua route prefix `/api`, JWT auth (username-based), RBAC via require_roles, multi-tenant (tenant_id scoping).
- Frontend: React + Tailwind + shadcn/ui, Recharts, Framer Motion. AuthContext (token di localStorage `pos_token`), ThemeContext (light/dark). Route guards per role.
- Fonts: Outfit (display) + Manrope (body). Primary Electric Blue.

## User Personas
- Owner: akses penuh (semua modul, hapus, refund, kelola pengguna).
- Manager: hampir penuh (tanpa hapus akun sendiri).
- Kasir: Dashboard + POS.
- Gudang: Dashboard + Produk + Kategori + Inventory.

## Implemented (2026-08-01)
- Auth JWT + RBAC (Owner/Manager/Kasir/Gudang), owner seeding, multi-tenant.
- Master Data: Produk (CRUD, kategori, SKU/barcode, stok, min stok) & Kategori (CRUD, warna).
- POS Kasir: pencarian/scan, filter kategori, keranjang, qty, diskon, pajak, pembayaran (Tunai/Kartu/QRIS/E-Wallet), struk, auto-decrement stok.
- Inventory: penyesuaian stok (Masuk/Keluar/Opname/Penyesuaian) + riwayat pergerakan.
- Laporan: penjualan (total/laba/jumlah), metode pembayaran (pie), riwayat transaksi, refund (restore stok).
- Dashboard: omzet/laba hari ini, total, grafik 7 hari, produk terlaris, notifikasi stok menipis, aktivitas terbaru.
- Pengguna: kelola karyawan + hak akses. Pengaturan: outlet, pajak, mata uang, footer struk.
- Light/dark mode, responsif desktop/tablet/mobile.
- Backend tested 100% (20/20), frontend core flows verified.

## Update (2026-06-03)
- FIXED: Upload gambar produk (Products.jsx). Fungsi `handleImage` yang hilang (menyebabkan halaman error) diimplementasikan dengan kompresi otomatis HTML5 Canvas (resize maks 400px, JPEG 50%), disimpan base64 ke MongoDB. Tested E2E: upload → kompresi (17KB→~2KB) → simpan → thumbnail tampil. ✓
- CONFIRMED: Filter Bulan/Tahun Laporan sudah berfungsi (frontend konversi month/year → start/end; backend `/reports/sales` support start/end).

## Update (2026-06-03) — Bagian 2
- ADDED: Kirim Struk via WhatsApp (POS.jsx). Tombol hijau di struk membuka WhatsApp (wa.me deep link) dengan teks struk terisi otomatis + nomor pelanggan (jika ada, dinormalisasi ke format 62xx). Backend menyimpan `customer_phone` di dokumen sale. Tested E2E: URL `api.whatsapp.com/send?phone=62812345&text=...struk...` terverifikasi. ✓
- ADDED: Ekspor Laporan Excel (.xlsx) & PDF (Reports.jsx) via SheetJS + jsPDF/autotable. Kedua file terunduh, tanpa error JS. ✓
- ADDED: Grafik Tren Omzet Bulanan (Reports.jsx) — bar chart Jan–Des mengikuti tahun terpilih. Backend endpoint baru `GET /api/reports/monthly?year=`. Tested E2E. ✓

## Update (2026-06-03) — Bagian 3
- ADDED: Input Nomor WA manual di struk (POS.jsx). Kolom "Nomor WhatsApp pelanggan" muncul di struk, prefill dari pelanggan tersimpan, bisa diketik manual untuk pelanggan non-tersimpan. Nomor dinormalisasi (08xx → 62xx). Tested E2E. ✓
- ADDED: Halaman login mandiri `frontend/public/posdns.html` (self-contained, untuk di-host di domain pribadi user). Login → panggil `/api/auth/login` → redirect ke `SYSTEM_URL/?token=` → aplikasi auto-login. AuthContext.js membaca `?token=` dari URL, simpan ke localStorage, bersihkan URL. Tested E2E: login dari posdns.html → Dashboard terbuka otomatis. ✓
  - CATATAN DEPLOY: ganti konstanta `SYSTEM_URL` di posdns.html dengan URL produksi setelah deploy.

## Update (2026-06-03) — Bagian 4
- ADDED: Simpan Nomor Cepat (POS.jsx). Saat nomor WA diketik manual di struk untuk pelanggan non-tersimpan, muncul link "Simpan sebagai pelanggan baru" → prompt nama → POST /customers (nama + nomor). Daftar pelanggan langsung refresh. Tested E2E: pelanggan tersimpan dengan nomor benar. ✓

## Update (2026-06-04) — Redesain POS + Import Pelanggan
- ADDED: Redesain tampilan POS (POS.jsx). Grid utama kini menampilkan KOTAK KATEGORI (produk utama) sebagai thumbnail seragam 1:1 dengan badge jumlah varian; varian (produk dalam kategori) disembunyikan sampai kotak diklik → muncul dialog pemilih varian (`variant-dialog`) dengan nama varian (prefix kategori dihapus), harga, stok. Bisa tambah beberapa varian, tombol "Selesai" menutup. Pencarian/scan barcode tetap: mengetik → grid beralih ke kartu produk langsung. Tested E2E (testing agent iteration_3): PASS.
- ADDED: Upload gambar kategori (Categories.jsx) dengan kompresi Canvas (400px, JPEG 50%). Backend CategoryInput + create/update simpan field `image`. Gambar kategori dipakai sebagai thumbnail kotak di POS (fallback: gambar produk pertama → inisial). Tested E2E: PASS.
- DONE: Import 648 pelanggan dari CSV (`scripts/import_customers.py`), mengganti total data lama, termasuk jumlah kunjungan (visits) & total belanja (total_spent). Verified: 648 pelanggan, mis. GITA (177 kunjungan, Rp50.702.000).
- FIXED (deploy): tambah endpoint app-level `GET /health` → 200 (sebelumnya 404 menyebabkan deploy gagal).
- NOTE: posdns.html `SYSTEM_URL` diarahkan ke produksi (https://pos-retail-platform.emergent.host). File + README tersedia di public/.

## Update (2026-06-04) — Bagian 2
- ADDED: Pencarian pelanggan (Customers.jsx). Kolom cari nama/telepon (`customer-search`), label jumlah hasil (`customer-count`), tampil maks 200 kartu (persempit pencarian jika lebih). Tested E2E: cari "GITA" → 2 hasil. ✓
- ADDED: Auto-import 648 pelanggan ke PRODUKSI. Data dibundel di `backend/seed_customers.json` (648 rows). Startup backend meng-import otomatis JIKA koleksi customers kosong untuk tenant → produksi (DB Atlas fresh) akan terisi otomatis setelah deploy ulang. Verified lokal: hapus semua → restart → ter-seed 648. Import via CLI: `python scripts/import_customers.py` (replace-all, opsional).

## Update (2026-06-04) — Bagian 3
- ADDED: Reprint Nota di menu Pesanan (Orders.jsx). Tiap kartu pesanan punya tombol "Cetak Nota" (`reprint-order-*`) → cetak ulang nota thermal (iframe, 80mm) berisi item, subtotal, deposit, sisa/lunas, status. Ambil settings toko untuk header/footer. Tested E2E: 5 tombol muncul, klik tanpa error.
- ADDED: Pencarian pelanggan di POS (POS.jsx). Select dropdown 648 pelanggan diganti combobox (Popover + Command) dengan kolom cari nama/nomor (`pos-customer-search`). Tested E2E: cari "GITA" → hasil terfilter, pilih → trigger update, tanpa pointer-events lock.

## Update (2026-06-05) — Branding, Kredensial, Printer
- CHANGED: Super-admin credentials → username `admin`, password `Limited0`. backend/.env OWNER_USERNAME/OWNER_PASSWORD diperbarui. Startup migration merename Owner lama ke `admin` + reset password (idempotent: jalan otomatis di produksi setelah redeploy). Preview sudah diperbaiki (single owner `admin`, tenant 300 produk).
- ADDED: Endpoint `POST /api/admin/clear-transactions` (Owner-only) → hapus sales/orders/held_orders/activities/stock_movements (produk & pelanggan aman). UI tombol "Reset Data Transaksi" di Pengaturan (Danger Zone). Transaksi percobaan preview sudah dikosongkan.
- CHANGED: Nama aplikasi → "Daneswara POS" (Layout, Login, index.html title, default receipt name, settings.business_name). Logo usaha (`frontend/public/logo.png`) dipasang di sidebar + login. Logo juga tampil di struk cetak Desktop/HTML.
- ADDED: Menu Printer di Pengaturan (super admin). Mode cetak: Desktop/USB (dialog print, semua perangkat) atau Bluetooth Thermal 58mm (Web Bluetooth, Chrome Android/Windows, printer BLE; TIDAK di iOS). Tombol Hubungkan/Putus printer BLE, status, Cetak Tes. Util baru `frontend/src/lib/printer.js` (ESC/POS encoder + BLE + desktop iframe). POS.jsx & Orders.jsx pakai `printReceiptSmart`.
- NOTE printer BLE: logo hanya di cetak Desktop (ESC/POS thermal = teks + nama toko besar). Printer target user: EP5805AI.

## Update (2026-06-05) — Bagian 2: Logo Struk Thermal, Ubah Password, Logo Baru
- CHANGED: Logo aplikasi diganti ke logo baru (Odin kepala emas / kuning) di `frontend/public/logo.png`. Kontainer logo diberi latar gelap (sidebar/login) agar kontras.
- ADDED: Upload "Logo Struk" di Pengaturan → disimpan base64 di `settings.logo`. Dipakai di cetak Desktop (HTML) & thermal. Kosong = pakai logo aplikasi default.
- ADDED: Cetak logo pada printer Bluetooth thermal (ESC/POS raster GS v 0). `printer.js` → `imageToRaster()` konversi gambar ke bitmap 1-bit (lebar 384 dots), threshold non-putih jadi tinta (logo kuning tercetak sebagai siluet hitam). `buildEscPos` kini async, prepend logo raster + nama toko.
- ADDED: Ubah Password sendiri. Backend `POST /api/auth/change-password` (verify password lama via verify_password, min 6 char). UI: tombol kunci di header (semua role) → dialog Ubah Password. Tested: tolak password salah, ganti sukses, login password baru, revert. ✓

## Backlog (Next)
- P1: Split Bill, Hold Order, Barcode scanner hardware, cetak thermal ESC/POS asli.
- P1: Customer/Membership + Poin Loyalitas, Pembelian/Purchase Order + Supplier.
- P2: Keuangan (kas masuk/keluar, rekonsiliasi), Varian & Modifier produk, multi-outlet.
- P2: Customer Display, Mobile app, integrasi gateway pembayaran asli, backup/export.
- P2: Modul akuntansi, CRM, marketplace.
