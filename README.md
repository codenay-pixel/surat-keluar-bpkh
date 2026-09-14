# Sistem Manajemen Surat Keluar — BPKH Wilayah I

Versi Next.js + Supabase (sebelumnya Google Apps Script + Google Sheets).

**Mulai dari sini:** [PANDUAN-PEMASANGAN.md](./PANDUAN-PEMASANGAN.md)

## Struktur singkat

- `app/` — halaman & API routes (Next.js App Router)
- `lib/` — logika bisnis, akses data Supabase, autentikasi
- `sql/001_schema.sql` — skema database, jalankan sekali di Supabase SQL Editor
- `scripts/migrasi-data.mjs` — pemindah data lama dari Google Sheets (CSV) ke Supabase
- `netlify.toml` — konfigurasi deploy Netlify
