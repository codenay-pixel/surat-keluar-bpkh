/*****************************************************************
 * LOGIKA BISNIS - dipindahkan dari Code.gs (Google Apps Script)
 * Fungsi-fungsi murni (tidak menyentuh database), dipakai bersama
 * oleh semua API routes. Perilakunya dijaga IDENTIK dengan versi
 * Apps Script supaya hasil migrasi tidak mengubah aturan yang
 * sudah dipahami pengguna.
 *****************************************************************/

export const NAMA_BULAN = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
];

// 9 jenis surat keluar (dropdown tetap / fix). "batas" = jatah nomor
// per tahun untuk jenis itu - Surat Keluar & Surat Perintah Tugas
// 2000 nomor, jenis lainnya 1000 nomor.
export const DAFTAR_JENIS_SURAT = [
  { kode: 'S',   nama: 'Surat Keluar',           batas: 2000 },
  { kode: 'SPT', nama: 'Surat Perintah Tugas',   batas: 2000 },
  { kode: 'UN',  nama: 'Surat Undangan',         batas: 1000 },
  { kode: 'KT',  nama: 'Surat Keterangan',       batas: 1000 },
  { kode: 'SK',  nama: 'Surat Keputusan',        batas: 1000 },
  { kode: 'SP',  nama: 'Surat Pengantar',        batas: 1000 },
  { kode: 'LP',  nama: 'Surat Laporan',          batas: 1000 },
  { kode: 'SPK', nama: 'Surat Perintah Kerja',   batas: 1000 },
  { kode: 'BA',  nama: 'Surat Berita Acara',     batas: 1000 }
];

export const NOMOR_MIN = 1;
export const NOMOR_MAX_DEFAULT = 1000;
export const SLOT_PER_HALAMAN = 10;

export function namaJenis(kodeAtauNama) {
  const nilai = String(kodeAtauNama || '').trim();
  for (const j of DAFTAR_JENIS_SURAT) {
    if (j.nama.toLowerCase() === nilai.toLowerCase() ||
        j.kode.toLowerCase() === nilai.toLowerCase()) {
      return j.nama;
    }
  }
  return nilai;
}

export function batasNomor(kodeAtauNama) {
  const nama = namaJenis(kodeAtauNama);
  const j = DAFTAR_JENIS_SURAT.find(j => j.nama === nama);
  return j ? j.batas : NOMOR_MAX_DEFAULT;
}

/* =============== NOMOR SISIPAN (mis. "801 A", "801 B") =============== */

/** "801A" / "801 a" / 801 (Number) -> { angka: 801, huruf: 'A' } */
export function pisahkanNomor(nilai) {
  const teks = String(nilai === null || nilai === undefined ? '' : nilai)
    .trim().toUpperCase().replace(/\s+/g, '');
  const cocok = /^([0-9]+)([A-Z]?)$/.exec(teks);
  if (!cocok) {
    return { angka: 0, huruf: '' };
  }
  return { angka: Number(cocok[1]), huruf: cocok[2] || '' };
}

/** Bentuk yang disimpan ke database: "801" atau "801A" (tanpa spasi). */
export function gabunganNomor(angka, huruf) {
  return String(angka) + (huruf || '');
}

/** Bentuk yang ditampilkan ke user: "801" atau "801 A" (pakai spasi). */
export function formatNomorTampil(nilai) {
  const p = pisahkanNomor(nilai);
  if (!p.angka) {
    return String(nilai || '');
  }
  return p.huruf ? (p.angka + ' ' + p.huruf) : String(p.angka);
}

/** Dipakai untuk membandingkan dua nomor supaya "801" vs "801A" vs
    "801 A" semuanya dianggap konsisten (case/spasi tidak berpengaruh). */
export function normalisasiNomor(nilai) {
  const p = pisahkanNomor(nilai);
  return p.angka ? gabunganNomor(p.angka, p.huruf) : '';
}

/* =============== FORMAT TANGGAL =============== */

export function tanggalDariInput(teks) {
  const bagian = String(teks).split('-');
  if (bagian.length !== 3) {
    throw new Error('Format tanggal tidak valid.');
  }
  const tgl = new Date(Date.UTC(Number(bagian[0]), Number(bagian[1]) - 1, Number(bagian[2])));
  if (isNaN(tgl.getTime())) {
    throw new Error('Format tanggal tidak valid.');
  }
  return tgl;
}

function pad2(n) {
  return n < 10 ? '0' + n : String(n);
}

export function formatTanggal(nilai, pola) {
  if (!nilai) return '';
  const tgl = (nilai instanceof Date) ? nilai : new Date(nilai);
  if (isNaN(tgl.getTime())) return '';
  const y = tgl.getUTCFullYear();
  const m = tgl.getUTCMonth();
  const d = tgl.getUTCDate();
  const hh = tgl.getUTCHours();
  const mm = tgl.getUTCMinutes();
  if (pola === 'yyyy-MM-dd') {
    return y + '-' + pad2(m + 1) + '-' + pad2(d);
  }
  if (pola === 'dd/MM/yyyy') {
    return pad2(d) + '/' + pad2(m + 1) + '/' + y;
  }
  if (pola === 'dd/MM/yyyy HH:mm') {
    return pad2(d) + '/' + pad2(m + 1) + '/' + y + ' ' + pad2(hh) + ':' + pad2(mm);
  }
  return tgl.toISOString();
}

/** 31 Agustus 2026 */
export function tanggalIndonesia(nilai) {
  if (!nilai) return '';
  const tgl = (nilai instanceof Date) ? nilai : new Date(nilai);
  if (isNaN(tgl.getTime())) return '';
  return tgl.getUTCDate() + ' ' + NAMA_BULAN[tgl.getUTCMonth()] + ' ' + tgl.getUTCFullYear();
}

export function tahunDariTanggal(tanggalSurat) {
  if (!tanggalSurat) return 0;
  const tgl = (tanggalSurat instanceof Date) ? tanggalSurat : new Date(tanggalSurat);
  return isNaN(tgl.getTime()) ? 0 : tgl.getUTCFullYear();
}

/* =============== BENTUK OBJEK SURAT UNTUK KLIEN =============== */

/**
 * baris: { id, nomor_surat, tanggal_surat, nama, alamat, perihal,
 *          tanggal_simpan, jenis_surat, tahun }  (kolom Supabase)
 */
export function bikinObjek(baris) {
  const alamat = String(baris.alamat || '').trim();
  const tglPanjang = tanggalIndonesia(baris.tanggal_surat);
  const nomor = pisahkanNomor(baris.nomor_surat);

  return {
    id: baris.id,
    nomorSurat: formatNomorTampil(baris.nomor_surat),
    nomorAngka: nomor.angka,
    hurufSisipan: nomor.huruf,
    alamat: alamat,
    tanggalSurat: formatTanggal(baris.tanggal_surat, 'dd/MM/yyyy'),
    tanggalInput: formatTanggal(baris.tanggal_surat, 'yyyy-MM-dd'),
    alamatTanggal: alamat ? (alamat + ', ' + tglPanjang) : tglPanjang,
    nama: String(baris.nama || ''),
    perihal: String(baris.perihal || ''),
    tanggalSimpan: formatTanggal(baris.tanggal_simpan, 'dd/MM/yyyy HH:mm'),
    jenisSurat: namaJenis(baris.jenis_surat),
    tahun: Number(baris.tahun)
  };
}

/* =============== VALIDASI =============== */

export function validasiData(d) {
  if (!d) {
    throw new Error('Data surat kosong.');
  }
  if (!d.jenisSurat) {
    throw new Error('Jenis surat wajib dipilih.');
  }

  const jenisNama = namaJenis(d.jenisSurat);
  const jenisValid = DAFTAR_JENIS_SURAT.some(j => j.nama === jenisNama);
  if (!jenisValid) {
    throw new Error('Jenis surat tidak dikenali.');
  }

  const batas = batasNomor(jenisNama);

  if (!d.nomorSurat) {
    throw new Error('Nomor surat wajib dipilih.');
  }
  const nomorInfo = pisahkanNomor(d.nomorSurat);
  if (!nomorInfo.angka || nomorInfo.angka < NOMOR_MIN || nomorInfo.angka > batas ||
      nomorInfo.angka !== Math.floor(nomorInfo.angka)) {
    throw new Error('Nomor surat untuk ' + jenisNama + ' harus angka ' + NOMOR_MIN + ' sampai ' + batas + '.');
  }
  if (!d.alamat) {
    throw new Error('Alamat wajib diisi.');
  }
  if (!d.tanggalSurat) {
    throw new Error('Tanggal surat wajib diisi.');
  }
  if (!d.nama) {
    throw new Error('Nama pengaju wajib diisi.');
  }
  if (!d.perihal) {
    throw new Error('Perihal wajib diisi.');
  }
  return {
    angka: nomorInfo.angka,
    huruf: nomorInfo.huruf,
    gabungan: gabunganNomor(nomorInfo.angka, nomorInfo.huruf),
    jenisNama: jenisNama
  };
}
