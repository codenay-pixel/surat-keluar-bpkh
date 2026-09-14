# Panduan Pemasangan — Sistem Manajemen Surat Keluar (versi Netlify + Supabase)

Sistem ini sudah dipindahkan dari Google Apps Script + Google Sheets ke
**Next.js** (kode aplikasi) yang jalan di **Netlify** (hosting) dengan
**Supabase** (database Postgres) sebagai penyimpanan data. Panduan ini
menjelaskan cara memasangnya dari nol, sekaligus cara memindahkan data
lama dari Google Sheets kalau diperlukan.

Alasan pindah ke kombinasi ini ada di riwayat obrolan proyek: Netlify
dipilih (bukan Vercel) karena plan gratisnya tidak membatasi pemakaian
hanya untuk pribadi, cocok untuk sistem instansi seperti BPKH.

---

## 1. Yang dibutuhkan

- Akun **Supabase** (gratis) — [supabase.com](https://supabase.com)
- Akun **Netlify** (gratis) — [netlify.com](https://netlify.com)
- Akun **GitHub** (gratis) — cara termudah menghubungkan kode ke Netlify
- Node.js 20+ di komputer (hanya kalau mau menjalankan skrip migrasi data
  lama secara lokal — lihat bagian 6)

---

## 2. Membuat project Supabase

1. Masuk ke [supabase.com](https://supabase.com) → **New project**.
2. Isi nama project (mis. "surat-keluar-bpkh"), buat password database
   (simpan baik-baik, beda dari password login admin di aplikasi ini),
   pilih region terdekat (Singapore paling dekat ke Indonesia).
3. Tunggu project selesai dibuat (1–2 menit).
4. Buka menu **SQL Editor** di sidebar kiri → **New query**.
5. Buka file `sql/001_schema.sql` di folder proyek ini, salin semua
   isinya, tempel ke SQL Editor, lalu klik **Run**.
   - Ini membuat tabel `surat_keluar` dan `users`, plus satu akun admin
     default: **admin@bpkh.go.id** / **admin123**.
   - **Ganti password ini secepatnya** setelah login pertama kali (lihat
     langkah 5) lewat tombol "Ganti Password" di pojok kanan atas.
6. Buka menu **Project Settings** (ikon gerigi) → **API**. Catat dua
   nilai ini, akan dipakai di langkah 4:
   - **Project URL** → jadi `SUPABASE_URL`
   - **service_role secret** (bagian "Project API keys", BUKAN yang
     "anon public") → jadi `SUPABASE_SERVICE_ROLE_KEY`

   > `service_role` key ini setara kunci induk ke seluruh database.
   > Jangan pernah ditaruh di kode yang di-commit ke GitHub publik atau
   > dikirim ke siapa pun di luar tim IT. Aplikasi ini hanya memakainya
   > di sisi server (Netlify), tidak pernah dikirim ke browser.

---

## 3. Menghubungkan kode ke Netlify

**Opsi A — lewat GitHub (disarankan, supaya update berikutnya tinggal `git push`):**

1. Buat repository baru di GitHub, push folder proyek ini ke sana.
2. Di Netlify: **Add new site → Import an existing project → GitHub**,
   pilih repository tadi.
3. Netlify otomatis mengenali ini proyek Next.js — biarkan build command
   & publish directory bawaan (sudah diatur juga di `netlify.toml`).
4. **Jangan langsung klik Deploy** — isi environment variables dulu di
   langkah 4 di bawah, baru klik **Deploy site**.

**Opsi B — lewat Netlify CLI (tanpa GitHub):**

```bash
npm install -g netlify-cli
cd surat-keluar-web
netlify login
netlify init
netlify deploy --prod
```

---

## 4. Mengisi Environment Variables

Di dashboard Netlify: **Site configuration → Environment variables →
Add a variable**. Tambahkan tiga variabel ini (nilai dari langkah 2, dan
satu string acak baru):

| Key | Value |
|---|---|
| `SUPABASE_URL` | Project URL dari Supabase (langkah 2.6) |
| `SUPABASE_SERVICE_ROLE_KEY` | service_role secret dari Supabase (langkah 2.6) |
| `SESSION_SECRET` | String acak minimal 32 karakter — buat lewat terminal: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` |

Setelah tersimpan, **Deploy** (atau **Trigger deploy** kalau sudah pernah
deploy sekali). Situs akan bisa diakses lewat alamat `https://nama-acak.netlify.app`
(bisa diganti ke domain sendiri lewat **Domain settings**).

Untuk coba-coba di komputer sendiri sebelum deploy, salin `.env.local.example`
jadi `.env.local`, isi nilainya, lalu jalankan:

```bash
npm install
npm run dev
```

---

## 5. Login pertama kali

1. Buka alamat situsnya, login pakai **admin@bpkh.go.id** / **admin123**.
2. **Segera klik "Ganti Password"** di pojok kanan atas, ganti ke
   password baru yang kuat. Password default ini publik (ada di panduan
   ini), jadi wajib diganti sebelum sistem dipakai sungguhan.
3. Kalau butuh akun admin tambahan untuk staf lain, buat lewat SQL
   Editor di Supabase (Table Editor → tabel `users` → Insert row), lalu
   suruh admin itu login dengan password sementara dan langsung ganti —
   atau minta tim IT membuatkan endpoint tambah-user kalau dipakai
   banyak admin (belum ada di versi ini, karena versi lama juga tidak
   punya halaman kelola-user, akun ditambah manual lewat sheet).

---

## 6. Memindahkan data lama dari Google Sheets (opsional, sekali saja)

Kalau ada data surat dari sistem Google Sheets yang lama, pindahkan
dengan skrip `scripts/migrasi-data.mjs`:

1. Buka spreadsheet lama → sheet **LogSuratKeluar** → **File → Download
   → Comma Separated Values (.csv)** → simpan sebagai
   `data/LogSuratKeluar.csv` di folder proyek ini.
2. Sheet **Users** → export CSV yang sama → simpan sebagai
   `data/Users.csv`.
3. Pastikan `.env.local` sudah terisi (lihat langkah 4).
4. Jalankan dulu mode **percobaan** (tidak menulis apa pun ke database):
   ```bash
   node scripts/migrasi-data.mjs
   ```
   Baca ringkasannya: baris mana yang berhasil dibaca, mana yang
   dilewati (dan alasannya — tanggal tidak kebaca, jenis surat tidak
   dikenali, nomor dobel, dll), dan mana yang tanggalnya ambigu (perlu
   dicek manual). Perbaiki data di Google Sheets lalu ulangi export CSV
   kalau perlu.
5. Kalau ringkasannya sudah sesuai, jalankan sungguhan:
   ```bash
   node scripts/migrasi-data.mjs --commit
   ```
6. Untuk akun di `Users.csv`: password lama TIDAK BISA dipindahkan
   (tersimpan sebagai hash satu-arah di sistem lama, tidak bisa dibalik
   jadi teks). Skrip ini membuatkan **password sementara acak** untuk
   tiap akun, disimpan di file
   `data/password-sementara-HAPUS-SETELAH-DIPAKAI.txt`. Bagikan password
   itu ke masing-masing admin lewat jalur yang aman (bukan chat/email
   biasa), minta mereka login lalu **langsung ganti password**, lalu
   **hapus file itu**.
7. Aman dijalankan ulang — surat yang sudah ada (jenis + tahun + nomor
   sama) otomatis dilewati, tidak akan dobel.

---

## 7. Keamanan & backup data — baca ini sebelum dipakai sungguhan

Ini poin yang paling relevan dengan permintaan "keamanan data terjamin"
dari atasan:

- **Password admin**: disimpan sebagai hash bcrypt (bukan teks polos),
  jauh lebih kuat dari metode SHA-256 di versi Apps Script sebelumnya.
- **Akses database**: ditutup total dari luar (Row Level Security aktif
  tanpa policy apa pun) — satu-satunya jalan masuk adalah lewat kode
  server aplikasi ini, yang selalu mengecek sesi login admin dulu.
- **Backup otomatis — PENTING**: plan gratis Supabase **tidak** punya
  backup otomatis sama sekali. Kalau data terhapus atau rusak (baik
  karena bug, kesalahan pemakaian, atau hal lain), **tidak ada cara
  mengembalikannya** kecuali ada cadangan manual. Opsinya:
  - **Manual, gratis**: jadwalkan ekspor rutin (mingguan/bulanan) lewat
    `supabase db dump` atau Table Editor → Export, simpan di tempat
    aman (Google Drive kantor, dsb).
  - **Otomatis, berbayar**: upgrade project Supabase ke **Pro (~US$25/bulan)**
    → dapat backup harian otomatis (retensi 7 hari). Ini investasi yang
    sepadan kalau data surat ini dianggap penting oleh atasan — sampaikan
    opsi ini sebagai bahan pertimbangan anggaran.
- **HTTPS**: otomatis aktif di Netlify, semua lalu lintas terenkripsi.

---

## 8. Update aplikasi di kemudian hari

- Kalau terhubung lewat GitHub (Opsi A di langkah 3): edit kode, `git
  push`, Netlify otomatis build & deploy ulang.
- Kalau lewat CLI (Opsi B): edit kode, jalankan `netlify deploy --prod`
  lagi.
- Perubahan skema database (menambah kolom, dsb) dilakukan lewat SQL
  Editor di Supabase — buat file SQL baru di folder `sql/` untuk jejak
  riwayat perubahan, jangan langsung ubah `001_schema.sql` yang lama.

---

## 9. Ringkasan fitur (sama seperti versi lama, plus tambahan)

- Buku agenda per jenis surat, bernomor otomatis, 1–2000 atau 1–1000
  tergantung jenis, reset tiap 1 Januari.
- **Nomor sisipan** (mis. "801 A", "801 B") untuk surat susulan yang
  numpang di nomor yang sudah terpakai.
- Statistik harian/mingguan/bulanan/tahunan + rincian per jenis surat.
- Pencarian, filter per buku/tahun, halaman bisa dilompat manual.
- **Baru**: tombol "Ganti Password" mandiri (di versi Apps Script,
  password hanya bisa diganti manual lewat sheet oleh yang paham teknis).

---

## 10. Kalau ada masalah

- **"SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY belum diatur"** — environment
  variable belum terisi di Netlify (langkah 4), atau belum di-deploy
  ulang setelah diisi.
- **Login gagal terus padahal password benar** — cek SQL langkah 2.5
  sudah dijalankan (tabel `users` harus ada isinya), dan `SESSION_SECRET`
  sudah diisi.
- **Migrasi data: "tanggal tidak bisa dibaca"** — format tanggal di
  Google Sheets kadang tidak konsisten; buka baris itu di spreadsheet,
  perbaiki formatnya jadi `dd/mm/yyyy` atau `yyyy-mm-dd`, export ulang.
