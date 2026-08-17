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

## Update (2026-06) — Fix logo cetak kebesaran (raster memenuhi kertas)
- FIXED: Logo struk tercetak sangat besar & menghabiskan kertas (teks tidak keluar / cetak putus di tengah). Akar masalah: `/logo.png` berukuran 746×1279 (potret sangat tinggi); `imageToRaster` lama hanya membatasi LEBAR sehingga TINGGI ikut membesar (ratusan-ribuan dot).
- CHANGED (`frontend/src/lib/printer.js`): `imageToRaster(src, {maxW, maxH, fullW})` kini membatasi lebar DAN tinggi (jaga aspek rasio) lalu MEMUSATKAN logo di lebar cetak penuh (canvas di-pad, byte-aligned) sehingga rata tengah tanpa bergantung dukungan justify printer. Di `buildEscPos`: logo dibatasi `maxW = 0.42×RASTER_W` (~1/3–1/2 lebar) & `maxH = 160` dot. Hasil dgn logo asli: 93×160 dot (~12×20mm) — kecil-sedang.
- CHANGED: Logo mode Desktop/HTML dibatasi `max-width:40%; max-height:70px`.
- Verified: via page.evaluate di browser, logo asli (746×1279) → capped 93×160 (80mm & 58mm). Cetak thermal nyata belum diverifikasi agen (butuh perangkat); user perlu REDEPLOY karena diuji di produksi.

## Update (2026-06) — Harga manual di POS + Cocokkan Katalog + Reset Stok
- ADDED (Fitur 1 — Harga manual): Produk dengan `price` 0/kosong kini bisa diisi harganya saat transaksi di Kasir. `Products.jsx`: validasi tidak lagi mewajibkan harga (kosong → 0). `POS.jsx`: helper `needPrice`, dialog "Masukkan Harga" (`price-dialog`, `price-input`, `price-confirm-button`). Berlaku di jalur pencarian langsung (`openPrice(p,'direct')`) & jalur varian (`openPrice(p,'variant')`, harga disimpan di tempItem). `lineId` kini menyertakan harga (`${id}|${note}|${price}`) agar harga manual berbeda tidak tergabung. Kartu produk/varian berharga 0 menampilkan "Harga manual"/"Manual".
- ADDED (Fitur 2 — Cocokkan Katalog): Endpoint `POST /api/admin/reprice-catalog` (Owner). Membaca `backend/data/export_items.csv` (bundled), cocokkan produk via **SKU**, timpa `price` ← kolom `Price [DANESWARA PRINTING]` (nilai `variable`/kosong → 0) dan `cost` ← kolom `Cost`. Verified preview: 300/300 cocok, contoh Gold K price 75000/cost 65000, Drill SS price 0/cost 62000, DTF Meteran price 0/cost 300.
- ADDED (Fitur 3 — Reset Stok): Endpoint `POST /api/admin/reset-stock` (Owner) → set stok semua produk = 0. Verified: 300 produk → 0.
- UI: `Settings.jsx` bagian baru "Katalog & Stok" (Owner) dengan tombol `reprice-catalog-button` & `reset-stock-button` (konfirmasi via window.confirm). Backend: `import csv`, helper `_parse_catalog_num`.
- CATATAN DEPLOY: Operasi #2 & #3 dijalankan di PREVIEW untuk pengujian. Produksi punya DB terpisah → user harus REDEPLOY lalu klik kedua tombol di Pengaturan pada produksi (CSV ikut ter-deploy di backend/data).

## Update (2026-06) — Default stok produk = 0 + link posdns
- CHANGED: `Products.jsx` `EMPTY.stock` dari "" → 0 sehingga form Tambah Produk menampilkan Stok 0 secara eksplisit (produk baru mulai dari stok 0). Verified via screenshot: field Stok = "0".
- Preview DB: semua 300 produk stok = 0 (reset-stock idempotent). Produksi: jalankan tombol "Reset Semua Stok = 0" (Pengaturan → Katalog & Stok) setelah redeploy karena DB terpisah.
- posdns.html link: Produksi https://pos-retail-platform.emergent.host/posdns.html ; Preview https://kasir-dashboard-4.preview.emergentagent.com/posdns.html. SYSTEM_URL di file = produksi.

## Update (2026-06) — Ikon produk mewarisi thumbnail kategori
- CHANGED (`Products.jsx`): produk tanpa gambar sendiri kini menampilkan **thumbnail kategorinya** (fallback: `p.image || catThumb(p.category_id)`), baru fallback ke ikon `Package` bila kategori juga tak bergambar. Helper baru `catThumb(id)`. Berlaku di tampilan List & Kartu (Besar/Kecil).
- Verified: set sementara gambar kategori APRON → produk APRON tanpa gambar sendiri (Gold K/SERIES/WP) memakai gambar kategori, Drill SS tetap pakai foto sendiri; gambar uji dikembalikan ke kosong.
- Catatan: user mengatur thumbnail per kategori di halaman Kategori; produksi perlu redeploy agar perubahan aktif.

## Update (2026-06) — Fix tabel list tidak bisa geser horizontal di mobile
- FIXED (bug): Di mobile portrait, tabel list memotong kolom kanan (mis. STATUS/aksi) & tidak bisa digeser. Penyebab: wrapper tabel memakai `overflow-hidden` yang mengklip overflow horizontal.
- CHANGED: Wrapper tabel di `Products.jsx`, `Purchases.jsx`, `Expenses.jsx`, `Users.jsx` → `overflow-x-auto` + `<table>` diberi `min-w-[640px]`. `Inventory.jsx` & `Reports.jsx` → `overflow-auto` + `<table min-w-[560px]>`.
- Verified oleh testing_agent (iteration_7.json, frontend 100%): keenam halaman bisa scroll horizontal di 390x844 (scrollWidth>clientWidth, scrollLeft berubah); regresi desktop 1440 bersih.

## Update (2026-06) — Hapus foto di form produk + Atur urutan produk POS
- CHANGED (`Products.jsx`): field "Gambar Produk" + fungsi `handleImage` dihapus dari form Tambah/Edit Produk (foto tidak lagi ditampilkan/diunggah di form). Field image tetap ada di data model (tidak dihapus dari DB) tapi tidak diedit dari form.
- ADDED (Fitur urutan POS): 
  - Backend: field produk `sort_order`; `GET /products` diurutkan by sort_order asc lalu nama; produk baru dapat `sort_order = count`; endpoint baru `POST /api/products/reorder` body `{ids:[...]}` set sort_order per index (Owner/Manager/Gudang).
  - Frontend: tombol "Atur Urutan" di halaman Produk membuka dialog `reorder-dialog` — pilih kategori, daftar produk bernomor dgn panah naik/turun (`reorder-up/down-<id>`), `reorder-save-button` → POST reorder. POS mengurutkan produk per kategori mengikuti sort_order (grouping mempertahankan urutan API).
- Verified: curl reorder APRON (urutan terbalik, sort_order 0..3 & GET mencerminkannya); screenshot form tanpa foto & dialog urutan + simpan berhasil.

## Update (2026-06) — Redesign posdns.html agar sama dengan Login aplikasi
- CHANGED (`frontend/public/posdns.html`, 100% standalone): Panel kiri dari gradient → foto latar kasir (Unsplash sama seperti `Login.jsx`) + overlay biru gelap `rgba(23,37,84,.72)` (setara bg-blue-950/70). Logo dipindah ke pojok kiri-bawah dalam kotak translucent (rounded, backdrop-blur, ring), diikuti judul `Daneswara POS` + tagline — persis aplikasi.
- CHANGED: Panel kanan ditambah eyebrow "MASUK" di atas "Selamat datang kembali"; brand row disembunyikan di desktop (`@media min-width:861px`), tetap tampil di mobile (hero disembunyikan di ≤860px). Label Username/Password & tombol biru "Masuk" tetap.
- UNCHANGED: Logika JS login, `SYSTEM_URL`, alur token, & konfigurasi CORS tidak diubah. Logo base64 dipertahankan (edit dilakukan surgical via string replace).
- Verified: screenshot `localhost:3000/posdns.html` menampilkan layout split-screen identik dgn aplikasi React.

## Update (2026-06) — Balik foto produk + hapus thumbnail list + urutan kategori
- REVERTED (`Products.jsx`): Fungsi upload **Foto Produk** dikembalikan ke form Tambah/Edit Produk (handleImage kompres ke JPEG maks 400px, disimpan base64 ke field `image`). `data-testid="product-image-input"` & `product-image-remove`.
- CHANGED (performa): Thumbnail foto DIHAPUS dari daftar produk Master Data — view list memakai ikon `Package` saja (tidak memuat gambar), view grid kartu tanpa blok gambar. Fungsi `catThumb` dihapus. Tujuan: mencegah sistem lambat saat menampilkan banyak produk.
- ADDED (Urutan Kategori di POS):
  - Backend: field kategori `sort_order`; `GET /categories` diurutkan by sort_order asc lalu nama; kategori baru dapat `sort_order = count`; endpoint baru `POST /api/categories/reorder` body `{ids:[...]}` (Owner/Manager/Gudang).
  - Frontend: tombol "Atur Urutan" di halaman Kategori membuka `reorder-category-dialog` dgn panah `reorder-category-up/down-<id>` & `reorder-category-save-button`. POS otomatis mengikuti urutan karena `catTiles` dibangun dari array `categories` (kini tersortir dari API).
- Verified: curl (categories reorder mengubah urutan & sort_order 0..2; product create menyimpan `image`); screenshot (form Foto Produk tampil, list tanpa thumbnail, dialog urutan kategori 52 item).

## Pending (menunggu keputusan user)
- Fitur "Lupa password" di halaman Login (aplikasi & posdns) — menunggu user memilih mekanisme (Hubungi Admin / Email / WhatsApp).

## Update (2026-06) — Logo tanpa frame + metode pembayaran Bank Transfer
- CHANGED (logo): Kotak/frame hitam di belakang logo dihapus di `posdns.html` (`.hero .logo` → tanpa background/backdrop/ring) dan `Login.jsx` (hero logo & mobile brand logo → tanpa `bg-black/40`/`bg-neutral-900`). Logo tampil polos.
- CHANGED (metode pembayaran): "Kartu" DIGANTI menjadi **Bank Transfer** dengan 3 sub-rekening: **BCA TOKO**, **BRI TOKO**, **BCA ADMIN (ELIS)**.
  - Backend (`server.py`): `Literal` payment_method & deposit_method (3 tempat) kini `["Tunai","BCA TOKO","BRI TOKO","BCA ADMIN (ELIS)","QRIS","E-Wallet"]` (Kartu dihapus). Data lama ber-metode "Kartu" tetap aman di laporan (validasi hanya saat input).
  - Frontend (`POS.jsx`): `METHODS=["Tunai","Bank Transfer","QRIS","E-Wallet"]` + `BANKS=[3 rekening]`. Helper `renderMethodPicker(prefix)` dipakai di dialog Pembayaran & Deposit — memilih "Bank Transfer" menampilkan 3 tombol rekening (nilai `method` = rekening spesifik, tersimpan & tercetak di struk). testid: `pay-method-Bank Transfer`, `pay-bank-options`, `pay-bank-<nama>`, dan varian `deposit-*`.
- Verified: curl (sale BCA TOKO → 200, Kartu → 422; sale uji di-refund agar data bersih); screenshot (dialog pembayaran menampilkan 3 rekening; urutan kategori POS mengikuti reorder).

## Update (2026-06) — POS: hapus label modal + jumlah item bisa diketik manual
- CHANGED (`POS.jsx`): Label "· Modal Rp..." dihapus dari dialog input harga manual POS (`price-dialog`) — kini hanya menampilkan nama produk.
- ADDED (input jumlah manual): Jumlah item kini bisa DIKETIK langsung (untuk input qty banyak), selain tombol +/-.
  - Keranjang: `<input type=number>` `data-testid="cart-qty-input-<pid>"` + helper `setQtyAbs(lineId,val)` (clamp min 1, select-all saat fokus).
  - Dialog varian: qty jadi `<input>` `data-testid="variant-qty-<pid>"` + helper `setTempQty(p,val)` (clamp min 1). Footer "Selesai — Tambah N item" mengikuti.
- Verified: screenshot — ketik "25" di qty varian → footer "Tambah 25 item". Pola input keranjang identik.

## Update (2026-06) — Laporan: Ringkasan Per Rekening
- ADDED (`server.py` `/reports/sales`): `by_method` kini menyertakan `count` per metode (`{method,total,count}`) — tetap kompatibel dgn pie chart.
- ADDED (`Reports.jsx`): Kartu **"Ringkasan Per Rekening / Metode"** (`account-summary-section`) menampilkan tiap metode (Tunai, BCA TOKO, BRI TOKO, BCA ADMIN (ELIS), QRIS, E-Wallet) beserta jumlah transaksi & total, diurutkan (`METHOD_ORDER`), rekening bank ditandai ikon. Baris ringkas **"Total Transfer Bank"** (`account-bank-total`, `account-bank-count`) menjumlahkan 3 rekening bank untuk rekonsiliasi kas.
- ADDED: Ekspor Excel kini memuat blok "Ringkasan Per Rekening / Metode".
- Verified: curl (by_method+count); screenshot (Tunai 3x/Rp186rb, BCA TOKO 2x/Rp100rb, BRI TOKO 1x/Rp50rb, Total Transfer Bank 3x/Rp150rb). Data uji di-refund agar bersih.

## Update (2026-06) — Menu Ekspor Data (CSV)
- ADDED (backend `server.py`): Endpoint `GET /api/export/{dataset}?start=&end=` (Owner-only) mengembalikan file CSV (UTF-8 + BOM utk Excel, `Content-Disposition` attachment, nama file berisi tanggal). Dataset: sales, orders, purchases, expenses, stock_movements, activities (bisa difilter tanggal via `created_at`), + products, categories, customers, suppliers, users (master, tanpa filter). Nilai nested (list/dict) → JSON string; nilai base64 gambar diganti "[gambar tersimpan]" agar CSV tetap valid di Excel. Kolom Pengguna termasuk `password_hash` (sesuai permintaan Owner). Dataset tak dikenal → 404.
- ADDED (frontend): Halaman `ExportData.jsx` (route `/ekspor`, menu sidebar "Ekspor Data" Owner-only) — filter tanggal dari–sampai (berlaku utk transaksi), kartu per dataset dgn tombol "CSV", dan tombol "Unduh Semua CSV" (unduh semua berurutan). testid: `export-card-<key>`, `export-btn-<key>`, `export-all-button`, `export-start`, `export-end`.
- Verified: curl (products/sales/users CSV, filter tanggal → header saja utk rentang kosong, 404 utk dataset salah, gambar ter-strip); screenshot + unduhan nyata (`products_2026-08-09.csv`).

## Update (2026-06) — Grafik Tren Laba Bersih & Pengeluaran (Laporan)
- CHANGED (backend `/reports/monthly`): tiap bulan kini juga menghitung `expense` (dari `db.expenses` via field `date`) dan `net` (= total penjualan − pengeluaran). `profit` (laba kotor) tetap ada.
- ADDED (`Reports.jsx`): kartu grafik baru **"Tren Laba Bersih & Pengeluaran {year}"** (`net-profit-trend-chart`) — BarChart 2 seri: Laba Bersih (hijau) & Pengeluaran (merah) per bulan, dengan legenda + ringkasan "Laba Bersih setahun". Diletakkan setelah grafik "Tren Omzet Bulanan".
- Verified: curl (Agu: total 186rb, expense 75rb → net 111rb) + screenshot (dua grafik tampil benar). Pengeluaran uji sudah dihapus agar data bersih.

## Update (2026-06) — Modul Pendapatan Lain-lain
- ADDED (backend `server.py`): koleksi `other_income`, kategori tetap `OTHER_INCOME_CATEGORIES` = [Biaya layanan, Biaya express, Biaya tambahan/order khusus, Pendapatan komisi]. Endpoint: `GET /other-income-categories`, `GET /other-income` (start/end), `POST /other-income`, `DELETE /other-income/{id}` — semua Owner/Manager.
- INTEGRATED (Laba Rugi `/reports/profit-loss`): tambah `other_income_total` & `other_income_by_category`; **net_profit = revenue + other_income − expense_total**. `/reports/monthly`: tambah `other_income` per bulan & `net` ikut memperhitungkannya (grafik tren laba bersih otomatis update).
- INTEGRATED (ekspor & reset): `other_income` masuk `EXPORT_COLLECTIONS` (+date-filterable) dan ikut terhapus pada `admin/clear-transactions`.
- ADDED (frontend): halaman `OtherIncome.jsx` (route `/pendapatan-lain`, menu sidebar "Pendapatan Lain-lain" ikon HandCoins, Owner/Manager) — mirror Pengeluaran, tema hijau. Reports Laba Rugi menampilkan blok hijau "Pendapatan Lain-lain" + rincian kategori & catatan formula diperbarui. Kartu ekspor "Pendapatan Lain-lain" ditambahkan.
- Verified: curl (kategori, create → profit-loss net 226rb = 186rb+40rb, monthly oi/net) + screenshot (halaman + dropdown 4 kategori + Laba Rugi blok hijau & Laba Bersih Rp226.000). Data uji dihapus.

## Update (2026-06) — Redesign posdns.html tema VINTAGE (beda dari aplikasi)
- CHANGED (`frontend/public/posdns.html`, dibangun ulang via skrip generator sementara agar logo base64 & SYSTEM_URL utuh): Tampilan login standalone kini bertema **vintage/retro** dan sengaja BERBEDA dari halaman login aplikasi React.
  - Latar kertas krem + tekstur grain (SVG noise) + vignette. Kartu tengah berbingkai ganda dengan hiasan sudut siku. Badge logo bundar (ring ganda). Font Playfair Display (judul) + Special Elite (mesin tik). Palet: krem #efe6d3, tinta coklat #2c241d, aksen rust #a4472c, teal #2f5d57. Tombol "MASUK" rust dengan bayangan retro.
  - Tetap "Daneswara POS" + tagline. 100% standalone; logika JS login (fetch ke SYSTEM_URL `pos-retail-platform.emergent.host`, redirect `?token=`) & id elemen (loginForm/submitBtn/msg/username/password) tidak diubah.
- Verified: screenshot `localhost:3000/posdns.html` (layout vintage, form+tombol ada, h1 benar). CATATAN: file ini di-hosting user di www.daneswara.com — harus diunggah ulang manual agar berubah di domain tsb.

## Update (2026-06) — Detail transaksi di Riwayat Transaksi (Laporan)
- ADDED (`Reports.jsx`): Setiap baris di tabel "Riwayat Transaksi" kini dapat diklik (cursor-pointer + hover) untuk membuka dialog **Detail Transaksi** (`sale-detail-dialog`): invoice, waktu, badge status (Lunas/Refunded), Kasir, Metode, Pelanggan+No.HP, tabel item (nama, catatan, qty, harga, subtotal), lalu Subtotal, Diskon, Pajak, Total, Dibayar, Kembalian. Data diambil dari `rep.sales` (tanpa ubah backend). Tombol Refund pakai `stopPropagation` agar tidak ikut membuka detail. Cleanup `pointerEvents` saat dialog ditutup (anti Radix lock).
- Verified: screenshot (klik baris → dialog menampilkan item APRON - Drill SS, Total Rp62.000, Dibayar Rp200.000, Kembalian Rp138.000).

## Update (2026-06) — Cetak Ulang Struk dari Detail Transaksi
- ADDED (`Reports.jsx`): Tombol **"Cetak Ulang Struk"** (`reprint-receipt-button`) di footer dialog Detail Transaksi. Memuat `settings` dari `GET /settings` dan memanggil `printReceiptSmart(detailSale, settings)` (logika sama persis dgn cetak struk di POS): mode Bluetooth thermal (ESC/POS) bila diset di Pengaturan, selain itu cetak desktop. Toast sukses/gagal. Tidak ada perubahan backend.
- Verified: screenshot (tombol tampil di dialog detail). Catatan: cetak fisik butuh printer terhubung / mode cetak sesuai Pengaturan — fungsi identik dengan yang sudah teruji di checkout POS.

## Update (2026-06) — Revert posdns.html ke tema biru-putih + fix logo overflow
- REVERTED (`frontend/public/posdns.html`): dikembalikan dari commit `1cfeb80` (tema **biru-putih modern**, split-screen foto + overlay biru `rgba(23,37,84,.72)`, tombol biru `rgb(37,99,235)`, "Daneswara POS" + "Selamat datang kembali"). Tema vintage dibuang sesuai permintaan user.
- FIXED (bug logo keluar frame): Logo PNG berorientasi portrait (746x1279) sebelumnya dipaksa `width/height:100%` → render ~64x110px & menimpa judul. Diperbaiki dgn `.hero .logo .mark img { max-width:64px; max-height:64px; width:auto; height:auto; object-fit:contain }` dan `.box .brand .mark img { max-width:48px; max-height:48px; ... }`. Aspek rasio terjaga, logo pas di dalam kotak.
- Verified oleh testing_agent (iteration_9.json, frontend 100%): desktop img 37x64 (tak menimpa h1), mobile img 28x48 (tak menimpa eyebrow), tema biru-putih & form login (#username/#password/#submitBtn) utuh. CATATAN: user berencana menyiapkan file logo dengan rasio sesuai; jika nanti diberikan, cukup ganti base64/URL logo.

## Update (2026-06) — Ganti logo posdns.html (logo biru)
- CHANGED (`frontend/public/posdns.html`): Kedua logo (hero + brand mobile) diganti dengan file baru **"logo biru.png"** (biru gradient, ~470x470 persegi) via base64. Tampil proporsional: desktop 64×64 (tak menimpa judul), mobile 48×48. Selaras dengan aksen biru tema. Verified via screenshot + boundingRect di kedua viewport.

## Update (2026-06) — Fix metode bank di dialog Pelunasan (Pesanan/Orders)
- FIXED BUG (`Orders.jsx`): Dialog "Pelunasan" di halaman Pesanan masih memakai "Kartu" (belum ikut update Bank Transfer). Kini `METHODS=['Tunai','Bank Transfer','QRIS','E-Wallet']` + sub-rekening `BANKS` (BCA TOKO/BRI TOKO/BCA ADMIN (ELIS)) — sama seperti dialog POS. Memilih "Bank Transfer" menampilkan `settle-bank-options` (default BCA TOKO). Backend `SettleOrderInput`/`complete_order` sudah menerima nilai bank (tidak berubah).
- Verified oleh testing_agent (iteration_10.json, backend & frontend 100%): pelunasan ORD-260805-0001 dgn "BRI TOKO" berhasil → sale INV-260811-0008 tersimpan `payment_method='BRI TOKO'`. (Catatan: form BUAT deposit ada di POS & sudah pakai Bank Transfer sejak update sebelumnya.)

## Update (2026-06) — Nota deposit+status, fix data pelanggan, akses Kasir (Pengaturan Printer + Riwayat)
- ITEM 1 (Nota deposit + status + aksi): `printer.js` tambah `paymentStatus(r)` → "DEPOSIT" (pesanan belum lunas) / "LUNAS VIA <metode>". Status dicetak di struk ESC/POS & desktop. Komponen baru `NotaDialog.jsx` (reusable) dgn aksi **Cetak / Kirim WA / Salin** + helper `buildReceiptText/sendReceiptWhatsApp/copyReceiptText`. Dipakai di: POS (setelah buat DP → nota status DEPOSIT), Orders (tombol "Nota" + setelah Pelunasan → nota LUNAS VIA), Riwayat. Backend `complete_order` menyimpan `payment_method/settle_paid/remaining` di order.
- ITEM 2 (FIX data pelanggan): `GET /customers` kini menghitung `total_spent` & `visits` dari transaksi NYATA (agregasi sales non-refund per customer_id) — angka impor lama yg tidak sinkron digantikan. `GET /customers/{id}/history` kini exclude refund. Verified: GITA 51.8jt/183x → 76rb/1x, kartu = jumlah history.
- ITEM 3 (Kasir Pengaturan Printer): route `/pengaturan` + menu untuk Kasir. `Settings.jsx` sembunyikan "Informasi Outlet" utk non-Owner/Manager (Katalog & Danger Zone tetap Owner). Backend `PUT /settings` → `get_current_user`; non-Owner/Manager hanya boleh field printer `{print_mode,paper_width,printers,active_printer,logo}`.
- ITEM 4 (Kasir Riwayat Transaksi): halaman baru `RiwayatTransaksi.jsx` (route `/riwayat`, menu Owner/Manager/Kasir) — daftar semua transaksi via `GET /sales?limit=1000`, kotak **pencarian** (invoice/pelanggan/metode/kasir), klik baris/aksi "Nota" → NotaDialog (detail + Cetak/WA/Salin).
- Verified oleh testing_agent (iteration_11.json): backend 7/7; item 2,3,4 & pelunasan item1 lulus penuh; jalur DEPOSIT di POS diverifikasi mandiri via screenshot (badge "DEPOSIT" + 3 aksi). Akun uji Kasir: `kasirtest/Kasir123`.

## Update (2026-06) — Pengaturan printer PER USER
- CHANGED (backend `server.py`): Field printer (`print_mode`, `paper_width`, `printers`, `active_printer`) kini disimpan per pengguna di koleksi `user_settings` (key tenant_id+user_id). `GET /settings` mengembalikan settings toko + overlay printer milik user login (fallback ke settings toko bila user belum punya). `PUT /settings` memisah: field printer → `user_settings` (semua role); field bisnis (business_name/address/phone/currency/tax_rate/receipt_footer/logo) → settings toko (hanya Owner/Manager). Setting terakhir tiap user otomatis dipakai saat login.
- CHANGED (`Settings.jsx`): Tambah catatan "Pengaturan printer bersifat per akun" (`printer-per-user-note`). Logo struk kini hanya bisa diubah Owner/Manager (branding toko), disembunyikan dari Kasir.
- Verified via curl + screenshot: admin (bluetooth/80/ADMIN-PR) vs kasirtest (desktop/58/KASIR-PR) terpisah & persisten; Kasir tidak bisa ubah nama toko (tetap "Daneswara Store"); halaman Kasir hanya menampilkan bagian Printer + printer miliknya. (Entri uji printer admin sudah dihapus agar Owner kembali ke konfigurasi aslinya.)

## Update (2026-06) — Kirim nota sebagai GAMBAR (kartu)
- ADDED (`NotaDialog.jsx` + `html2canvas`): Tombol **"Bagikan Nota sebagai Gambar"** merender nota menjadi kartu PNG bergaya modern (header gradient biru + logo, badge status DEPOSIT/LUNAS VIA, rincian item, total, footer) via elemen offscreen ber-inline-style (aman untuk html2canvas). Aksi: `navigator.share({files})` di HP (langsung terlampir ke WhatsApp/aplikasi lain); fallback **unduh PNG** di desktop. Tombol teks WA lama tetap ada. Berlaku di semua tempat NotaDialog dipakai (POS, Pesanan, Riwayat, Laporan).
- Dependency baru: `html2canvas@1.4.1` (frontend).
- Verified via screenshot + unduhan nyata: `nota-INV-260811-0010.png` terbuat (status LUNAS VIA BRI TOKO).

## Update (2026-06) — Gambar nota di struk POS Kasir + Dashboard disembunyikan utk Kasir
- REFACTOR (`NotaDialog.jsx`): logika kartu PNG + tombol dipisah menjadi komponen ekspor `ShareNotaImageButton({nota, settings})` (reusable), dipakai ulang di dalam NotaDialog.
- ADDED (`POS.jsx`): tombol **"Bagikan Nota sebagai Gambar"** (`data-testid="nota-share-image-button"`) kini muncul langsung di dialog struk POS (receipt-dialog) setelah pembayaran berhasil — HP: Web Share (langsung ke WhatsApp), desktop: unduh PNG.
- CHANGED (`Layout.jsx`): item menu Dashboard tidak lagi menyertakan role "Kasir" → Kasir tidak melihat menu Dashboard di sidebar.
- CHANGED (`App.js` HomeIndex + `Login.jsx`): Kasir yang membuka "/" atau login otomatis diarahkan ke `/pos` (bukan Dashboard).
- Verified oleh testing_agent (iteration_12.json, frontend 100%, 0 error console): Kasir redirect ke /pos; sidebar Kasir tanpa Dashboard (Owner tetap ada); tombol gambar nota muncul & berfungsi di receipt-dialog utk Kasir & Owner.

## Update (2026-06) — Draft Pesanan (Tahan) + Preview Penawaran
- CHANGED (`POS.jsx`): tombol **"Tahan"** kini menyimpan pesanan sebagai **DRAFT (belum bayar)** ke menu **Pesanan** (bukan lagi keranjang POS). Dialog `hold-dialog`: input nama + pilih **jenis pesanan** (Reguler/Express/Custom/Lainnya). Fitur held-orders lama (resume chip di keranjang) dihapus.
- CHANGED (backend `server.py`): `POST /orders` set `status="Draft"` bila `deposit_amount<=0` (else "Proses"), simpan field `order_type`. Endpoint baru **`POST /orders/{oid}/deposit`** (OrderDepositInput) → ubah Draft→Proses dengan DP. `POST /orders/{oid}/complete` juga bekerja utk Draft (langsung lunas).
- CHANGED (`Orders.jsx`): halaman Pesanan dikelompokkan per **status**: Draft/Belum Bayar, DP/Proses, Selesai. Kartu draft: tombol **Preview**, **Salin**, **Jadi DP**, **Lunasi**. Badge jenis pesanan tampil di kartu.
- ADDED (`DraftPreviewDialog.jsx`): dialog **Preview Penawaran** bertema **amber** (beda jelas dari nota lunas biru), badge "DRAFT — BELUM BAYAR", tanpa info pembayaran/kembalian. Tombol: **Bagikan Penawaran sebagai Gambar** (html2canvas, kartu amber), **Kirim Penawaran via WhatsApp**, **Salin Pesanan** (teks penawaran). Export helper `buildDraftText`.
- Verified: curl (Draft→DP→Complete) + testing_agent (iteration_13.json, frontend 100%, 0 error) — draft tersimpan di Pesanan, grouping status benar, preview beda dari nota, copy/share image berfungsi, draft bisa jadi DP / langsung lunas. Data test dibersihkan.

## Update (2026-06) — Edit Draft Pesanan
- ADDED (backend `server.py`): **`PUT /orders/{oid}`** (UpdateOrderInput) — hanya untuk order berstatus **Draft**; memperbarui item/qty/harga/catatan, diskon, jenis pesanan, nama pelanggan, lalu menghitung ulang subtotal/pajak/total/sisa. Menolak order non-draft (400).
- ADDED (`Orders.jsx`): tombol **Edit** di kartu draft membuka dialog `edit-dialog` — ubah nama & jenis pesanan, ubah qty (+/-/ketik), harga, catatan per item, hapus item, ubah diskon; total dihitung live. Simpan → PUT.
- Verified: curl (edit qty/harga/diskon menghitung ulang total; non-draft/404 ditolak) + screenshot UI (qty +1 → total Rp105.000). Data test dibersihkan.

## Update (2026-06) — Format Bagikan Gambar gaya BRImo (terpadu)
- ADDED (`ReceiptShareCard.jsx`): satu kartu gambar bersama bergaya struk transfer **BRImo** — background biru, kartu putih tepi bergerigi (scallop), logo + nama toko, heading/keterangan, baris label:nilai (Tanggal, Nomor Referensi, Nama Pelanggan, Kasir, **Jenis Pembayaran**, Jenis Pesanan, Catatan), Rincian Pesanan, ringkasan nominal, **Total** biru besar, footer.
- CHANGED: `ShareNotaImageButton` (NotaDialog) & `DraftPreviewDialog` kini memakai `ReceiptShareCard` yang sama. Perbedaan HANYA pada **keterangan** (Transaksi Berhasil / Uang Muka (DP) Diterima / Menunggu Pembayaran) dan **jenis pembayaran** (metode bayar / Belum Dibayar). Kartu amber lama & kartu biru lama dihapus.
- Verified via unduhan PNG nyata: draft → "Menunggu Pembayaran" + "Belum Dibayar"; lunas → "Transaksi Berhasil" + "Tunai". Layout identik. Data uji dibersihkan.

## Update (2026-06) — Watermark LUNAS pada gambar nota
- ADDED (`ReceiptShareCard.jsx`): stempel **"LUNAS"** (hijau transparan, miring) muncul otomatis pada gambar struk untuk **semua transaksi yang sudah dibayar/lunas** (semua metode: Tunai, BCA/BRI/BCA ADMIN, QRIS, E-Wallet). Tidak muncul pada draft (belum bayar) maupun order dengan status DP/Proses. Konten tetap terbaca (opasitas rendah).
- Verified via unduhan PNG (BRI TOKO) — watermark tampil & teks tetap jelas. Data uji dibersihkan.

## Update (2026-06) — Tema gambar struk: Charcoal + Gold (brand)
- CHANGED (`ReceiptShareCard.jsx`): tema gambar struk diganti dari biru BRI ke **charcoal (#15171c) + aksen emas (#a9791b)** agar cocok dengan logo emas brand. Tambah garis aksen emas di bawah heading; **Total** kini emas. Latar html2canvas juga charcoal. Stempel LUNAS (hijau) tetap.
- Verified via unduhan PNG (QRIS) — tampilan elegan, teks jelas, watermark terbaca. Data uji dibersihkan.

## Update (2026-06) — Setting printer PER-PERANGKAT + penanganan Bluetooth
- CHANGED (`printer.js`): setup printer (daftar printer, mode cetak, printer aktif, lebar kertas) kini disimpan **per-perangkat di localStorage** (`pos_printer_config_v1`) via `getDevicePrinterConfig`/`setDevicePrinterConfig`. `printReceiptSmart` otomatis meng-*override* setting server dengan config perangkat → dua perangkat tidak saling mengganggu meski akun sama.
- CHANGED (`Settings.jsx`): load printer fields dari localStorage (bukan server); tombol Simpan menulis config ke perangkat ini saja (business fields tetap ke server utk Owner/Manager). Note diperbarui → "per perangkat" + penjelasan batas Bluetooth.
- CHANGED (`printer.js` `connectBluetoothPrinter`): retry 1x + pesan error jelas bahwa printer Bluetooth thermal hanya bisa 1 perangkat dalam satu waktu; sarankan mode USB/Desktop utk banyak perangkat. `printReceiptSmart` bluetooth error juga diperjelas.
- Catatan hardware: BLE thermal = 1 koneksi aktif/waktu (device ke-2 harus tunggu device-1 disconnect). Solusi multi-device simultan = mode USB/Desktop. Install PWA (pintasan Chrome) TIDAK memengaruhi—localStorage tetap per-perangkat & Web Bluetooth tetap jalan.
- Verified via screenshot: tambah printer → Simpan → localStorage terisi → reload tetap ada; note baru tampil.

## Update (2026-06) — Harga per item di nota/print + link detail riwayat pelanggan
- CHANGED: harga satuan per item (`@Rp...`) kini tampil di: nota `NotaDialog` (on-screen), struk POS `POS.jsx` (receipt-dialog), print **thermal ESC/POS** & **desktop** (`printer.js` `buildEscPos`/`printDesktop`). Gambar struk (`ReceiptShareCard`) sudah menampilkannya.
- ADDED (`Customers.jsx`): tiap transaksi di dialog Riwayat pelanggan kini **bisa diklik** (`history-item-<id>`) → membuka `NotaDialog` detail lengkap (item, @harga, subtotal, metode, dll). Ditambah hint "Ketuk transaksi untuk melihat detail nota".
- Verified via screenshot end-to-end: klik transaksi di Riwayat pelanggan → nota tampil dengan `@Rp4.000`. Data uji dibersihkan.

## Update (2026-06) — Fix laba bersih + search produk
- FIX (backend `server.py` `report_profit_loss`): `net_profit` sebelumnya `revenue + oi - expense` (lupa kurangi HPP) → sekarang `(revenue - hpp) + oi - expense`. Ini penyebab laba bersih > laba kotor.
- FIX (backend `monthly_report`): `net` sebelumnya `total + oi - expense` → sekarang `profit + oi - expense` (profit = laba kotor per-sale sudah dikurangi HPP).
- ADDED (`ProductCombobox.jsx`): pemilih produk dengan **pencarian** (ketik nama/SKU). Dipakai di **Purchase Order** (`Purchases.jsx`) & **Sesuaikan Stok** (`Inventory.jsx`) menggantikan dropdown biasa.
- Verified: curl profit-loss (net=692rb = gross, sebelumnya 1.054jt); screenshot PO search "kaos" → 31 hasil terfilter & terpilih.
- Catatan akuntansi (dijelaskan ke user): pembelian/restok (PO) TIDAK langsung mengurangi laba — modal masuk sebagai HPP hanya saat barang terjual (standar akuntansi: pembelian stok = aset, bukan biaya).

## Update (2026-06) — Laporan Arus Kas (Cash Flow)
- ADDED (backend `server.py`): endpoint **`GET /reports/cash-flow`** (start/end) — Kas Masuk (penjualan + pendapatan lain) vs Kas Keluar (**pembelian/restok dari PO status "Diterima"** + pengeluaran), + `net_cash`. Pembelian dihitung dari `received_at`.
- ADDED (`Reports.jsx`): section **"Arus Kas"** (`cash-flow-section`) di bawah Laba Rugi — kartu Kas Masuk & Kas Keluar + Arus Kas Bersih. Menegaskan pembelian/restok = uang keluar (beda dari Laba Rugi yang pakai HPP).
- Juga diperbaiki teks penjelasan Laba Bersih di Reports agar sesuai rumus baru (termasuk HPP).
- Verified: curl (net = masuk − keluar; 2 PO diterima = Rp157.500 sbg kas keluar) + screenshot (Arus Kas Bersih Rp896.500).

## Update (2026-06) — Kategori Keuangan bisa ditambah admin (dinamis)
- CHANGED (backend `server.py`): kategori pengeluaran & pendapatan lain kini **dinamis per-tenant**. Default tetap, ditambah custom dari koleksi `finance_categories`. Endpoint baru: `GET /finance-categories?type=`, `POST /finance-categories` (nama+type, tolak duplikat), `DELETE /finance-categories/{id}` (Owner/Manager). `GET /expense-categories` & `/other-income-categories` mengembalikan gabungan default+custom.
- ADDED (`CategoryManager.jsx`): dialog kelola kategori (tambah/hapus; default berlabel "Bawaan" tidak bisa dihapus). Dipakai di Pengeluaran (`Kelola Jenis`) & Pendapatan Lain-lain (`Kelola Kategori`) + link "+ Tambah" di form entri.
- Field entri diberi penanda wajib (Kategori*, Nominal*, Tanggal*) agar Laba Rugi tetap lancar. Menambah kategori TIDAK mengganggu Laba Rugi (laporan mengelompokkan berdasarkan nama kategori).
- Verified: curl (tambah kategori → muncul di list & masuk P&L; duplikat 400; hapus) + screenshot UI (tambah "Sewa Tempat UI", default terkunci).

## Update (2026-06) — Label keterangan sumber angka Omzet & Laba Kotor
- ADDED (`Reports.jsx`): keterangan kecil di bawah kartu **Total Omzet** (nilai penjualan harga jual × qty, transaksi lunas, sebelum dikurangi modal/biaya) dan **Laba Kotor** (Omzet − HPP; belum termasuk pengeluaran & pendapatan lain). Verified via screenshot.

## Update (2026-06) — Keterangan Produk + Aksi PO (Preview/Edit/Hapus)
- ADDED (`ProductInput` server.py + `Products.jsx`): field **Keterangan** (`description`) di form Tambah/Edit Produk (Textarea, `product-description-input`) untuk mencatat detail produk internal. Disimpan di data produk; TIDAK ditampilkan di struk/nota/POS (sesuai permintaan user).
- ADDED (`Purchases.jsx` + server.py): tombol **Preview / Edit / Hapus** di tiap baris PO.
  - Preview (`preview-po-*`): dialog `po-preview-dialog` menampilkan supplier, status, tanggal dibuat/diterima, tabel item (qty/modal/subtotal), catatan, total. Tersedia untuk SEMUA status.
  - Edit (`edit-po-*`) & Hapus (`delete-po-*`): HANYA untuk PO status "Menunggu". Backend `PUT /purchases/{pid}` & `DELETE /purchases/{pid}` menolak PO "Diterima" (400) agar stok tidak kacau. Edit memakai ulang form Buat PO (prefill supplier/item/catatan).
- Verified: curl (description tersimpan; PUT/DELETE Menunggu OK; PUT/DELETE Diterima → 400) + screenshot (baris Menunggu tampil 4 aksi, Diterima hanya Preview, dialog Preview menampilkan detail). Data uji dibersihkan.

## Update (2026-06) — Fix bagikan gambar nota tidak stabil + Cetak Draft
- FIXED (`lib/captureImage.js` NEW): util `captureToBlob` untuk render gambar stabil — tunggu semua `<img>` termuat (waitForImages), tunggu `document.fonts.ready`, retry hingga 3x, fallback `toBlob`→`dataURL`. `shareOrDownload` share (mobile)/unduh (desktop). Root cause instabilitas: html2canvas mengambil snapshot sebelum logo/font selesai dimuat.
- CHANGED share image ke util baru di: `NotaDialog.jsx` (ShareNotaImageButton), `DraftPreviewDialog.jsx`, dan `VoucherDialog.jsx` (Pengeluaran/Pendapatan) — semua kini pakai captureToBlob yang stabil.
- ADDED cetak untuk pesanan DRAFT: tombol **Cetak** di kartu draft (`print-draft-*`) & di dialog Preview (`draft-print-button`) → `printReceiptSmart({...order,__draft:true})` (thermal/desktop per-device). `printer.js`: `paymentStatus` draft = "BELUM DIBAYAR"; printDesktop & buildEscPos skip baris pembayaran utk draft.
- Teruji oleh testing_agent (iteration_14.json): 5/5 percobaan bagikan gambar nota SUKSES tanpa toast error; tombol Cetak draft (kartu & dialog) & bagikan penawaran bekerja tanpa error. Frontend 100%. Data uji draft dibersihkan.


- CHANGED backend (`server.py`): helper `resolve_supplier` memvalidasi supplier (tidak boleh kosong / tidak ada / nama '-'). Diterapkan di `POST /purchases`, `PUT /purchases/{pid}`, `POST /purchases/from-order/{oid}`, `POST /purchases/from-product/{pid}`. Dua endpoint auto kini menerima body `{supplier_id}` (model `SupplierRef`). Tanpa supplier → 400.
- ADDED (`SupplierPickerDialog.jsx`): dialog pilih supplier (wajib) dipakai di Orders & Products sebelum membuat PO otomatis. Kalau belum ada supplier → arahkan tambah di menu Supplier.
- CHANGED (`Purchases.jsx`): form PO manual — label "Supplier *" + validasi wajib sebelum simpan.
- Teruji: curl (manual/from-order/from-product tanpa supplier → 400; from-product dgn supplier → 200 + supplier_name terisi) + screenshot (picker muncul, tombol Buat PO nonaktif sampai supplier dipilih). Data uji dibersihkan.


- ADDED backend (`list_products`): setiap produk kini punya `open_po` (bool) & `open_po_numbers` — dihitung dinamis dari PO status "Menunggu" yang memuat produk itu (hilang otomatis setelah PO diterima/dihapus).
- ADDED (`Products.jsx`): tombol PO di produk stok minus berubah jadi biru **"Sudah PO"** bila sudah ada PO restok terbuka; klik lagi → konfirmasi peringatan double PO. Reload otomatis setelah buat PO.
- Teruji: curl (open_po False→True dgn nomor PO→False setelah PO dihapus) + screenshot (BANNER "Sudah PO" biru vs GILDAN "PO" oranye). Data uji dibersihkan.


- ADDED backend (`server.py`): PO dari pesanan menyimpan `order_id` & `order_number`. `GET /orders` kini menyertakan `po_created` (bool) & `po_numbers` (list) yang dihitung DINAMIS dari purchases (jadi kalau PO dihapus, tanda otomatis hilang).
- ADDED (`Orders.jsx`): badge biru **"SUDAH PO"** di kartu pesanan + tombol berubah jadi "Sudah PO" (biru). Klik PO saat sudah ada → konfirmasi peringatan double PO. Reload otomatis setelah buat PO.
- Teruji: curl (po_created False→True dgn nomor PO→False setelah PO dihapus) + screenshot (badge & tombol). Data uji dibersihkan.


- CHANGED (`server.py` DELETE `/purchases/{pid}`): PO status "Diterima" kini BISA dihapus **hanya oleh Owner**; saat dihapus, stok tiap item DIKURANGI kembali (movement type "Keluar", note "Pembatalan PO ...") agar data/laporan tetap balance. Non-Owner tetap ditolak (403). PO "Menunggu" tetap seperti semula.
- CHANGED (`Purchases.jsx`): tombol Hapus muncul untuk PO Diterima jika role Owner; konfirmasi khusus memberi tahu stok akan dikoreksi.
- Cleanup Preview: 2 PO percobaan (PO-260802-0002 TEST_SupPO, PO-260802-0001 CV Sumber Rejeki) dihapus dari DB Preview (produk terkait sudah tidak ada → tanpa dampak stok).
- CATATAN PENTING: DB Preview & Produksi TERPISAH. PO yang tampak di screenshot user ada di PRODUKSI. Setelah user redeploy, Owner bisa hapus 2 PO tsb sendiri lewat UI (stok otomatis balance).
- Teruji: curl (stok 10→terima+15=25→hapus=10 balance; reversed:true).


- ADDED backend (`server.py`): `POST /purchases/from-order/{oid}` (salin item pesanan, qty sama, modal dari produk, supplier kosong, status Menunggu, simpan `customer_name` dari pesanan) & `POST /purchases/from-product/{pid}` (1 PO restok, qty = kekurangan stok minus). PO doc kini punya field `customer_name`.
- ADDED (`Orders.jsx`): tombol **PO** (`po-order-*`) di tiap kartu pesanan → buat PO dari pesanan, muncul di menu Pembelian.
- ADDED (`Purchases.jsx`): baris **Pelanggan** di dialog Detail PO (`po-preview-dialog`) bila PO berasal dari pesanan.
- ADDED (`Products.jsx`): dropdown **Urutkan** (Nama A-Z / Harga terendah / Stok terendah) + filter **Kategori**; tombol **PO** (`po-product-*`) oranye di baris/kartu produk berstok MINUS → buat PO restok.
- Teruji: curl (from-order bawa customer_name "GITA" 2 item; from-product BANNER stok -4 → qty 4) + screenshot (filter/sort & tombol PO stok minus di Produk, tombol PO di Pesanan). Data uji dibersihkan.


- ADDED (`POS.jsx`): pemilih **Sumber Penjualan** (Toko, Shopee, Tokopedia, WhatsApp, Lainnya) di dialog Pembayaran, Deposit, & Tahan/Draft. Field `channel` dikirim ke API dan disimpan di dokumen sale/order. Default "Toko".
- Backend (`server.py`): `SaleInput.channel` + `CustomOrderInput.channel`; sale doc & settlement sale menyimpan `channel`; `GET /reports/sales` kini mengembalikan `by_channel` (total, profit, count per channel). Transaksi lama otomatis dianggap "Toko".
- Reports (`Reports.jsx`): section **Ringkasan Per Sumber Penjualan** (Omzet & Laba Kotor per channel), kolom Sumber di detail transaksi, dan kolom/ringkasan channel di ekspor Excel.
- Teruji: curl (channel tersimpan; by_channel Shopee/Tokopedia/Toko benar) + screenshot (picker di dialog pembayaran, section laporan). Data uji dibersihkan (+restore stok).


- ADDED (`VoucherDialog.jsx`, `VoucherShareCard.jsx`, `lib/terbilang.js`): ikon **printer** di tiap baris Pengeluaran (`print-expense-*`) & Pendapatan Lain (`print-other-income-*`) → dialog bukti per transaksi dengan 2 aksi:
  - **Cetak (A4)** (`voucher-print-button`): kop toko (logo + nama + alamat + telp), judul BUKTI KAS KELUAR/MASUK, No. bukti (BKK/BKM-<id8>), tanggal/jenis/keterangan, jumlah (merah keluar / hijau masuk), **terbilang**, kolom tanda tangan (Dibuat oleh / Disetujui|Diterima oleh). Auto window.print().
  - **Buat Gambar** (`voucher-image-button`): share image html2canvas, ukuran kartu sama dgn nota penjualan (460px, charcoal+gold) tapi format bukti kas berbeda.
- `lib/terbilang.js`: angka→kata Bahasa Indonesia (teruji: 150000→"Seratus lima puluh ribu rupiah", dst).
- Teruji via screenshot + popup capture. Data uji dibersihkan.

- ADDED (`Expenses.jsx`): tombol **Cetak** (`print-expenses-button`) di header Pengeluaran → membuka jendela cetak A4 (window.open) berisi header (logo + nama toko), periode (tanggal min–maks), waktu cetak, jumlah catatan, tabel pengeluaran (No/Tanggal/Kategori/Catatan/Nominal), Total, dan Ringkasan per Kategori. Menghormati filter pencarian aktif (mencetak baris `filtered`). Auto `window.print()`. Teruji via popup capture (2 pengeluaran → total Rp195.000 + ringkasan kategori benar). Data uji dibersihkan.
- CHANGED (favicon): ikon tab browser diganti ke logo Daneswara (kepala emas latar hitam) — `public/favicon.png` (256), `favicon.ico` (multi), `apple-touch-icon.png` (180), `logo192/512`. Cache-bust `?v=3` di index.html.

## Backlog (Next)
- P1: Cetak laporan berbasis rentang tanggal (bukan hanya filter teks) untuk Pengeluaran & Pendapatan Lain.
- P1: Split Bill, Hold Order, Barcode scanner hardware, cetak thermal ESC/POS asli.
- P1: Customer/Membership + Poin Loyalitas, Pembelian/Purchase Order + Supplier.
- P2: Keuangan (kas masuk/keluar, rekonsiliasi), Varian & Modifier produk, multi-outlet.
- P2: Customer Display, Mobile app, integrasi gateway pembayaran asli, backup/export.
- P2: Modul akuntansi, CRM, marketplace.
