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
