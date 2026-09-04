# Website Absensi Kaderisasi PJKR UPI

Sistem absensi berbasis QR Code untuk kegiatan kaderisasi mahasiswa baru Program Studi Pendidikan Jasmani, Kesehatan dan Rekreasi (PJKR), Fakultas Pendidikan Olahraga dan Kesehatan (FPOK), Universitas Pendidikan Indonesia (UPI).

## Tech Stack

- **Frontend:** React + TypeScript + Vite + Tailwind CSS
- **Icons:** lucide-react
- **QR Scanner:** html5-qrcode
- **QR Generator:** qrcode (npm)
- **Backend:** Supabase (PostgreSQL + Auth + Realtime)
- **Autentikasi:** Google OAuth via Supabase Auth
- **Hosting:** Vercel

## Cara Login

Sistem menggunakan **Google OAuth** — tidak ada login dengan email/password manual.

1. Buka website, klik **Masuk dengan Google**.
2. Login dengan akun Google Anda.
3. Saat pertama kali masuk, Anda akan diminta memilih peran:
   - **Admin** — kelola sesi, import data, koreksi absensi, lihat audit log
   - **Scanner** — pindai QR Code mahasiswa untuk mencatat kehadiran
   - **Viewer** — lihat dashboard, data mahasiswa, absensi, dan laporan
4. Pilihan peran hanya bisa dilakukan sekali. Hubungi admin jika perlu diubah.
5. Login berikutnya langsung masuk ke dashboard sesuai peran yang dipilih.

> Hanya panitia yang memerlukan akun. Mahasiswa cukup menampilkan QR Code untuk discan.

## Setup Google OAuth

### 1. Google Cloud Console

1. Buka [Google Cloud Console](https://console.cloud.google.com/) dan buat project baru.
2. Buka **APIs & Services > OAuth consent screen**.
3. Pilih **User Type: External**, lalu isi:
   - **App name:** `Absensi HMP PJKR`
   - **User support email:** email Anda
   - **Developer contact information:** email Anda
4. Pada tab **Scopes**, tambahkan `userinfo.email`, `userinfo.profile`, dan `openid`.
5. Pada tab **Test users**, tambahkan email panitia yang akan login.
6. Buka **APIs & Services > Credentials > Create Credentials > OAuth client ID**.
7. Pilih **Web application**, lalu tambahkan **Authorized redirect URI**:
   ```
   https://<project-ref>.supabase.co/auth/v1/callback
   ```
   (`<project-ref>` ada di dashboard Supabase > Settings > General > Reference ID, atau di Authentication > Providers > Google)
8. Catat **Client ID** dan **Client Secret**.

### 2. Dashboard Supabase

1. Buka [dashboard Supabase](https://supabase.com/dashboard) > **Authentication > Providers**.
2. Klik **Google**, aktifkan, lalu tempelkan **Client ID** dan **Client Secret**.
3. Buka **Authentication > URL Configuration**.
4. Isi **Site URL** dengan URL aplikasi (misalnya `http://localhost:5173` untuk development).
5. Tambahkan URL yang sama di **Redirect URLs**.
6. Klik **Save**.

> Selama aplikasi masih dalam status **Testing** di Google Cloud, hanya email yang terdaftar di "Test users" yang bisa login. Klik **Publish App** di OAuth consent screen jika sudah siap untuk semua panitia.

## Menu & Hak Akses

| Menu | Admin | Scanner | Viewer |
|------|:-----:|:-------:|:------:|
| Dashboard | ✓ | ✓ | ✓ |
| Scanner | ✓ | ✓ | — |
| Mahasiswa | ✓ | — | ✓ |
| Absensi | ✓ | — | ✓ |
| Sesi | ✓ | — | — |
| Import Data | ✓ | — | — |
| Laporan | ✓ | — | ✓ |
| Audit Log | ✓ | — | — |

## Cara Menggunakan

### 1. Import Data Mahasiswa

1. Login sebagai **Admin**.
2. Buka menu **Import Data**.
3. Siapkan file CSV dari Excel dengan kolom: `no_urut`, `nim`, `nama`, `jenis_kelamin`, `kelas`. Kolom opsional: `group`, `year`.
4. Upload file CSV.
5. Sistem akan menampilkan preview, validasi, dan jumlah baris bermasalah.
6. Pilih mode import (Update Existing / Insert New / Skip Existing).
   * Update Existing — Jika NIM sudah ada di database, data mahasiswa tersebut diperbarui dengan data baru dari CSV. Jika NIM belum        ada, mahasiswa baru ditambahkan.
   * Insert New — Hanya menambah mahasiswa baru. Jika NIM sudah ada, baris tersebut dilewati (tidak diperbarui).
   * Skip Existing — Cek dulu apakah NIM sudah ada. Jika sudah ada, lewati. Jika belum, tambahkan sebagai mahasiswa baru.                  Perbedaannya dengan Insert New: Skip Existing mengecek eksistensi terlebih dahulu secara eksplisit sebelum insert.
7. Klik **Konfirmasi Import**.

### 2. Membuat dan Membuka Sesi

1. Login sebagai **Admin**.
2. Buka menu **Sesi**.
3. Klik **Sesi Baru**, isi nama dan tanggal.
4. Klik **Buka Sesi** untuk mengaktifkan scanner.

### 3. Melakukan Scan Absensi

1. Login sebagai **Scanner** atau **Admin**.
2. Buka menu **Scanner**.
3. Pastikan ada sesi yang berstatus **OPEN**.
4. Klik **Buka Kamera**, izinkan akses kamera.
5. Arahkan kamera ke QR Code pada buku kaderisasi.
6. Sistem menampilkan hasil: BERHASIL / SUDAH ABSEN / QR TIDAK VALID.
7. Scanner otomatis siap untuk scan berikutnya.

### 4. Koreksi Manual

1. Login sebagai **Admin**.
2. Buka menu **Absensi**.
3. Cari mahasiswa berdasarkan NIM atau nama.
4. Klik **Edit** pada baris mahasiswa.
5. Pilih status baru, isi catatan jika perlu.
6. Klik **Simpan**. Perubahan tercatat di audit log.

Atau gunakan tombol **Absensi Manual** untuk mencatat absensi mahasiswa yang belum memiliki record.

### 5. Menutup Sesi

1. Login sebagai **Admin**.
2. Buka menu **Sesi**.
3. Klik **Tutup Sesi** pada sesi yang aktif.
4. Konfirmasi penutupan.
5. Semua mahasiswa tanpa catatan absensi otomatis menjadi **ALPA**.

### 6. Melihat Laporan

1. Login sebagai **Admin** atau **Viewer**.
2. Buka menu **Laporan**.
3. Filter berdasarkan sesi.
4. Klik **Export Weekly CSV** untuk mengunduh rekap mingguan.

### 7. Export Absensi

1. Buka menu **Absensi**.
2. Atur filter sesuai kebutuhan.
3. Klik **Export CSV**.
4. File CSV akan terunduh sesuai filter aktif.

## Keamanan

### QR Code

- Setiap mahasiswa memiliki **token QR unik** yang dibuat secara acak.
- QR tidak berisi nama, NIM, atau kelas dalam bentuk plain text.
- Nama, NIM, dan kelas hanya ditampilkan secara visual pada kartu QR cetak.
- Token QR dapat dinonaktifkan atau dibuat ulang oleh admin.

### Pencegahan Duplikat

- Database memiliki constraint `UNIQUE(student_id, session_id)`.
- Fungsi `record_attendance` di database memvalidasi token, sesi, dan role scanner.
- Dua scanner yang memindai mahasiswa yang sama secara bersamaan hanya akan menghasilkan satu record.
- Scan kedua menampilkan pesan **SUDAH ABSEN** dengan waktu scan sebelumnya.

### Row Level Security

- Semua tabel mengaktifkan RLS.
- Akses dibatasi berdasarkan role: ADMIN, SCANNER, VIEWER.
- Scanner hanya dapat membuat record HADIR pada sesi yang terbuka.
- Hanya ADMIN yang dapat mengubah, menghapus, atau mengelola data.

### Batasan

Sistem mencegah penyalahgunaan QR secara teknis, tetapi **tidak dapat menjamin 100% identitas fisik** orang yang membawa kartu. Panitia tetap perlu melakukan verifikasi visual saat scan.

## Environment Variables

Supabase credentials sudah dikonfigurasi otomatis:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

Service role key tidak pernah digunakan di frontend.

## Local Development

```bash
npm install
npm run dev
```

## Deployment ke Vercel

1. Push repository ke GitHub.
2. Import project di Vercel.
3. Vercel akan mendeteksi Vite secara otomatis.
4. Pastikan environment variables `VITE_SUPABASE_URL` dan `VITE_SUPABASE_ANON_KEY` diatur di Vercel.
5. Deploy.

## Database Schema

### Tabel

- `profiles` — data pengguna dan role (ADMIN / SCANNER / VIEWER / PENDING)
- `students` — data mahasiswa dan QR token
- `attendance_sessions` — sesi absensi (DRAFT / OPEN / CLOSED)
- `attendance_records` — catatan absensi (unique: student_id + session_id)
- `audit_logs` — riwayat aktivitas

### Fungsi Database

- `record_attendance(p_qr_token, p_session_id)` — mencatat absensi scan dengan validasi penuh
- `close_session(p_session_id)` — menutup sesi dan membuat record ALPA otomatis
- `set_own_role(p_role)` — set peran pengguna baru (dipanggil satu kali saat pertama login)
- `user_has_role(allowed_roles)` — cek role pengguna untuk RLS

## File Penting

| File | Fungsi |
|------|--------|
| `src/pages/login.tsx` | Tampilan halaman login (tombol Google OAuth) |
| `src/pages/role-select.tsx` | Tampilan pemilihan peran untuk pengguna baru |
| `src/lib/auth.ts` | Logika autentikasi (Google OAuth, set role, logout) |
| `src/lib/auth-context.tsx` | State autentikasi global (provider) |
| `src/lib/supabase.ts` | Konfigurasi Supabase client dan tipe data |
| `src/components/shell.tsx` | Layout utama (sidebar, header, navigasi) |
| `src/components/ui.tsx` | Komponen UI reusable (tombol, input, kartu, dll) |
| `src/components/brand.tsx` | Logo dan branding HMP PJKR |
| `src/index.css` | Tema warna dan gaya keseluruhan aplikasi |

## Troubleshooting

| Masalah | Solusi |
|---------|--------|
| Kamera tidak aktif | Aktifkan izin kamera di pengaturan browser. Gunakan HTTPS. |
| Scanner menampilkan "Belum ada sesi terbuka" | Admin harus membuka sesi di menu Sesi. |
| Import CSV gagal | Pastikan kolom `no_urut`, `nim`, `nama`, `jenis_kelamin`, `kelas` ada dan terisi. |
| Login Google gagal | Periksa konfigurasi OAuth di Google Cloud Console dan Supabase. Pastikan redirect URI benar. |
| Email tidak bisa login | Jika aplikasi masih dalam status Testing di Google Cloud, daftarkan email di OAuth consent screen > Test users. |
| Dashboard tidak update | Periksa koneksi internet. Realtime membutuhkan koneksi stabil. |
| "SUDAH ABSEN" muncul | Mahasiswa sudah memiliki catatan absensi untuk sesi tersebut. |
| Peran salah dipilih | Hubungi admin untuk mengubah peran melalui database. |
