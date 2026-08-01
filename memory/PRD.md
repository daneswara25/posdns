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

## Backlog (Next)
- P1: Split Bill, Hold Order, Barcode scanner hardware, cetak thermal ESC/POS asli.
- P1: Customer/Membership + Poin Loyalitas, Pembelian/Purchase Order + Supplier.
- P2: Keuangan (kas masuk/keluar, rekonsiliasi), Varian & Modifier produk, multi-outlet.
- P2: Customer Display, Mobile app, integrasi gateway pembayaran asli, backup/export.
- P2: Modul akuntansi, CRM, marketplace.
