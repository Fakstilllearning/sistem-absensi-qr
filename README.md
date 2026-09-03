# Website Absensi Kaderisasi PJKR UPI

Sistem absensi berbasis QR Code untuk kegiatan kaderisasi mahasiswa baru Program Studi Pendidikan Jasmani, Kesehatan dan Rekreasi (PJKR), Fakultas Pendidikan Olahraga dan Kesehatan (FPOK), Universitas Pendidikan Indonesia (UPI).

## Tech Stack

- **Frontend:** React + TypeScript + Vite + Tailwind CSS
- **Icons:** lucide-react
- **QR Scanner:** html5-qrcode
- **QR Generator:** qrcode (npm)
- **Backend:** Supabase (PostgreSQL + Auth + Realtime)
- **Hosting:** Vercel

## Akun Testing

Sistem telah dilengkapi tiga akun testing untuk validasi sebelum digunakan secara nyata:

| Role     | Email                       | Password        |
|----------|-----------------------------|-----------------|
| ADMIN    | admin@kaderisasi.upi.edu    | admin12345      |
| SCANNER  | scanner@kaderisasi.upi.edu  | scanner12345    |
| VIEWER   | viewer@kaderisasi.upi.edu   | viewer12345     |

## Cara Menggunakan

### 1. Login

Buka website, masuk menggunakan akun yang diberikan. Setiap role memiliki menu berbeda.

### 2. Import Data Mahasiswa

1. Login sebagai **ADMIN**.
2. Buka menu **Import Data**.
3. Siapkan file CSV dari Excel dengan kolom: `nim`, `name`, `class`, `group`, `gender`, `year`.
4. Upload file CSV.
5. Sistem akan menampilkan preview, validasi, dan jumlah baris bermasalah.
6. Pilih mode import (Update Existing / Insert New / Skip Existing).
7. Klik **Konfirmasi Import**.

### 3. Membuat dan Membuka Sesi

1. Login sebagai **ADMIN**.
2. Buka menu **Sesi**.
3. Klik **Sesi Baru**, isi nama dan tanggal.
4. Klik **Buka Sesi** untuk mengaktifkan scanner.

### 4. Melakukan Scan Absensi

1. Login sebagai **SCANNER** atau **ADMIN**.
2. Buka menu **Scanner**.
3. Pastikan ada sesi yang berstatus **OPEN**.
4. Klik **Buka Kamera**, izinkan akses kamera.
5. Arahkan kamera ke QR Code pada buku kaderisasi.
6. Sistem menampilkan hasil: BERHASIL / SUDAH ABSEN / QR TIDAK VALID.
7. Scanner otomatis siap untuk scan berikutnya.

### 5. Koreksi Manual

1. Login sebagai **ADMIN**.
2. Buka menu **Absensi**.
3. Cari mahasiswa berdasarkan NIM atau nama.
4. Klik **Edit** pada baris mahasiswa.
5. Pilih status baru, isi catatan jika perlu.
6. Klik **Simpan**. Perubahan tercatat di audit log.

Atau gunakan tombol **Absensi Manual** untuk mencatat absensi mahasiswa yang belum memiliki record.

### 6. Menutup Sesi

1. Login sebagai **ADMIN**.
2. Buka menu **Sesi**.
3. Klik **Tutup Sesi** pada sesi yang aktif.
4. Konfirmasi penutupan.
5. Semua mahasiswa tanpa catatan absensi otomatis menjadi **ALPA**.

### 7. Melihat Laporan

1. Login sebagai **ADMIN** atau **VIEWER**.
2. Buka menu **Laporan**.
3. Filter berdasarkan sesi.
4. Klik **Export Weekly CSV** untuk mengunduh rekap mingguan.

### 8. Export Absensi

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

- `profiles` - data pengguna dan role
- `students` - data mahasiswa dan QR token
- `attendance_sessions` - sesi absensi
- `attendance_records` - catatan absensi (unique: student_id + session_id)
- `audit_logs` - riwayat aktivitas

### Fungsi Database

- `record_attendance(p_qr_token, p_session_id)` - mencatat absensi scan dengan validasi penuh
- `close_session(p_session_id)` - menutup sesi dan membuat record ALPA otomatis
- `user_has_role(allowed_roles)` - cek role pengguna untuk RLS

## Troubleshooting

| Masalah | Solusi |
|---------|--------|
| Kamera tidak aktif | Aktifkan izin kamera di pengaturan browser. Gunakan HTTPS. |
| Scanner menampilkan "Belum ada sesi terbuka" | Admin harus membuka sesi di menu Sesi. |
| Import CSV gagal | Pastikan kolom `nim`, `name`, `class` ada dan terisi. |
| Login gagal | Periksa email dan password. Hubungi admin jika akun belum dibuat. |
| Dashboard tidak update | Periksa koneksi internet. Realtime membutuhkan koneksi stabil. |
| "SUDAH ABSEN" muncul | Mahasiswa sudah memiliki catatan absensi untuk sesi tersebut. |
