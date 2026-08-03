========================================================
  PANDUAN PEMASANGAN HALAMAN LOGIN "posdns.html"
  KasirCloud POS
========================================================

File "posdns.html" adalah halaman login mandiri yang bisa Anda simpan
di domain/website pribadi Anda. Ketika kasir memasukkan username &
password lalu klik "Masuk", halaman ini akan login ke sistem KasirCloud
dan otomatis membuka aplikasi dalam keadaan sudah masuk.

URL sistem POS Anda (produksi): https://pos-retail-platform.emergent.host


--------------------------------------------------------
LANGKAH 1 — Unduh file posdns.html
--------------------------------------------------------
Buka link berikut di browser, lalu simpan halamannya
(klik kanan > "Simpan sebagai..." / Save As, atau Ctrl+S):

    https://pos-retail-platform.emergent.host/posdns.html

Pastikan file tersimpan dengan nama persis: posdns.html


--------------------------------------------------------
LANGKAH 2 — (PENTING) Pastikan alamat sistem sudah benar
--------------------------------------------------------
File ini sudah diset otomatis mengarah ke sistem Anda:

    var SYSTEM_URL = "https://pos-retail-platform.emergent.host";

Jika suatu saat domain sistem Anda berubah, buka posdns.html dengan
Notepad / editor teks, cari baris "var SYSTEM_URL = ..." (di bagian
<script> paling bawah), dan ganti dengan URL sistem yang baru.
Catatan: JANGAN memakai garis miring "/" di akhir URL.


--------------------------------------------------------
LANGKAH 3 — Unggah ke domain pribadi Anda
--------------------------------------------------------
Unggah file posdns.html ke hosting/domain Anda. Contoh:

  A. cPanel / File Manager:
     - Login ke cPanel hosting Anda
     - Buka "File Manager" > folder "public_html"
     - Klik "Upload", pilih file posdns.html
     - Selesai. Halaman bisa diakses di:
         https://domainanda.com/posdns.html

  B. FTP (FileZilla / WinSCP):
     - Sambungkan ke server pakai akun FTP hosting Anda
     - Masuk ke folder "public_html" (atau "www")
     - Seret & letakkan file posdns.html ke folder tersebut

  C. Ingin jadi halaman utama?
     - Ganti nama file menjadi "index.html", lalu unggah.
       Halaman login akan tampil saat orang membuka
       https://domainanda.com


--------------------------------------------------------
LANGKAH 4 — Uji coba
--------------------------------------------------------
1. Buka https://domainanda.com/posdns.html
2. Masukkan username & password akun POS Anda
3. Klik "Masuk"
4. Anda akan otomatis diarahkan ke aplikasi dan langsung masuk
   ke Dashboard.


--------------------------------------------------------
PERTANYAAN UMUM
--------------------------------------------------------
- "Username atau password salah"
  => Kredensial belum benar, atau akun belum dibuat oleh Owner/Manager
     di menu Pengguna.

- Halaman tidak mengarahkan / error koneksi
  => Periksa kembali nilai SYSTEM_URL di posdns.html sudah benar
     dan tanpa "/" di akhir.

- Apakah aman?
  => Ya. posdns.html hanya mengirim username/password langsung ke
     sistem POS Anda melalui koneksi aman (HTTPS). Tidak ada data
     yang disimpan di halaman ini.

========================================================
