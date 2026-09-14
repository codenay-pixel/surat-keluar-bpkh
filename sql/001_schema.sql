-- =====================================================================
-- SISTEM MANAJEMEN SURAT KELUAR - BPKH Wilayah I
-- Skema database Supabase (Postgres)
--
-- Cara pakai: buka Supabase Dashboard > SQL Editor > tempel seluruh isi
-- file ini > Run. Aman dijalankan sekali di awal (proyek baru/kosong).
-- =====================================================================

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------
-- Tabel utama: satu baris = satu surat (atau satu surat sisipan, mis.
-- nomor "801A" untuk sisipan huruf A dari nomor dasar 801).
-- ---------------------------------------------------------------------
create table if not exists surat_keluar (
  id             uuid primary key default gen_random_uuid(),
  nomor_surat    text not null,              -- gabungan tanpa spasi: "801" atau "801A"
  nomor_angka    integer not null,           -- bagian angka, buat sortir/filter cepat
  huruf_sisipan  text not null default '',   -- '' kalau bukan sisipan, "A"/"B"/... kalau sisipan
  tanggal_surat  date not null,
  nama           text not null,
  alamat         text not null,
  perihal        text not null,
  tanggal_simpan timestamptz not null default now(),
  jenis_surat    text not null,
  tahun          integer not null,
  dibuat_oleh    text,                       -- email admin yang menyimpan (jejak audit)

  constraint surat_keluar_nomor_unik
    unique (jenis_surat, tahun, nomor_surat)
);

create index if not exists idx_surat_jenis_tahun on surat_keluar (jenis_surat, tahun);
create index if not exists idx_surat_tahun on surat_keluar (tahun);
create index if not exists idx_surat_tanggal on surat_keluar (tanggal_surat);
create index if not exists idx_surat_nomor_angka on surat_keluar (nomor_angka);

-- ---------------------------------------------------------------------
-- Tabel akun admin. Password TIDAK PERNAH disimpan sebagai teks polos -
-- selalu hash bcrypt (dibuat lewat lib/auth.js -> buatHashPassword()).
-- ---------------------------------------------------------------------
create table if not exists users (
  id            uuid primary key default gen_random_uuid(),
  email         text not null unique,
  nama          text not null,
  role          text not null default 'admin',
  password_hash text not null,
  wajib_ganti_password boolean not null default false,
  created_at    timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- Row Level Security: DITUTUP TOTAL untuk akses langsung dari browser.
-- Aplikasi web mengakses tabel ini HANYA lewat server (Next.js API
-- routes) memakai SERVICE ROLE KEY, yang secara otomatis melewati RLS.
-- Tidak ada policy yang dibuat di sini secara sengaja, supaya kalau
-- suatu saat ada kunci "anon" yang bocor ke browser, tetap tidak ada
-- satu baris pun yang bisa dibaca/ditulis langsung dari luar.
-- ---------------------------------------------------------------------
alter table surat_keluar enable row level security;
alter table users enable row level security;

-- =====================================================================
-- Akun admin default pertama kali. GANTI PASSWORD INI SECEPATNYA
-- setelah login pertama - lihat langkah di PANDUAN-PEMASANGAN.md.
-- Hash di bawah ini adalah bcrypt untuk password "admin123".
-- =====================================================================
insert into users (email, nama, role, password_hash, wajib_ganti_password)
values (
  'admin@bpkh.go.id',
  'Administrator',
  'admin',
  '$2b$10$9nd9lU1vuZLsZ/4tMIPXc.YWrMk/oRzR7WQP4NTRb/IlNVYEzJ9fi',
  true
)
on conflict (email) do nothing;
