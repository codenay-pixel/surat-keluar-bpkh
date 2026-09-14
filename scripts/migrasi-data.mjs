#!/usr/bin/env node
/*****************************************************************
 * MIGRASI DATA - Google Sheets (LogSuratKeluar & Users) -> Supabase
 *
 * CARA PAKAI
 * 1. Buka spreadsheet lama di Google Sheets.
 * 2. Sheet "LogSuratKeluar": File > Download > Comma Separated
 *    Values (.csv) -> simpan sebagai data/LogSuratKeluar.csv
 * 3. Sheet "Users": File > Download > Comma Separated Values (.csv)
 *    -> simpan sebagai data/Users.csv
 * 4. Isi .env.local (SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY) - script
 *    ini memakainya juga.
 * 5. Jalankan dulu MODE DRY-RUN (default, tidak menulis apa-apa):
 *      node scripts/migrasi-data.mjs
 *    Baca ringkasannya, perbaiki data sumber kalau ada yang aneh
 *    (nomor bentrok, tanggal tidak kebaca, jenis surat tak dikenal).
 * 6. Kalau ringkasannya sudah sesuai, jalankan sungguhan:
 *      node scripts/migrasi-data.mjs --commit
 *
 * Aman dijalankan berulang - baris yang sudah ada (jenis+tahun+nomor
 * sama) DILEWATI, bukan ditimpa, jadi tidak akan dobel kalau dijalankan
 * dua kali.
 *****************************************************************/

import { readFileSync, existsSync, writeFileSync } from 'fs';
import { parse } from 'csv-parse/sync';
import { createClient } from '@supabase/supabase-js';
import bcrypt from 'bcryptjs';
import { fileURLToPath } from 'url';
import path from 'path';
import crypto from 'crypto';
import { config as muatDotenv } from 'dotenv';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
muatDotenv({ path: path.join(__dirname, '..', '.env.local') });

const KOMIT = process.argv.includes('--commit');
const PATH_LOG = argVal('--log') || path.join(__dirname, '..', 'data', 'LogSuratKeluar.csv');
const PATH_USERS = argVal('--users') || path.join(__dirname, '..', 'data', 'Users.csv');

function argVal(nama) {
  const i = process.argv.indexOf(nama);
  return i >= 0 ? process.argv[i + 1] : null;
}

const DAFTAR_JENIS_SURAT = [
  { kode: 'S', nama: 'Surat Keluar', batas: 2000 },
  { kode: 'SPT', nama: 'Surat Perintah Tugas', batas: 2000 },
  { kode: 'UN', nama: 'Surat Undangan', batas: 1000 },
  { kode: 'KT', nama: 'Surat Keterangan', batas: 1000 },
  { kode: 'SK', nama: 'Surat Keputusan', batas: 1000 },
  { kode: 'SP', nama: 'Surat Pengantar', batas: 1000 },
  { kode: 'LP', nama: 'Surat Laporan', batas: 1000 },
  { kode: 'SPK', nama: 'Surat Perintah Kerja', batas: 1000 },
  { kode: 'BA', nama: 'Surat Berita Acara', batas: 1000 }
];

function namaJenis(kodeAtauNama) {
  const nilai = String(kodeAtauNama || '').trim();
  for (const j of DAFTAR_JENIS_SURAT) {
    if (j.nama.toLowerCase() === nilai.toLowerCase() || j.kode.toLowerCase() === nilai.toLowerCase()) {
      return j.nama;
    }
  }
  return null;
}

function pisahkanNomor(nilai) {
  const teks = String(nilai ?? '').trim().toUpperCase().replace(/\s+/g, '');
  const cocok = /^([0-9]+)([A-Z]?)$/.exec(teks);
  if (!cocok) return { angka: 0, huruf: '' };
  return { angka: Number(cocok[1]), huruf: cocok[2] || '' };
}

/**
 * Google Sheets biasanya mengekspor tanggal sebagai teks sesuai format
 * tampilan kolomnya. Dicoba beberapa pola umum secara berurutan:
 * ISO (yyyy-MM-dd), lalu dd/MM/yyyy (format Indonesia), lalu
 * MM/dd/yyyy (format Amerika/default Google Sheets baru).
 */
function parseTanggalFleksibel(teks) {
  const t = String(teks || '').trim();
  if (!t) return null;

  let m = /^(\d{4})-(\d{1,2})-(\d{1,2})/.exec(t);
  if (m) return isoAman(Number(m[1]), Number(m[2]), Number(m[3]));

  m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})/.exec(t);
  if (m) {
    const a = Number(m[1]), b = Number(m[2]), tahun = Number(m[3]);
    // Kalau bagian pertama > 12, pasti itu tanggal (format dd/MM/yyyy)
    if (a > 12) return isoAman(tahun, b, a);
    // Kalau bagian kedua > 12, pasti itu bulan-di-depan (format MM/dd/yyyy)
    if (b > 12) return isoAman(tahun, a, b);
    // Ambigu (keduanya <= 12) - diasumsikan dd/MM/yyyy (format Indonesia),
    // TAPI ditandai supaya bisa dicek manual di laporan.
    return { iso: isoAman(tahun, b, a)?.iso, ambigu: true };
  }

  return null;
}

function isoAman(tahun, bulan, tanggal) {
  if (!tahun || !bulan || !tanggal || bulan < 1 || bulan > 12 || tanggal < 1 || tanggal > 31) return null;
  const iso = tahun + '-' + String(bulan).padStart(2, '0') + '-' + String(tanggal).padStart(2, '0');
  const cek = new Date(iso + 'T00:00:00Z');
  if (isNaN(cek.getTime())) return null;
  return { iso, ambigu: false };
}

function bacaCsv(pathFile) {
  if (!existsSync(pathFile)) return null;
  const isi = readFileSync(pathFile, 'utf8');
  return parse(isi, { columns: true, skip_empty_lines: true, trim: true, bom: true });
}

function cariKolom(row, kandidat) {
  const kunciRow = Object.keys(row);
  for (const k of kandidat) {
    const ketemu = kunciRow.find((x) => x.trim().toLowerCase() === k.toLowerCase());
    if (ketemu !== undefined) return row[ketemu];
  }
  return '';
}

async function main() {
  console.log('=== Migrasi data Google Sheets -> Supabase ===');
  console.log('Mode:', KOMIT ? 'COMMIT (menulis ke database)' : 'DRY-RUN (hanya simulasi, tidak menulis apa pun)');
  console.log('');

  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error('SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY belum diisi di .env.local. Berhenti.');
    process.exit(1);
  }
  const sb = createClient(url, key, { auth: { persistSession: false } });

  /* ---------------- LogSuratKeluar ---------------- */
  const dataLog = bacaCsv(PATH_LOG);
  if (!dataLog) {
    console.error('File tidak ditemukan: ' + PATH_LOG);
    console.error('Export dulu sheet "LogSuratKeluar" sebagai CSV, simpan di path itu (atau pakai --log <path>).');
    process.exit(1);
  }
  console.log('Baris di LogSuratKeluar.csv:', dataLog.length);

  const siapDitulis = [];
  const dilewati = [];
  const tandaiAmbigu = [];
  const sudahDilihat = new Set(); // jenis|tahun|nomor -> deteksi dobel DI DALAM file csv itu sendiri

  for (let i = 0; i < dataLog.length; i++) {
    const baris = dataLog[i];
    const nomorTeks = cariKolom(baris, ['Nomor Surat', 'Nomor']);
    const tglTeks = cariKolom(baris, ['Tanggal Surat']);
    const nama = String(cariKolom(baris, ['Nama Pengaju', 'Nama']) || '').trim();
    const alamat = String(cariKolom(baris, ['Alamat']) || '').trim();
    const perihal = String(cariKolom(baris, ['Perihal']) || '').trim();
    const tglSimpanTeks = cariKolom(baris, ['Tanggal Simpan']);
    const jenisTeks = cariKolom(baris, ['Jenis Surat']);
    const tahunTeks = cariKolom(baris, ['Tahun']);

    const nomorLabel = 'baris CSV #' + (i + 2) + ' (nomor="' + nomorTeks + '")';

    if (!nomorTeks) { continue; } // baris kosong / header ganda, lewati diam-diam

    const jenis = namaJenis(jenisTeks);
    if (!jenis) {
      dilewati.push(nomorLabel + ': jenis surat "' + jenisTeks + '" tidak dikenali.');
      continue;
    }

    const nomorInfo = pisahkanNomor(nomorTeks);
    if (!nomorInfo.angka) {
      dilewati.push(nomorLabel + ': nomor surat tidak valid.');
      continue;
    }

    const tglParsed = parseTanggalFleksibel(tglTeks);
    if (!tglParsed) {
      dilewati.push(nomorLabel + ': tanggal surat "' + tglTeks + '" tidak bisa dibaca.');
      continue;
    }
    if (tglParsed.ambigu) {
      tandaiAmbigu.push(nomorLabel + ': tanggal "' + tglTeks + '" diasumsikan dd/MM/yyyy -> ' + tglParsed.iso + ' (cek manual kalau salah).');
    }

    let tahun = Number(tahunTeks);
    if (!tahun) tahun = Number(tglParsed.iso.substring(0, 4));

    const gabungan = String(nomorInfo.angka) + (nomorInfo.huruf || '');
    const kunciDobel = jenis + '|' + tahun + '|' + gabungan;
    if (sudahDilihat.has(kunciDobel)) {
      dilewati.push(nomorLabel + ': dobel dengan baris lain di file CSV yang sama (' + gabungan + ' / ' + jenis + ' / ' + tahun + ').');
      continue;
    }
    sudahDilihat.add(kunciDobel);

    if (!nama || !alamat || !perihal) {
      dilewati.push(nomorLabel + ': ada kolom wajib yang kosong (nama/alamat/perihal).');
      continue;
    }

    let tglSimpanIso = null;
    const tglSimpanParsed = parseTanggalFleksibel(tglSimpanTeks);
    if (tglSimpanParsed) tglSimpanIso = tglSimpanParsed.iso + 'T00:00:00Z';

    siapDitulis.push({
      nomor_surat: gabungan,
      nomor_angka: nomorInfo.angka,
      huruf_sisipan: nomorInfo.huruf,
      tanggal_surat: tglParsed.iso,
      nama,
      alamat,
      perihal,
      tanggal_simpan: tglSimpanIso || undefined,
      jenis_surat: jenis,
      tahun
    });
  }

  console.log('');
  console.log('Siap dimigrasi :', siapDitulis.length);
  console.log('Dilewati       :', dilewati.length);
  if (dilewati.length) {
    console.log('--- Detail yang dilewati (perbaiki di sumber lalu ulangi export CSV kalau perlu) ---');
    dilewati.slice(0, 50).forEach((d) => console.log('  - ' + d));
    if (dilewati.length > 50) console.log('  ... dan ' + (dilewati.length - 50) + ' lainnya.');
  }
  if (tandaiAmbigu.length) {
    console.log('--- Tanggal yang formatnya ambigu (ditulis tetap, tapi CEK MANUAL) ---');
    tandaiAmbigu.slice(0, 20).forEach((d) => console.log('  - ' + d));
    if (tandaiAmbigu.length > 20) console.log('  ... dan ' + (tandaiAmbigu.length - 20) + ' lainnya.');
  }

  /* ---------------- Users ---------------- */
  const dataUsers = bacaCsv(PATH_USERS);
  const userBaru = [];
  const passwordSementara = [];

  if (dataUsers) {
    console.log('');
    console.log('Baris di Users.csv:', dataUsers.length);
    for (const baris of dataUsers) {
      const email = String(cariKolom(baris, ['Email']) || '').trim().toLowerCase();
      const nama = String(cariKolom(baris, ['Nama']) || '').trim();
      const role = String(cariKolom(baris, ['Role']) || 'admin').trim().toLowerCase() || 'admin';
      if (!email) continue;

      // Password lama (plaintext ATAU hash sha256 versi Apps Script) TIDAK
      // BISA dipindahkan ke bcrypt - dibuatkan password sementara acak,
      // wajib diganti admin itu sendiri setelah login pertama kali.
      const passBaru = crypto.randomBytes(9).toString('base64url');
      passwordSementara.push({ email, passBaru });

      userBaru.push({ email, nama: nama || email, role, passBaru });
    }
    console.log('Akun ditemukan:', userBaru.length);
  } else {
    console.log('');
    console.log('(Tidak ada data/Users.csv - akun admin default dari sql/001_schema.sql tetap dipakai.)');
  }

  if (!KOMIT) {
    console.log('');
    console.log('=== DRY-RUN SELESAI - tidak ada yang ditulis ke database. ===');
    console.log('Kalau ringkasan di atas sudah sesuai, jalankan ulang dengan --commit.');
    return;
  }

  /* ---------------- Tulis ke Supabase ---------------- */
  console.log('');
  console.log('Menulis ke Supabase...');

  const UKURAN_BATCH = 200;
  let ditulis = 0, dilewatiSudahAda = 0;

  for (let i = 0; i < siapDitulis.length; i += UKURAN_BATCH) {
    const batch = siapDitulis.slice(i, i + UKURAN_BATCH);
    const { data, error } = await sb
      .from('surat_keluar')
      .upsert(batch, {
        onConflict: 'jenis_surat,tahun,nomor_surat',
        ignoreDuplicates: true
      })
      .select('id');

    if (error) {
      console.error('Gagal menulis batch mulai baris ' + i + ':', error.message);
      process.exit(1);
    }
    ditulis += data ? data.length : 0;
    process.stdout.write('  ' + Math.min(i + UKURAN_BATCH, siapDitulis.length) + '/' + siapDitulis.length + ' diproses\r');
  }
  dilewatiSudahAda = siapDitulis.length - ditulis;
  console.log('');
  console.log('Surat berhasil ditulis (baru)   :', ditulis);
  console.log('Surat dilewati (sudah ada)      :', dilewatiSudahAda);

  if (userBaru.length) {
    for (const u of userBaru) {
      const hash = await bcrypt.hash(u.passBaru, 10);
      const { error } = await sb.from('users').upsert({
        email: u.email,
        nama: u.nama,
        role: u.role,
        password_hash: hash,
        wajib_ganti_password: true
      }, { onConflict: 'email' });
      if (error) {
        console.error('Gagal menulis user ' + u.email + ':', error.message);
      }
    }

    const pathKeluaran = path.join(__dirname, '..', 'data', 'password-sementara-HAPUS-SETELAH-DIPAKAI.txt');
    const isiFile = [
      'PASSWORD SEMENTARA HASIL MIGRASI - ' + new Date().toISOString(),
      'Setiap admin WAJIB login lalu langsung klik "Ganti Password" di pojok kanan atas.',
      'HAPUS FILE INI setelah semua password dibagikan & diganti.',
      '',
      ...passwordSementara.map((p) => p.email + '  ->  ' + p.passBaru)
    ].join('\n');
    writeFileSync(pathKeluaran, isiFile, 'utf8');
    console.log('');
    console.log('Akun ditulis/diperbarui:', userBaru.length);
    console.log('Password sementara disimpan di: ' + pathKeluaran);
    console.log('BAGIKAN SECARA AMAN (jangan lewat chat/email biasa), lalu HAPUS file itu.');
  }

  console.log('');
  console.log('=== MIGRASI SELESAI ===');
}

main().catch((e) => {
  console.error('Migrasi gagal:', e);
  process.exit(1);
});
