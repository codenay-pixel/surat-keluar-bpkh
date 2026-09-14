/*****************************************************************
 * LAPISAN AKSES DATA - dipindahkan dari Code.gs (Google Apps Script)
 * Setiap fungsi di sini adalah versi Supabase dari fungsi Apps
 * Script dengan nama yang sama (tanpa garis bawah di belakang).
 * Perilakunya dijaga sama persis.
 *****************************************************************/

import { supabaseAdmin } from './supabase';
import {
  DAFTAR_JENIS_SURAT, NOMOR_MIN, SLOT_PER_HALAMAN,
  namaJenis, batasNomor, pisahkanNomor, gabunganNomor, formatNomorTampil,
  normalisasiNomor, bikinObjek, validasiData, tanggalDariInput,
  formatTanggal, tahunDariTanggal
} from './bisnis';

/* ===========================================================
   BANTUAN WAKTU - server (Netlify) berjalan di zona UTC, tapi semua
   makna "hari ini/minggu ini" di aplikasi ini harus mengikuti WIB
   (Asia/Jakarta, UTC+7, tidak pakai DST) supaya sama seperti versi
   Apps Script dulu (yang zona waktu proyeknya diatur ke Jakarta).
   Trik: geser epoch +7 jam, lalu baca dengan getUTC*() - hasilnya
   selalu jadi tanggal/waktu dinding Jakarta, apa pun zona waktu
   server yang sebenarnya.
   =========================================================== */
const OFFSET_JAKARTA_MS = 7 * 60 * 60 * 1000;

function pad2Waktu(n) { return n < 10 ? '0' + n : String(n); }

function bagianJakartaDariEpoch(epochMs) {
  const s = new Date(epochMs + OFFSET_JAKARTA_MS);
  return { tahun: s.getUTCFullYear(), bulan: s.getUTCMonth(), tanggal: s.getUTCDate(), hari: s.getUTCDay() };
}

function ymdDariBagian(b) {
  return b.tahun + '-' + pad2Waktu(b.bulan + 1) + '-' + pad2Waktu(b.tanggal);
}

/** Format 'yyyy-MM-dd' dari nilai ms hasil aritmetika Date.UTC(tahun,bulan,tanggal, ...) - bukan epoch asli. */
function ymdDariMsKalender(ms) {
  const d = new Date(ms);
  return d.getUTCFullYear() + '-' + pad2Waktu(d.getUTCMonth() + 1) + '-' + pad2Waktu(d.getUTCDate());
}

function bagianJakartaSekarang() {
  return bagianJakartaDariEpoch(Date.now());
}

/** Tanggal hari ini (WIB) dalam format 'yyyy-MM-dd'. */
function tanggalHariIniJakarta() {
  return ymdDariBagian(bagianJakartaSekarang());
}

async function bacaSemua(filter) {
  const sb = supabaseAdmin();
  let q = sb.from('surat_keluar').select('*');
  if (filter?.tahun !== undefined) q = q.eq('tahun', filter.tahun);
  if (filter?.jenis) q = q.eq('jenis_surat', filter.jenis);
  const { data, error } = await q;
  if (error) throw new Error('Gagal membaca data: ' + error.message);
  return data || [];
}

/* =============== BACA DATA =============== */

export async function getRiwayatSuratKeluar(tahun) {
  const pakaiFilter = tahun && String(tahun).toUpperCase() !== 'SEMUA';
  const data = await bacaSemua(pakaiFilter ? { tahun: Number(tahun) } : {});

  const hasil = data.map(bikinObjek);

  hasil.sort((a, b) => {
    if (a.tahun !== b.tahun) return b.tahun - a.tahun;
    if (a.tanggalInput !== b.tanggalInput) return a.tanggalInput < b.tanggalInput ? 1 : -1;
    if (b.nomorAngka !== a.nomorAngka) return b.nomorAngka - a.nomorAngka;
    return a.hurufSisipan < b.hurufSisipan ? -1 : (a.hurufSisipan > b.hurufSisipan ? 1 : 0);
  });

  return hasil;
}

export async function getRiwayatMingguan() {
  const bagianSekarang = bagianJakartaSekarang();
  const msHariIni = Date.UTC(bagianSekarang.tahun, bagianSekarang.bulan, bagianSekarang.tanggal);
  const msBatas = msHariIni - 7 * 24 * 60 * 60 * 1000;

  const sb = supabaseAdmin();
  const { data, error } = await sb
    .from('surat_keluar')
    .select('*')
    .gte('tanggal_surat', ymdDariMsKalender(msBatas))
    .lte('tanggal_surat', ymdDariBagian(bagianSekarang));
  if (error) throw new Error('Gagal membaca data: ' + error.message);

  const hasil = (data || []).map(bikinObjek);
  hasil.sort((a, b) => {
    if (b.nomorAngka !== a.nomorAngka) return b.nomorAngka - a.nomorAngka;
    return a.hurufSisipan < b.hurufSisipan ? -1 : (a.hurufSisipan > b.hurufSisipan ? 1 : 0);
  });
  return hasil;
}

export async function getDaftarTahun() {
  const sb = supabaseAdmin();
  const { data, error } = await sb.from('surat_keluar').select('tahun');
  if (error) throw new Error('Gagal membaca data: ' + error.message);

  const ada = {};
  for (const r of data || []) {
    if (r.tahun) ada[r.tahun] = true;
  }
  ada[new Date().getFullYear()] = true;

  return Object.keys(ada).map(Number).sort((a, b) => b - a);
}

/**
 * Nomor 1-batas yang masih kosong untuk satu jenis surat di tahun
 * tersebut. Tiap jenis punya jatah sendiri.
 */
export async function getNomorTersedia(tahun, jenisSurat, kecualiId) {
  const tahunAngka = Number(tahun) || new Date().getFullYear();
  const jenis = namaJenis(jenisSurat);
  if (!jenis) return [];

  const batas = batasNomor(jenis);
  const data = await bacaSemua({ tahun: tahunAngka, jenis });

  const terpakai = {};
  for (const r of data) {
    if (kecualiId && r.id === kecualiId) continue;
    terpakai[String(r.nomor_surat).trim()] = true;
  }

  const hasil = [];
  for (let n = NOMOR_MIN; n <= batas; n++) {
    if (!terpakai[String(n)]) hasil.push(n);
  }
  return hasil;
}

/**
 * 10 slot nomor kosong untuk dipajang di layar (lanjutan + terlewat),
 * plus papan surat pada tanggal yang dipilih.
 */
export async function getSlotNomor(tanggalIso, jenisSurat, halaman, lompatKe) {
  const jenis = namaJenis(jenisSurat) || DAFTAR_JENIS_SURAT[0].nama;
  const batas = batasNomor(jenis);
  const bagianHariIni = bagianJakartaSekarang();
  const tanggalDipilih = (tanggalIso && String(tanggalIso).length === 10)
    ? String(tanggalIso)
    : ymdDariBagian(bagianHariIni);

  const tahunAngka = Number(tanggalDipilih.substring(0, 4)) || bagianHariIni.tahun;

  // Papan harian: semua surat (semua jenis) pada tanggal yang dipilih
  const sb = supabaseAdmin();
  const { data: dataHarian, error: errHarian } = await sb
    .from('surat_keluar').select('*').eq('tanggal_surat', tanggalDipilih);
  if (errHarian) throw new Error('Gagal membaca data: ' + errHarian.message);

  const suratHariIni = (dataHarian || []).map(r => {
    const p = pisahkanNomor(r.nomor_surat);
    return {
      nomorSurat: formatNomorTampil(r.nomor_surat),
      nomorAngka: p.angka,
      jenisSurat: namaJenis(r.jenis_surat),
      nama: String(r.nama || ''),
      perihal: String(r.perihal || '')
    };
  }).sort((a, b) => a.nomorAngka - b.nomorAngka);

  // Jatah nomor untuk jenis+tahun ini (nomor dasar saja, sisipan diabaikan)
  const dataJenisTahun = await bacaSemua({ tahun: tahunAngka, jenis });
  const terpakai = {};
  let terakhirDipakai = 0;
  let pertamaDipakai = 0;
  for (const r of dataJenisTahun) {
    const p = pisahkanNomor(r.nomor_surat);
    if (p.huruf) continue;
    const n = p.angka;
    terpakai[String(n)] = true;
    if (n > terakhirDipakai) terakhirDipakai = n;
    if (!pertamaDipakai || n < pertamaDipakai) pertamaDipakai = n;
  }

  const tersedia = [];
  const terlewat = [];
  for (let k = NOMOR_MIN; k <= batas; k++) {
    if (terpakai[String(k)]) continue;
    if (k > terakhirDipakai) {
      tersedia.push(k);
    } else if (k > pertamaDipakai) {
      terlewat.push(k);
    }
  }

  const totalHalaman = Math.max(1, Math.ceil(tersedia.length / SLOT_PER_HALAMAN));
  let hal = Number(halaman);
  if (!hal || hal < 0) hal = 0;

  let catatanLompat = '';
  if (lompatKe) {
    const target = Number(lompatKe);
    if (!target || target < NOMOR_MIN || target > batas) {
      catatanLompat = 'Nomor harus antara ' + NOMOR_MIN + ' dan ' + batas + '.';
    } else if (terpakai[String(target)]) {
      catatanLompat = 'Nomor ' + target + ' sudah dipakai untuk ' + jenis + ' di tahun ' + tahunAngka + '.';
    } else if (!tersedia.length) {
      catatanLompat = 'Tidak ada nomor kosong yang bisa dituju.';
    } else {
      let idx = -1;
      for (let t = 0; t < tersedia.length; t++) {
        if (tersedia[t] >= target) { idx = t; break; }
      }
      if (idx < 0) idx = tersedia.length - 1;
      hal = Math.floor(idx / SLOT_PER_HALAMAN);
      if (tersedia[idx] !== target) {
        catatanLompat = 'Nomor ' + target + ' tidak tersedia, ditampilkan mulai ' + tersedia[idx] + '.';
      }
    }
  }

  if (hal > totalHalaman - 1) hal = totalHalaman - 1;

  const mulai = hal * SLOT_PER_HALAMAN;
  const isiHalaman = tersedia.slice(mulai, mulai + SLOT_PER_HALAMAN);

  return {
    tahun: tahunAngka,
    jenis,
    tanggal: tanggalDipilih,
    suratHariIni,
    jumlahHariIni: suratHariIni.length,
    terakhirDipakai,
    lanjutan: isiHalaman,
    dariNomor: isiHalaman.length ? isiHalaman[0] : 0,
    sampaiNomor: isiHalaman.length ? isiHalaman[isiHalaman.length - 1] : 0,
    halaman: hal,
    totalHalaman,
    jumlahLanjutan: tersedia.length,
    catatanLompat,
    terlewat: terlewat.slice(0, SLOT_PER_HALAMAN),
    jumlahTerlewat: terlewat.length,
    sisa: tersedia.length + terlewat.length
  };
}

/* =============== NOMOR SISIPAN =============== */

async function basePernahDipakai(angka, tahun, jenis, kecualiId) {
  const data = await bacaSemua({ tahun, jenis: namaJenis(jenis) });
  for (const r of data) {
    if (kecualiId && r.id === kecualiId) continue;
    const p = pisahkanNomor(r.nomor_surat);
    if (p.angka === angka && !p.huruf) return true;
  }
  return false;
}

async function adaSisipanUntuk(angka, tahun, jenis, kecualiId) {
  const data = await bacaSemua({ tahun, jenis: namaJenis(jenis) });
  for (const r of data) {
    if (kecualiId && r.id === kecualiId) continue;
    const p = pisahkanNomor(r.nomor_surat);
    if (p.angka === angka && p.huruf) return true;
  }
  return false;
}

export async function getHurufBerikutnya(tahun, jenisSurat, angka) {
  const jenis = namaJenis(jenisSurat);
  const tahunAngka = Number(tahun) || new Date().getFullYear();
  const angkaNum = Number(angka);

  if (!(await basePernahDipakai(angkaNum, tahunAngka, jenis, null))) {
    throw new Error(
      'Nomor ' + angkaNum + ' belum pernah dipakai untuk ' + jenis +
      ' di tahun ' + tahunAngka + ', jadi belum bisa dibuatkan sisipan.'
    );
  }

  const data = await bacaSemua({ tahun: tahunAngka, jenis });
  const hurufTerpakai = {};
  for (const r of data) {
    const p = pisahkanNomor(r.nomor_surat);
    if (p.angka === angkaNum && p.huruf) hurufTerpakai[p.huruf] = true;
  }

  for (let kode = 65; kode <= 90; kode++) {
    const huruf = String.fromCharCode(kode);
    if (!hurufTerpakai[huruf]) return huruf;
  }
  throw new Error('Sisipan untuk nomor ' + angkaNum + ' sudah penuh (A sampai Z habis).');
}

async function cekNomorGanda(nomorGabungan, tahun, jenis, kecualiId) {
  const jenisBaku = namaJenis(jenis);
  const target = normalisasiNomor(nomorGabungan);
  const data = await bacaSemua({ tahun, jenis: jenisBaku });

  for (const r of data) {
    if (kecualiId && r.id === kecualiId) continue;
    if (normalisasiNomor(r.nomor_surat) === target) {
      throw new Error(
        'Nomor ' + formatNomorTampil(target) + ' sudah dipakai untuk ' + jenisBaku +
        ' di tahun ' + tahun + '.'
      );
    }
  }
}

async function pastikanBaseSisipanValid(nomorInfo, tahun, jenis, kecualiId) {
  if (!nomorInfo.huruf) return;
  if (!(await basePernahDipakai(nomorInfo.angka, tahun, jenis, kecualiId))) {
    throw new Error(
      'Nomor ' + nomorInfo.angka + ' belum pernah dipakai untuk ' + namaJenis(jenis) +
      ' di tahun ' + tahun + ', jadi belum bisa dibuatkan sisipan hurufnya.'
    );
  }
}

/* =============== STATISTIK =============== */

export async function getStatistikSurat() {
  const hasil = { hariIni: 0, mingguIni: 0, bulanIni: 0, tahunIni: 0, totalSemua: 0 };

  const perJenis = DAFTAR_JENIS_SURAT.map(j => ({
    kode: j.kode, nama: j.nama, hariIni: 0, tahunIni: 0, terakhirDipakai: 0
  }));
  const indeksJenis = {};
  DAFTAR_JENIS_SURAT.forEach((j, i) => { indeksJenis[j.nama] = i; });
  hasil.perJenis = perJenis;

  const data = await bacaSemua({});
  if (!data.length) return hasil;

  const bagianSekarang = bagianJakartaSekarang();
  const msHariIni = Date.UTC(bagianSekarang.tahun, bagianSekarang.bulan, bagianSekarang.tanggal);

  const hariKe = bagianSekarang.hari === 0 ? 6 : bagianSekarang.hari - 1; // jarak dari Senin
  const msAwalMinggu = msHariIni - hariKe * 24 * 60 * 60 * 1000;
  const msAkhirMinggu = msAwalMinggu + 7 * 24 * 60 * 60 * 1000 - 1; // akhir hari Minggu 23:59:59.999

  for (const r of data) {
    hasil.totalSemua++;

    if (!r.tanggal_surat) continue;
    const bagianTgl = String(r.tanggal_surat).split('-').map(Number);
    if (bagianTgl.length !== 3 || !bagianTgl[0]) continue;
    const [tglTahun, tglBulan, tglTanggal] = bagianTgl;
    const msTgl = Date.UTC(tglTahun, tglBulan - 1, tglTanggal);

    if (msTgl === msHariIni) hasil.hariIni++;
    if (msTgl >= msAwalMinggu && msTgl <= msAkhirMinggu) hasil.mingguIni++;

    if (tglTahun === bagianSekarang.tahun) {
      hasil.tahunIni++;
      if ((tglBulan - 1) === bagianSekarang.bulan) hasil.bulanIni++;

      const idx = indeksJenis[namaJenis(r.jenis_surat)];
      if (idx !== undefined) {
        perJenis[idx].tahunIni++;
        if (msTgl === msHariIni) perJenis[idx].hariIni++;

        const pStat = pisahkanNomor(r.nomor_surat);
        if (!pStat.huruf && pStat.angka > perJenis[idx].terakhirDipakai) {
          perJenis[idx].terakhirDipakai = pStat.angka;
        }
      }
    }
  }

  return hasil;
}

/* =============== SIMPAN / UBAH / HAPUS =============== */

export async function simpanSurat(d, emailAdmin) {
  const nomorInfo = validasiData(d);
  const tanggal = tanggalDariInput(d.tanggalSurat);
  const tahun = tanggal.getUTCFullYear();

  await pastikanBaseSisipanValid(nomorInfo, tahun, d.jenisSurat, null);
  await cekNomorGanda(nomorInfo.gabungan, tahun, d.jenisSurat, null);

  const sb = supabaseAdmin();
  const { error } = await sb.from('surat_keluar').insert({
    nomor_surat: nomorInfo.gabungan,
    nomor_angka: nomorInfo.angka,
    huruf_sisipan: nomorInfo.huruf,
    tanggal_surat: formatTanggal(tanggal, 'yyyy-MM-dd'),
    nama: String(d.nama).trim(),
    alamat: String(d.alamat).trim(),
    perihal: String(d.perihal).trim(),
    jenis_surat: nomorInfo.jenisNama,
    tahun,
    dibuat_oleh: emailAdmin || null
  });

  if (error) {
    if (error.code === '23505') {
      throw new Error('Nomor ' + formatNomorTampil(nomorInfo.gabungan) + ' sudah dipakai untuk ' + nomorInfo.jenisNama + ' di tahun ' + tahun + '.');
    }
    throw new Error('Gagal menyimpan surat: ' + error.message);
  }
  return true;
}

export async function editDataSurat(id, d) {
  const sb = supabaseAdmin();
  const { data: baris, error: errBaca } = await sb.from('surat_keluar').select('*').eq('id', id).maybeSingle();
  if (errBaca) throw new Error('Gagal membaca data: ' + errBaca.message);
  if (!baris) throw new Error('Data surat tidak ditemukan.');

  const nomorInfo = validasiData(d);
  const tanggal = tanggalDariInput(d.tanggalSurat);
  const tahun = tanggal.getUTCFullYear();

  await pastikanBaseSisipanValid(nomorInfo, tahun, d.jenisSurat, id);
  await cekNomorGanda(nomorInfo.gabungan, tahun, d.jenisSurat, id);

  const { error } = await sb.from('surat_keluar').update({
    nomor_surat: nomorInfo.gabungan,
    nomor_angka: nomorInfo.angka,
    huruf_sisipan: nomorInfo.huruf,
    tanggal_surat: formatTanggal(tanggal, 'yyyy-MM-dd'),
    nama: String(d.nama).trim(),
    alamat: String(d.alamat).trim(),
    perihal: String(d.perihal).trim(),
    jenis_surat: nomorInfo.jenisNama,
    tahun
  }).eq('id', id);

  if (error) {
    if (error.code === '23505') {
      throw new Error('Nomor ' + formatNomorTampil(nomorInfo.gabungan) + ' sudah dipakai untuk ' + nomorInfo.jenisNama + ' di tahun ' + tahun + '.');
    }
    throw new Error('Gagal menyimpan perubahan: ' + error.message);
  }
  return true;
}

export async function hapusSuratKeluar(id) {
  const sb = supabaseAdmin();
  const { data: baris, error: errBaca } = await sb.from('surat_keluar').select('*').eq('id', id).maybeSingle();
  if (errBaca) throw new Error('Gagal membaca data: ' + errBaca.message);
  if (!baris) throw new Error('Data surat tidak ditemukan.');

  const nomorInfo = pisahkanNomor(baris.nomor_surat);
  if (nomorInfo.angka && !nomorInfo.huruf) {
    const jenisBaris = namaJenis(baris.jenis_surat);
    const tahunBarisIni = Number(baris.tahun);
    if (await adaSisipanUntuk(nomorInfo.angka, tahunBarisIni, jenisBaris, id)) {
      throw new Error(
        'Nomor ' + nomorInfo.angka + ' masih punya sisipan huruf (mis. ' +
        nomorInfo.angka + ' A). Hapus dulu semua sisipannya sebelum menghapus nomor dasar ini.'
      );
    }
  }

  const { error } = await sb.from('surat_keluar').delete().eq('id', id);
  if (error) throw new Error('Gagal menghapus data: ' + error.message);
  return true;
}

/* =============== PAKET DATA AWAL =============== */

export async function getDataAwal(tahun) {
  const tahunSekarang = new Date().getFullYear();
  const tahunDipakai = tahun ? tahun : tahunSekarang;
  const jenisAwal = DAFTAR_JENIS_SURAT[0].nama;

  const [daftarTahun, statistik, riwayat, nomorTersedia, slotNomor] = await Promise.all([
    getDaftarTahun(),
    getStatistikSurat(),
    getRiwayatSuratKeluar(tahunDipakai),
    getNomorTersedia(tahunSekarang, jenisAwal, null),
    getSlotNomor(tanggalHariIniJakarta(), jenisAwal, 0, null)
  ]);

  return {
    jenisSurat: DAFTAR_JENIS_SURAT,
    jenisAwal,
    tahunSekarang,
    tahunDipilih: tahunDipakai,
    daftarTahun,
    statistik,
    riwayat,
    nomorTersedia,
    slotNomor
  };
}

/* =============== HALAMAN BUKU (register berurutan) =============== */

export async function getHalamanBuku(tahun, jenisSurat, halaman) {
  const jenis = namaJenis(jenisSurat) || DAFTAR_JENIS_SURAT[0].nama;
  const tahunAngka = Number(tahun) || new Date().getFullYear();
  const batas = batasNomor(jenis);
  const totalHalaman = Math.max(1, Math.ceil(batas / SLOT_PER_HALAMAN));

  let hal = Number(halaman);
  if (!hal || hal < 0) hal = 0;
  if (hal > totalHalaman - 1) hal = totalHalaman - 1;

  const mulai = hal * SLOT_PER_HALAMAN + 1;
  const akhir = Math.min(mulai + SLOT_PER_HALAMAN - 1, batas);

  const data = await bacaSemua({ tahun: tahunAngka, jenis });
  const petaHalaman = {};
  const petaSisipan = {};
  let jumlahTerisi = 0;

  for (const r of data) {
    const p = pisahkanNomor(r.nomor_surat);
    if (!p.huruf) jumlahTerisi++;
    if (p.angka >= mulai && p.angka <= akhir) {
      if (p.huruf) {
        if (!petaSisipan[p.angka]) petaSisipan[p.angka] = [];
        petaSisipan[p.angka].push(bikinObjek(r));
      } else {
        petaHalaman[p.angka] = bikinObjek(r);
      }
    }
  }

  const baris = [];
  for (let n2 = mulai; n2 <= akhir; n2++) {
    baris.push(petaHalaman[n2] || { nomorSurat: String(n2), nomorAngka: n2, kosong: true });

    const sisipanNomorIni = petaSisipan[n2];
    if (sisipanNomorIni) {
      sisipanNomorIni.sort((a, b) => (a.hurufSisipan < b.hurufSisipan ? -1 : 1));
      baris.push(...sisipanNomorIni);
    }
  }

  return {
    jenis, tahun: tahunAngka, halaman: hal, totalHalaman, batas,
    jumlahTerisi, dariNomor: mulai, sampaiNomor: akhir, baris
  };
}