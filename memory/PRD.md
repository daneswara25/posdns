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

## Update (2026-06-05) — Bagian 3: Catatan per Item di Struk
- ADDED: Kolom "Catatan" di bagian bawah dialog pemilihan varian POS (`variant-note-input`). Catatan menempel ke item yang ditambahkan (per baris keranjang; item sama dengan catatan berbeda = baris terpisah via `lineId`). Backend `SaleItem.note` (juga berlaku untuk held-orders & pesanan deposit karena semua pakai List[SaleItem]).
- Catatan tampil di: keranjang (📝), struk layar, cetak Desktop/HTML (`.note`), cetak thermal ESC/POS (`* catatan`), dan teks WhatsApp. Cart ops (qty/hapus) direfactor ke `lineId`; resume held-order backfill lineId.
- Tested E2E: tambah varian + catatan "Sablon logo depan ukuran L" → tampil di keranjang & struk, tersimpan di backend. ✓

## Update (2026-06-05) — Bagian 4: Modul Pengeluaran, Laba Rugi, Stok Minus
- ADDED: Halaman **Pengeluaran** (`/pengeluaran`, Owner/Manager) — catat pengeluaran dgn 5 kategori (Pembelian Bahan DTF, Pembelian ATK, Biaya Operasional, Jasa Pengambilan Online, Pembelian Lain-lain), nominal, tanggal, catatan; daftar + total + hapus. Backend: `ExpenseInput`, `POST/GET/DELETE /api/expenses`, `GET /api/expense-categories`.
- ADDED: **Laba Rugi** di halaman Laporan (mengikuti filter periode). Endpoint `GET /api/reports/profit-loss` → revenue, hpp, gross_profit, expense_total, expenses_by_category, net_profit. Rumus headline: **Laba Bersih = Total Penjualan − Total Pengeluaran** (HPP & Laba Kotor ditampilkan sebagai referensi).
- CHANGED: **Stok minus diizinkan** di POS untuk semua produk (blokir "Stok habis" di frontend dihapus; backend memang sudah izinkan negatif). Stok ≤ 0 ditampilkan merah "(minus)". Diisi kembali via menu Pembelian/terima barang.
- CHANGED: `clear-transactions` kini juga menghapus koleksi `expenses`.
- Tested E2E: pengeluaran tercatat, laba rugi akurat (Laba Bersih = Penjualan − Pengeluaran), penjualan menembus stok negatif (93→−7) berhasil. Data tes dibersihkan.

## Update (2026-06-05) — Bagian 5: Thumbnail POS lebih kecil & responsif
- CHANGED: Grid produk/kategori POS jadi responsif rapat: `grid-cols-3 sm:4 md:6 xl:8 2xl:10`, gap-2. Kartu & tile dibuat compact (padding/teks/badge lebih kecil). Split layout produk:keranjang dari 8:4 → 9:3 agar area produk lebih dominan.
- Terverifikasi jumlah thumbnail terlihat: Desktop ~49, Tablet ~30, Mobile ~15 (sesuai target user ~40/~30/~12). Tanpa error JS.

## Update (2026-06-05) — Bagian 6: Kepadatan Grid + Branding posdns.html
- ADDED: Tombol kepadatan grid POS (Besar/Sedang/Kecil) di kanan kolom pencarian (`grid-density-toggle`, `density-*`). Pilihan disimpan di localStorage (`pos_density`). Konstanta `POS_GRID` menentukan jumlah kolom per mode. Verified: Besar ~18 tile, Kecil ~49 tile terlihat.
- CHANGED: `frontend/public/posdns.html` kini menampilkan nama "DANESWARA POS" + logo (di-embed base64 dari paladin.webp, di hero & panel form) + footer. Logo juga disalin ke `public/logo-danes.webp`. File tetap self-contained untuk di-host di domain pribadi.

## Update (2026-06-05) — Bagian 7: Perbaikan logo posdns.html
- CHANGED: Logo di posdns.html diganti ke logo kuning/gold (`public/logo.png`) yang di-embed base64, dan chip logo dibuat latar gelap (#0f172a) di hero & form agar logo kontras/jelas terlihat. Verified: 2 logo termuat, tampil jelas.

## Update (2026-06-06) — Fork lanjutan
- FIXED (P0): Bug catatan varian di POS. Varian yang dipilih kini ditampung sementara (tempItems) di dalam dialog; catatan diterapkan ke SEMUA varian saat tombol "Selesai" diklik (commitVariants dipanggil eksplisit di onClick karena Radix Dialog terkontrol tidak memicu onOpenChange saat close programatik). Verified iteration_4 (100%).
- ADDED: Catatan pada item keranjang POS bisa diedit ulang & disimpan (tombol pensil -> textarea -> Simpan/Batal). saveEditNote me-rekey lineId & merge bila bentrok.
- ADDED (P1): Pengingat Stok Minus di Dashboard (kartu merah, data-testid minus-stock-card) — backend GET /api/dashboard kini mengembalikan minus_stock & minus_stock_count.
- CHANGED: posdns.html — hapus teks eyebrow "Masuk" di bawah logo.
- ADDED: Kolom pencarian di semua halaman daftar yang belum punya (Kategori, Supplier, Pengguna, Pesanan, Pembelian, Inventory, Pengeluaran). Produk & Pelanggan sudah ada.
- ADDED: Toggle tampilan (Kartu Besar / Kartu Kecil / List) tersimpan di localStorage pada halaman master data (Produk default 'list', Pelanggan/Kategori/Supplier default 'besar'). Komponen baru: `components/ViewToggle.jsx`.
- ADDED: Pemisah ribuan otomatis gaya Indonesia (1.500.000) pada SEMUA input angka via komponen baru `components/NumberInput.jsx` (emit angka murni). Diterapkan di Produk, Pengeluaran, Orders, Purchases, Inventory, POS (diskon/bayar/deposit).
- Verified iteration_5 & iteration_6 (2 crash P0 diperbaiki: Products.jsx useViewMode, Suppliers.jsx import) — semua skenario 100% pass.


## Update (2026-06) — Tata letak Kasir POS responsif (orientasi)
- CHANGED: Halaman Kasir POS (`frontend/src/pages/POS.jsx`) dirombak agar produk jadi area utama besar & keranjang panel sempit — sesuai gambar referensi.
  - Hook baru `useWideLayout()` deteksi via matchMedia `(min-width: 1024px), (orientation: landscape)`.
  - Landscape/Desktop/Tablet landscape: keranjang tampil sebagai panel samping tetap (`aside` lebar 340px, `data-testid=cart-panel`). Layout container jadi flex (bukan grid lg:col-span).
  - Portrait (HP): produk full-width; keranjang disembunyikan; muncul tombol mengambang `pos-cart-fab` (kanan-bawah) dengan badge jumlah item + total. Klik → drawer `cart-sheet` (Sheet dari kanan) berisi keranjang lengkap.
  - Isi keranjang diekstrak ke variabel `cartBody` (dipakai di panel & drawer). Drawer menutup otomatis setelah bayar/deposit/tahan (`setCartOpen(false)`), dan cleanup `document.body.style.pointerEvents` saat drawer ditutup.
- Verified (self-test screenshot): landscape panel OK, portrait FAB+badge+total OK, drawer OK, checkout tunai end-to-end di portrait → struk tampil, pointerEvents bersih setelah tutup.

## Update (2026-06) — Dukungan Printer 80mm + Manajemen Jenis Printer
- FIXED: Pencetakan kini sadar lebar kertas. `frontend/src/lib/printer.js` — ESC/POS `WIDTH` (32/48 kolom) & raster `RASTER_W` (384/576 dot) serta `@page size` (58mm/80mm) mengikuti `settings.paper_width`. Sebelumnya di-hardcode 58mm sehingga struk sempit di printer 80mm (VSC TM-80D kini tercetak penuh). `imageToRaster(src, maxW)` menerima lebar maksimum. Logo di Settings di-resize 384/576 sesuai lebar kertas.
- ADDED: Manajemen "Daftar Printer (Jenis Printer)" di halaman Pengaturan (Owner/Manager). Profil printer disimpan di `settings.printers` (array: {id, name, connection, paper_width}) + `settings.active_printer`. Bisa Tambah/Ubah/Hapus/Jadikan Aktif. Mengaktifkan profil menyetel `print_mode` (desktop/bluetooth) + `paper_width` yang dipakai `printReceiptSmart` di seluruh app. Menggantikan dropdown "Mode Cetak" tunggal sebelumnya.
- Backend: `SettingsInput` menambah field `paper_width`, `printers`, `active_printer` (server.py).
- Catatan koneksi VSC TM-80D (USB+BT, 80mm): USB/Desktop paling andal (cetak lewat dialog browser); Bluetooth hanya jika printer mendukung BLE (Chrome Android/Windows; tidak jalan di iPhone/Safari).
- Verified: curl PUT/GET /api/settings menyimpan printers+paper_width; UI tambah/aktif/hapus + Simpan (toast "Pengaturan disimpan") terverifikasi via screenshot; 2 profil tersimpan (VSC TM-80D desktop 80mm aktif + Printer BT bluetooth 80mm).

## Backlog (Next)
- P1: Split Bill, Hold Order, Barcode scanner hardware, cetak thermal ESC/POS asli.
- P1: Customer/Membership + Poin Loyalitas, Pembelian/Purchase Order + Supplier.
- P2: Keuangan (kas masuk/keluar, rekonsiliasi), Varian & Modifier produk, multi-outlet.
- P2: Customer Display, Mobile app, integrasi gateway pembayaran asli, backup/export.
- P2: Modul akuntansi, CRM, marketplace.
