# YT Manager

Aplikasi desktop Electron + React untuk mengelola daftar akun YouTube dengan browser terintegrasi dan profil sesi Chromium terpisah.

## Fitur tahap awal
- Login aplikasi melalui Supabase Auth.
- Data label akun tersimpan di Supabase.
- Setiap akun mendapat persistent browser partition terpisah.
- Login Google/YouTube dilakukan langsung di panel browser.
- Riwayat pembuatan akun dan pembukaan browser.
- Browser profile disimpan lokal oleh Electron; password dan cookie tidak dikirim ke Supabase.

## Menjalankan di Windows
1. Install Node.js LTS.
2. Salin `.env.example` menjadi `.env`.
3. Isi URL Supabase dan publishable key project YTM.
4. Jalankan `npm install`.
5. Jalankan `npm run dev`.

## Build installer
`npm run dist`

Installer Windows akan dibuat di folder `release`.

## Keamanan
- Electron renderer memakai context isolation, sandbox, dan Node integration nonaktif.
- Publishable key boleh ada di aplikasi desktop; jangan pernah memasukkan Supabase secret/service_role key.
- RLS membatasi setiap baris data ke user aplikasi yang sedang login.
- Browser profile menggunakan partition `persist:ytm-<profile-id>`, sehingga sesi akun tidak bercampur.
- Menghapus data akun dari dashboard tidak menghapus profil lokal Chromium secara otomatis.


## Windows installer via GitHub Actions

Setiap push ke branch `main` menjalankan build Windows otomatis. Build juga dapat dijalankan manual dari tab **Actions** → **Build Windows Installer** → **Run workflow**.

Jika job sukses:
1. Buka run terbaru pada tab **Actions**.
2. Pastikan job **windows-installer** berstatus hijau.
3. Unduh artifact **YT-Manager-Windows-Installer** di bagian Artifacts.
4. Ekstrak ZIP, lalu jalankan file `YT Manager Setup 0.1.0.exe`.

Artifact disimpan selama 14 hari. Installer belum ditandatangani sertifikat code-signing, sehingga Windows SmartScreen dapat menampilkan peringatan publisher tidak dikenal. Unduh hanya dari repository resmi ini.

## Konfigurasi dan penggunaan pertama

1. Jalankan installer pada komputer Windows.
2. Buka YT Manager.
3. Daftar akun aplikasi dengan email dan password, lalu verifikasi email jika Supabase Auth meminta.
4. Login ke YT Manager.
5. Pilih **Tambah Akun**, isi nama label dan email opsional.
6. Klik profil akun di daftar kiri; browser YouTube akan dibuka.
7. Login ke Google/YouTube langsung di browser terintegrasi.
8. Tambahkan akun lain untuk membuat profil browser lokal baru. Gunakan menu akun untuk berpindah profil.

Data profil browser disimpan lokal di komputer Windows. Backup folder data aplikasi sebelum memindahkan instalasi atau mengganti komputer. Jangan bagikan folder profil karena dapat berisi sesi login.
