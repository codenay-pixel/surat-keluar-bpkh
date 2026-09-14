/*****************************************************************
 * LOGIKA DASHBOARD ADMIN - dipindahkan dari <script> di
 * AdminDashboard.html (Google Apps Script) ke Next.js.
 *
 * Perubahan dari versi asli:
 *  - google.script.run.withSuccessHandler/withFailureHandler(...)
 *    diganti fetch() ke /api/* (lihat helper panggil() di bawah).
 *  - sessionToken dihapus - otentikasi sekarang lewat cookie httpOnly
 *    yang otomatis ikut terkirim di setiap fetch (same-origin).
 *  - "row" (nomor baris di Google Sheet) diganti "id" (UUID kolom
 *    Supabase) di semua tempat yang dulu memakai row.
 * Selain itu perilakunya dijaga SAMA PERSIS dengan versi asli.
 *****************************************************************/

export function inisialisasiDashboard() {
  var NAMA_BULAN = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
    'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];

  var semuaRiwayat = [];
  var daftarJenis = [];
  var tahunSekarang = new Date().getFullYear();
  var tahunAktif = tahunSekarang;
  var barisYangAkanDihapus = null;
  var urutanNaik = true;
  var halamanArsipSekarang = 0;
  var ARSIP_PER_HALAMAN = 25;
  var hasilTersaring = [];

  var halamanBukuSekarang = 0;
  var barisYangDiedit = null;
  var tahunYangDiedit = null;

  var sisipanAngkaAktif = null;
  var sisipanHurufAktif = '';

  /* ===========================================================
     PEMANGGIL API (pengganti google.script.run)
     =========================================================== */
  function panggil(url, opsi) {
    return fetch(url, opsi).then(function (res) {
      return res.json().catch(function () { return {}; }).then(function (data) {
        if (!res.ok) {
          throw new Error(data && data.error ? data.error : ('Gagal memanggil ' + url));
        }
        return data;
      });
    });
  }
  function panggilJson(url, metode, body) {
    return panggil(url, {
      method: metode,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body || {})
    });
  }

  /* ===========================================================
     COMBOBOX NOMOR SURAT
     =========================================================== */
  function Combo(idWrap, idInput, idList, idInfo) {
    this.wrap = document.getElementById(idWrap);
    this.input = document.getElementById(idInput);
    this.list = document.getElementById(idList);
    this.info = idInfo ? document.getElementById(idInfo) : null;
    this.data = [];
    this.nilai = '';

    var self = this;

    this._onFocus = function () { self.buka(); };
    this._onClick = function () { self.buka(); };
    this._onInput = function () {
      self.nilai = '';
      self.gambar(self.input.value);
      self.wrap.classList.add('open');
      self.tempatkan();
    };
    this.input.addEventListener('focus', this._onFocus);
    this.input.addEventListener('click', this._onClick);
    this.input.addEventListener('input', this._onInput);

    this._onDocClick = function (e) {
      if (!self.wrap.contains(e.target)) { self.tutup(); }
    };
    document.addEventListener('click', this._onDocClick);

    this._onResize = function () { if (self.terbuka()) { self.tempatkan(); } };
    window.addEventListener('resize', this._onResize);
    this._onScroll = function () { if (self.terbuka()) { self.tempatkan(); } };
    window.addEventListener('scroll', this._onScroll, true);
  }

  Combo.prototype.terbuka = function () {
    return this.wrap.classList.contains('open');
  };

  Combo.prototype.tempatkan = function () {
    var kotak = this.input.getBoundingClientRect();
    var lebar = Math.max(kotak.width, 150);
    var tinggiMaks = 360;

    var ruangBawah = window.innerHeight - kotak.bottom - 12;
    var keAtas = (ruangBawah < 180 && kotak.top > ruangBawah);

    this.list.style.left = kotak.left + 'px';
    this.list.style.width = lebar + 'px';

    if (keAtas) {
      var tinggi = Math.min(tinggiMaks, kotak.top - 12);
      this.list.style.top = (kotak.top - tinggi - 4) + 'px';
      this.list.style.maxHeight = tinggi + 'px';
    } else {
      this.list.style.top = (kotak.bottom + 4) + 'px';
      this.list.style.maxHeight = Math.min(tinggiMaks, ruangBawah) + 'px';
    }
  };

  Combo.prototype.isi = function (daftarNomor, nilaiTerpilih, keterangan) {
    this.data = daftarNomor || [];
    this.nilai = nilaiTerpilih ? String(nilaiTerpilih) : '';
    this.input.value = this.nilai;
    this.gambar('');
    if (this.info) {
      this.info.innerText = keterangan || (this.data.length + ' nomor tersedia');
    }
  };

  Combo.prototype.buka = function () {
    this.gambar(this.nilai ? '' : this.input.value);
    this.wrap.classList.add('open');
    this.tempatkan();
  };

  Combo.prototype.tutup = function () {
    this.wrap.classList.remove('open');
    this.rapikan();
  };

  var BATAS_TAMPIL_NOMOR = 100;

  Combo.prototype.gambar = function (kataKunci) {
    var kunci = String(kataKunci || '').trim();
    var self = this;
    var cocok = this.data.filter(function (n) {
      return kunci === '' || String(n).indexOf(kunci) === 0;
    });

    if (!cocok.length) {
      this.list.innerHTML = '<div class="combo-kosong">Nomor tidak tersedia.</div>';
      return;
    }

    var dipotong = cocok.length > BATAS_TAMPIL_NOMOR;
    var tampil = dipotong ? cocok.slice(0, BATAS_TAMPIL_NOMOR) : cocok;

    this.list.innerHTML = tampil.map(function (n) {
      var aktif = (String(n) === self.nilai) ? ' aktif' : '';
      return '<div class="combo-item' + aktif + '" data-nomor="' + n + '">Nomor ' + n + '</div>';
    }).join('') + (dipotong
      ? '<div class="combo-kosong">Menampilkan ' + BATAS_TAMPIL_NOMOR +
        ' dari ' + cocok.length + ' nomor. Ketik angka awalnya untuk menyaring.</div>'
      : '');

    var items = this.list.querySelectorAll('.combo-item');
    for (var i = 0; i < items.length; i++) {
      items[i].addEventListener('click', function () {
        self.pilih(this.getAttribute('data-nomor'));
      });
    }
  };

  Combo.prototype.pilih = function (nomor) {
    this.nilai = String(nomor);
    this.input.value = this.nilai;
    this.wrap.classList.remove('open');
  };

  Combo.prototype.rapikan = function () {
    var ketikan = String(this.input.value).trim();
    if (this.data.indexOf(Number(ketikan)) >= 0) {
      this.nilai = ketikan;
    }
    this.input.value = this.nilai;
  };

  Combo.prototype.ambil = function () {
    this.rapikan();
    return this.nilai;
  };

  Combo.prototype.hancurkan = function () {
    this.input.removeEventListener('focus', this._onFocus);
    this.input.removeEventListener('click', this._onClick);
    this.input.removeEventListener('input', this._onInput);
    document.removeEventListener('click', this._onDocClick);
    window.removeEventListener('resize', this._onResize);
    window.removeEventListener('scroll', this._onScroll, true);
  };

  var comboNomor = null;
  var comboNomorEdit = null;

  function tahunNomor() {
    var tgl = document.getElementById('inputTanggal').value;
    if (tgl && tgl.length >= 4) { return Number(tgl.substring(0, 4)); }
    return tahunSekarang;
  }

  function gabungAlamatTanggal(alamat, tanggalIso) {
    var teksTanggal = '';
    if (tanggalIso && tanggalIso.length === 10) {
      var p = tanggalIso.split('-');
      teksTanggal = Number(p[2]) + ' ' + NAMA_BULAN[Number(p[1]) - 1] + ' ' + p[0];
    }
    if (alamat && teksTanggal) { return alamat + ', ' + teksTanggal; }
    return alamat || teksTanggal || '';
  }

  function perbaruiPratinjau() {
    var teks = gabungAlamatTanggal(
      document.getElementById('inputAlamat').value.trim(),
      document.getElementById('inputTanggal').value
    );
    document.getElementById('pratinjauAlamatTanggal').innerText =
      teks ? ('Tersimpan sebagai: ' + teks) : '';
  }

  /* ===========================================================
     PANEL 10 SLOT NOMOR KOSONG
     =========================================================== */
  function tanggalTerbaca() {
    var iso = document.getElementById('inputTanggal').value;
    if (!iso || iso.length !== 10) { return ''; }
    var p = iso.split('-');
    return Number(p[2]) + ' ' + NAMA_BULAN[Number(p[1]) - 1] + ' ' + p[0];
  }

  function chipsHtml(daftar, kelasTambahan) {
    return daftar.map(function (n) {
      return '<button type="button" class="chip-nomor' + kelasTambahan +
        '" onclick="pilihDariSlot(' + n + ')">' + n + '</button>';
    }).join('');
  }

  var halamanSlotSekarang = 0;

  function tampilkanSlot(s) {
    halamanSlotSekarang = s.halaman;

    var judul = document.getElementById('slotJudul');
    var chips = document.getElementById('slotChips');
    var catatan = document.getElementById('slotCatatan');
    var terlewat = document.getElementById('slotTerlewat');
    var tglTeks = tanggalTerbaca();

    judul.innerText = 'Papan hari ini' + (tglTeks ? '  ·  ' + tglTeks : '');

    document.getElementById('slotSubjudul').innerText =
      'Nomor kosong untuk ' + s.jenis +
      (s.terakhirDipakai ? '  ·  terakhir dipakai: ' + s.terakhirDipakai : '  ·  belum ada yang dipakai');

    var harian = document.getElementById('slotHarian');
    if (s.suratHariIni && s.suratHariIni.length) {
      harian.innerHTML =
        '<p class="slot-subjudul">Sudah tercatat pada tanggal ini (' +
        s.jumlahHariIni + ' surat)</p>' +
        '<div class="harian-list">' +
        s.suratHariIni.map(function (x) {
          return '<div class="harian-item">' +
            '<span class="harian-nomor">' + amanHtml(x.nomorSurat) + '</span>' +
            '<span class="harian-kode">' + amanHtml(kodeJenis(x.jenisSurat)) + '</span>' +
            '<span class="harian-teks">' + amanHtml(x.perihal || '-') +
            '<span class="harian-nama"> &mdash; ' + amanHtml(x.nama || '-') + '</span>' +
            '</span>' +
            '</div>';
        }).join('') +
        '</div>';
    } else {
      harian.innerHTML = '<p class="harian-kosong">Belum ada surat yang tercatat pada tanggal ini.</p>';
    }

    document.getElementById('slotPrev').disabled = (s.halaman <= 0);
    document.getElementById('slotNext').disabled = (s.halaman >= s.totalHalaman - 1);
    document.getElementById('slotHalaman').innerText =
      (s.dariNomor ? s.dariNomor + '–' + s.sampaiNomor + '  ·  ' : '') +
      'hal ' + (s.halaman + 1) + '/' + s.totalHalaman;

    if (!s.lanjutan.length) {
      chips.innerHTML = '';
      catatan.innerText = 'Semua nomor ' + s.jenis + ' sesudah ' + s.terakhirDipakai +
        ' sudah terpakai di tahun ' + s.tahun + '.';
    } else {
      chips.innerHTML = chipsHtml(s.lanjutan, '');
      catatan.innerText = (s.catatanLompat ? s.catatanLompat + ' ' : '') +
        'Klik salah satu untuk memasukkannya ke baris isian. ' +
        'Sisa ' + s.sisa + ' nomor ' + s.jenis + ' di tahun ' + s.tahun + '.';
    }

    if (s.terlewat && s.terlewat.length) {
      var lebih = (s.jumlahTerlewat > s.terlewat.length)
        ? ' Ditampilkan ' + s.terlewat.length + ' dari ' + s.jumlahTerlewat + ' nomor terlewat.'
        : '';
      terlewat.innerHTML =
        '<p class="slot-judul" style="margin-bottom:8px">Nomor terlewat yang belum terpakai</p>' +
        '<div class="slot-chips">' + chipsHtml(s.terlewat, ' terlewat') + '</div>' +
        '<p class="slot-catatan">Nomor-nomor ini posisinya di bawah ' + s.terakhirDipakai +
        ' tapi belum pernah dipakai, biasanya karena terlompati saat pencatatan.' + lebih + '</p>';
    } else {
      terlewat.innerHTML = '';
    }
  }

  function muatSlot(halaman, lompatKe) {
    var hal = (halaman === undefined || halaman === null) ? halamanSlotSekarang : halaman;
    var sp = new URLSearchParams();
    sp.set('tanggal', document.getElementById('inputTanggal').value || '');
    sp.set('jenis', jenisAktif());
    sp.set('halaman', String(hal));
    if (lompatKe) sp.set('lompatKe', String(lompatKe));

    panggil('/api/slot-nomor?' + sp.toString())
      .then(tampilkanSlot)
      .catch(function () {});
  }

  function halamanSlot(arah) {
    var tujuan = halamanSlotSekarang + arah;
    if (tujuan < 0) { tujuan = 0; }
    muatSlot(tujuan);
  }

  function lompatKeNomor() {
    var kotak = document.getElementById('slotLompat');
    var nilai = Number(kotak.value);
    if (!nilai) { kotak.focus(); return; }
    muatSlot(0, nilai);
  }

  function pilihDariSlot(nomor) {
    var jenis = document.getElementById('slotJenis').value;
    document.getElementById('inputJenis').value = jenis;
    ikutkanBuku(jenis);
    comboNomor.pilih(String(nomor));
    document.getElementById('pesanBaris').innerText = '';
    document.getElementById('inputAlamat').focus();
  }

  function gantiJenisSlot() {
    var jenis = document.getElementById('slotJenis').value;
    document.getElementById('inputJenis').value = jenis;
    ikutkanBuku(jenis);
    muatNomorTersedia();
  }

  function ikutkanBuku(jenis) {
    if (bukuAktif() !== 'SEMUA') {
      document.getElementById('filterJenis').value = jenis;
      filterRiwayat();
    }
  }

  function gantiJenisInput() {
    var jenis = document.getElementById('inputJenis').value;
    if (jenis) {
      document.getElementById('slotJenis').value = jenis;
      ikutkanBuku(jenis);
    }
    muatNomorTersedia();
  }

  function jenisAktif() {
    return document.getElementById('inputJenis').value ||
      document.getElementById('slotJenis').value ||
      (daftarJenis.length ? daftarJenis[0].nama : '');
  }

  /* ===========================================================
     MEMUAT DATA
     =========================================================== */
  function muatSemua() {
    panggil('/api/data-awal').then(function (d) {
      daftarJenis = d.jenisSurat;
      tahunSekarang = d.tahunSekarang;
      tahunAktif = d.tahunDipilih;

      isiDropdownJenis(document.getElementById('inputJenis'), true);
      isiDropdownJenis(document.getElementById('editJenis'), false);
      isiDropdownJenis(document.getElementById('slotJenis'), false);
      isiFilterJenis();
      document.getElementById('slotJenis').value = d.jenisAwal;
      document.getElementById('inputJenis').value = d.jenisAwal;
      isiFilterTahun(d.daftarTahun, d.tahunDipilih);

      pasangStatistik(d.statistik);

      semuaRiwayat = d.riwayat;
      filterRiwayat();

      comboNomor.isi(d.nomorTersedia, '',
        d.nomorTersedia.length + ' nomor sisa · ' + d.jenisAwal + ' ' + tahunNomor());

      tampilkanSlot(d.slotNomor);
    }).catch(function (e) {
      tampilkanPopupError(bersihkanPesan(e));
    });
  }

  function isiDropdownJenis(select, pakaiPlaceholder) {
    var html = pakaiPlaceholder ? '<option value="">-- Pilih --</option>' : '';
    html += daftarJenis.map(function (j) {
      return '<option value="' + j.nama + '">' + j.nama + ' (' + j.kode + ')</option>';
    }).join('');
    select.innerHTML = html;
  }

  function isiFilterTahun(daftar, terpilih) {
    var select = document.getElementById('filterTahun');
    var html = daftar.map(function (t) {
      var sel = (Number(t) === Number(terpilih)) ? ' selected' : '';
      return '<option value="' + t + '"' + sel + '>Tahun ' + t + '</option>';
    }).join('');
    html += '<option value="SEMUA">Semua Tahun</option>';
    select.innerHTML = html;
  }

  function isiFilterJenis() {
    var select = document.getElementById('filterJenis');
    select.innerHTML =
      '<option value="SEMUA">Semua jenis surat</option>' +
      daftarJenis.map(function (j) {
        return '<option value="' + j.nama + '">Buku ' + j.nama + '</option>';
      }).join('');
  }

  function bukuAktif() {
    return document.getElementById('filterJenis').value || 'SEMUA';
  }

  function gantiBuku() {
    var buku = bukuAktif();
    halamanArsipSekarang = 0;
    halamanBukuSekarang = 0;

    var satuBuku = (buku !== 'SEMUA');
    document.getElementById('cari').hidden = satuBuku;
    document.getElementById('btnUrutan').hidden = satuBuku;
    document.getElementById('btn7Hari').hidden = satuBuku;
    document.getElementById('btnMuatUlang').hidden = satuBuku;
    if (satuBuku) { document.getElementById('cari').value = ''; }

    if (satuBuku) {
      document.getElementById('slotJenis').value = buku;
      document.getElementById('inputJenis').value = buku;
      muatNomorTersedia();
    }

    filterRiwayat();
  }

  function perbaruiJudulBuku(keterangan) {
    var buku = bukuAktif();
    document.getElementById('judulBuku').innerText =
      (buku === 'SEMUA' ? 'Buku Agenda Surat Keluar' : 'Buku ' + buku) +
      '  ·  ' + keterangan;
  }

  function pasangStatistik(s) {
    document.getElementById('statHariIni').innerText = s.hariIni;
    document.getElementById('statMingguIni').innerText = s.mingguIni;
    document.getElementById('statBulanIni').innerText = s.bulanIni;
    document.getElementById('statTahunIni').innerText = s.tahunIni;
    document.getElementById('statTotalSemua').innerText = s.totalSemua;
    tampilkanPerJenis(s);
  }

  function tampilkanPerJenis(s) {
    var tempat = document.getElementById('isiPerJenis');
    var tahun = new Date().getFullYear();

    document.getElementById('judulPerJenis').innerText =
      'Rincian per jenis surat · tahun ' + tahun;

    if (!s.perJenis || !s.perJenis.length) {
      tempat.innerHTML = '<tr><td colspan="4" class="sel-kosong">Belum ada data.</td></tr>';
      return;
    }

    var baris = s.perJenis.map(function (j) {
      var kosong = (j.tahunIni === 0) ? ' baris-nol' : '';
      return '<tr class="' + kosong + '">' +
        '<td><span class="badge-jenis">' + amanHtml(j.kode) + '</span> ' +
        amanHtml(j.nama) + '</td>' +
        '<td class="angka">' + j.hariIni + '</td>' +
        '<td class="angka">' + j.tahunIni + '</td>' +
        '<td class="angka">' + (j.terakhirDipakai ? j.terakhirDipakai : '&ndash;') + '</td>' +
        '</tr>';
    }).join('');

    baris += '<tr class="baris-total">' +
      '<td>Total semua jenis</td>' +
      '<td class="angka">' + s.hariIni + '</td>' +
      '<td class="angka">' + s.tahunIni + '</td>' +
      '<td class="angka">&ndash;</td>' +
      '</tr>';

    tempat.innerHTML = baris;
  }

  function muatStatistik() {
    panggil('/api/statistik').then(pasangStatistik).catch(function () {});
  }

  function muatRiwayat() {
    document.getElementById('isiTabel').innerHTML =
      '<tr><td colspan="7" class="sel-kosong">Memuat...</td></tr>';

    panggil('/api/riwayat?tahun=' + encodeURIComponent(tahunAktif)).then(function (data) {
      semuaRiwayat = data;
      filterRiwayat();
    }).catch(function (e) {
      document.getElementById('isiTabel').innerHTML =
        '<tr><td colspan="7" class="sel-kosong">Gagal memuat: ' + bersihkanPesan(e) + '</td></tr>';
    });
  }

  function muatNomorTersedia() {
    var th = tahunNomor();
    var jn = jenisAktif();

    if (!jn) {
      comboNomor.isi([], '', 'Pilih jenis surat dulu.');
      return;
    }

    var sp = new URLSearchParams();
    sp.set('tahun', String(th));
    sp.set('jenis', jn);

    panggil('/api/nomor-tersedia?' + sp.toString()).then(function (daftar) {
      comboNomor.isi(daftar, '', daftar.length + ' nomor sisa · ' + jn + ' ' + th);
      muatSlot();
    }).catch(function () {});
  }

  function gantiTahun() {
    tahunAktif = document.getElementById('filterTahun').value;
    halamanBukuSekarang = 0;
    muatRiwayat();
  }

  function tampilkanMingguan() {
    document.getElementById('isiTabel').innerHTML =
      '<tr><td colspan="7" class="sel-kosong">Memuat...</td></tr>';

    panggil('/api/riwayat-mingguan').then(function (data) {
      semuaRiwayat = data;
      filterRiwayat();
    }).catch(function (e) {
      tampilkanPopupError(bersihkanPesan(e));
    });
  }

  /* ===========================================================
     ISI TABEL
     =========================================================== */
  function amanHtml(teks) {
    return String(teks === null || teks === undefined ? '' : teks)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function kodeJenis(nama) {
    for (var i = 0; i < daftarJenis.length; i++) {
      if (daftarJenis[i].nama === nama) { return daftarJenis[i].kode; }
    }
    return '-';
  }

  function tampilkanRiwayat(data) {
    var tempat = document.getElementById('isiTabel');

    if (!data || !data.length) {
      tempat.innerHTML = '<tr><td colspan="7" class="sel-kosong">Belum ada surat pada pilihan ini.</td></tr>';
      return;
    }

    tempat.innerHTML = data.map(function (p) {
      return '<tr>' +
        '<td class="col-nomor kolom-nomor-buku">' + amanHtml(p.nomorSurat) + '</td>' +
        '<td>' + amanHtml(p.alamatTanggal || '-') + '</td>' +
        '<td><span class="badge-jenis">' + amanHtml(kodeJenis(p.jenisSurat)) + '</span><br>' +
        amanHtml(p.jenisSurat) + '</td>' +
        '<td>' + amanHtml(p.nama || '-') + '</td>' +
        '<td class="sel-perihal">' + amanHtml(p.perihal || '-') + '</td>' +
        '<td>' + amanHtml(p.tanggalSimpan || '-') + '</td>' +
        '<td class="col-aksi">' +
        '<button type="button" class="btn-outline" onclick="bukaModalEdit(\'' + p.id + '\')">Ubah</button>' +
        '<button type="button" class="btn-tolak" onclick="hapusRiwayat(\'' + p.id + '\')">Hapus</button>' +
        '</td>' +
        '</tr>';
    }).join('');
  }

  function filterRiwayat() {
    var buku = bukuAktif();

    if (buku !== 'SEMUA') {
      muatHalamanBuku();
      return;
    }

    var kunci = document.getElementById('cari').value.toLowerCase();

    hasilTersaring = semuaRiwayat.filter(function (p) {
      if (buku !== 'SEMUA' && p.jenisSurat !== buku) { return false; }
      if (!kunci) { return true; }
      return (
        String(p.nomorSurat).toLowerCase().indexOf(kunci) >= 0 ||
        String(p.alamatTanggal).toLowerCase().indexOf(kunci) >= 0 ||
        String(p.jenisSurat).toLowerCase().indexOf(kunci) >= 0 ||
        String(p.nama).toLowerCase().indexOf(kunci) >= 0 ||
        String(p.perihal).toLowerCase().indexOf(kunci) >= 0
      );
    });

    urutkanArsip(hasilTersaring);
    halamanArsipSekarang = 0;
    perbaruiJudulBuku(hasilTersaring.length + ' surat');
    gambarHalamanArsip();
  }

  function urutkanArsip(daftar) {
    var satuBuku = (bukuAktif() !== 'SEMUA');

    daftar.sort(function (a, b) {
      var selisih = 0;
      if (a.tahun !== b.tahun) {
        selisih = a.tahun - b.tahun;
      } else if (satuBuku) {
        selisih = Number(a.nomorAngka) - Number(b.nomorAngka);
      } else if (a.tanggalInput !== b.tanggalInput) {
        selisih = (a.tanggalInput < b.tanggalInput) ? -1 : 1;
      } else {
        selisih = Number(a.nomorAngka) - Number(b.nomorAngka);
      }
      return urutanNaik ? selisih : -selisih;
    });
  }

  function balikUrutan() {
    urutanNaik = !urutanNaik;
    document.getElementById('btnUrutan').innerText =
      urutanNaik ? 'Nomor terkecil dulu' : 'Terbaru dulu';
    urutkanArsip(hasilTersaring);
    halamanArsipSekarang = 0;
    gambarHalamanArsip();
  }

  function halamanArsip(arah) {
    var total = totalHalamanArsip();
    halamanArsipSekarang += arah;
    if (halamanArsipSekarang < 0) { halamanArsipSekarang = 0; }
    if (halamanArsipSekarang > total - 1) { halamanArsipSekarang = total - 1; }
    gambarHalamanArsip();
  }

  function totalHalamanArsip() {
    return Math.max(1, Math.ceil(hasilTersaring.length / ARSIP_PER_HALAMAN));
  }

  function gambarHalamanArsip() {
    var total = totalHalamanArsip();
    if (halamanArsipSekarang > total - 1) { halamanArsipSekarang = total - 1; }

    var mulai = halamanArsipSekarang * ARSIP_PER_HALAMAN;
    var potongan = hasilTersaring.slice(mulai, mulai + ARSIP_PER_HALAMAN);

    tampilkanRiwayat(potongan);

    var nav = document.getElementById('arsipNav');
    if (hasilTersaring.length <= ARSIP_PER_HALAMAN) {
      nav.hidden = true;
      return;
    }

    nav.hidden = false;
    document.getElementById('arsipPrev').disabled = (halamanArsipSekarang <= 0);
    document.getElementById('arsipNext').disabled = (halamanArsipSekarang >= total - 1);
    document.getElementById('arsipInfo').innerText =
      'Halaman ' + (halamanArsipSekarang + 1) + ' dari ' + total +
      '  ·  surat ke-' + (mulai + 1) + ' sampai ' + (mulai + potongan.length) +
      ' dari ' + hasilTersaring.length;
    document.getElementById('arsipHalamanInput').placeholder = '1–' + total;
    document.getElementById('arsipHalamanInput').max = total;
  }

  /* ===========================================================
     HALAMAN BUKU
     =========================================================== */
  function muatHalamanBuku(halaman) {
    var jenis = bukuAktif();
    var hal = (halaman === undefined || halaman === null) ? halamanBukuSekarang : halaman;

    document.getElementById('isiTabel').innerHTML =
      '<tr><td colspan="7" class="sel-kosong">Memuat...</td></tr>';

    var sp = new URLSearchParams();
    sp.set('tahun', String(tahunAktif));
    sp.set('jenis', jenis);
    sp.set('halaman', String(hal));

    panggil('/api/halaman-buku?' + sp.toString()).then(tampilkanHalamanBuku).catch(function (e) {
      document.getElementById('isiTabel').innerHTML =
        '<tr><td colspan="7" class="sel-kosong">Gagal memuat: ' + bersihkanPesan(e) + '</td></tr>';
    });
  }

  function tampilkanHalamanBuku(hasil) {
    halamanBukuSekarang = hasil.halaman;
    var tahunIniJugaSekarang = (Number(hasil.tahun) === Number(tahunSekarang));

    document.getElementById('isiTabel').innerHTML = hasil.baris.map(function (p) {
      if (p.kosong) {
        var isi = tahunIniJugaSekarang
          ? '<a href="#" onclick="pilihDariSlot(' + p.nomorAngka + '); return false;">Isi nomor ini</a>'
          : 'Tidak dipakai';
        return '<tr class="baris-kosong-buku">' +
          '<td class="col-nomor kolom-nomor-buku">' + amanHtml(p.nomorSurat) + '</td>' +
          '<td colspan="5" class="sel-kosong-buku">Belum terpakai &middot; ' + isi + '</td>' +
          '<td class="col-aksi">&nbsp;</td>' +
          '</tr>';
      }
      return '<tr' + (p.hurufSisipan ? ' class="baris-sisipan"' : '') + '>' +
        '<td class="col-nomor kolom-nomor-buku">' + amanHtml(p.nomorSurat) + '</td>' +
        '<td>' + amanHtml(p.alamatTanggal || '-') + '</td>' +
        '<td><span class="badge-jenis">' + amanHtml(kodeJenis(p.jenisSurat)) + '</span><br>' +
        amanHtml(p.jenisSurat) + '</td>' +
        '<td>' + amanHtml(p.nama || '-') + '</td>' +
        '<td class="sel-perihal">' + amanHtml(p.perihal || '-') + '</td>' +
        '<td>' + amanHtml(p.tanggalSimpan || '-') + '</td>' +
        '<td class="col-aksi">' +
        '<button type="button" class="btn-outline" onclick="bukaModalEdit(\'' + p.id + '\')">Ubah</button>' +
        '<button type="button" class="btn-tolak" onclick="hapusRiwayat(\'' + p.id + '\')">Hapus</button>' +
        '<button type="button" class="btn-outline btn-sisipan" onclick="bukaModalSisipan(' + p.nomorAngka +
        ')" title="Tambah surat sisipan untuk nomor ' + p.nomorAngka + ' (mis. ' + p.nomorAngka + ' A)">+ Sisipan</button>' +
        '</td>' +
        '</tr>';
    }).join('');

    perbaruiJudulBuku(hasil.jumlahTerisi + ' dari ' + hasil.batas + ' nomor terisi  ·  tahun ' + hasil.tahun);

    var nav = document.getElementById('arsipNav');
    nav.hidden = false;
    document.getElementById('arsipPrev').disabled = (hasil.halaman <= 0);
    document.getElementById('arsipNext').disabled = (hasil.halaman >= hasil.totalHalaman - 1);
    document.getElementById('arsipInfo').innerText =
      'Nomor ' + hasil.dariNomor + '–' + hasil.sampaiNomor +
      '  ·  halaman ' + (hasil.halaman + 1) + ' dari ' + hasil.totalHalaman;
    document.getElementById('arsipHalamanInput').placeholder = '1–' + hasil.totalHalaman;
    document.getElementById('arsipHalamanInput').max = hasil.totalHalaman;
  }

  function panahArsip(arah) {
    if (bukuAktif() !== 'SEMUA') {
      var tujuan = halamanBukuSekarang + arah;
      if (tujuan < 0) { tujuan = 0; }
      muatHalamanBuku(tujuan);
    } else {
      halamanArsip(arah);
    }
  }

  function lompatHalamanArsip() {
    var input = document.getElementById('arsipHalamanInput');
    var tujuan = parseInt(input.value, 10);

    if (!tujuan || tujuan < 1) { input.focus(); return; }

    if (bukuAktif() !== 'SEMUA') {
      muatHalamanBuku(tujuan - 1);
    } else {
      var total = totalHalamanArsip();
      if (tujuan > total) { tujuan = total; }
      halamanArsipSekarang = tujuan - 1;
      gambarHalamanArsip();
    }

    input.value = '';
  }

  /* ===========================================================
     SIMPAN SURAT BARU
     =========================================================== */
  function simpanSuratBaru() {
    var d = {
      nomorSurat: comboNomor.ambil(),
      alamat: document.getElementById('inputAlamat').value.trim(),
      tanggalSurat: document.getElementById('inputTanggal').value,
      jenisSurat: document.getElementById('inputJenis').value,
      nama: document.getElementById('inputNama').value.trim(),
      perihal: document.getElementById('inputPerihal').value.trim()
    };

    var pesan = document.getElementById('pesanBaris');

    if (!d.nomorSurat || !d.alamat || !d.tanggalSurat ||
        !d.jenisSurat || !d.nama || !d.perihal) {
      pesan.innerText = 'Semua kolom di baris isian wajib diisi.';
      return;
    }

    pesan.innerText = 'Menyimpan...';

    panggilJson('/api/surat', 'POST', d).then(function () {
      pesan.innerText = '';
      kosongkanBarisInput();
      tampilkanPopupBerhasil('Surat nomor ' + d.nomorSurat + ' berhasil disimpan.');
      muatStatistik();
      muatRiwayat();
      muatNomorTersedia();
    }).catch(function (e) {
      pesan.innerText = '';
      tampilkanPopupError(bersihkanPesan(e));
    });
  }

  function kosongkanBarisInput() {
    document.getElementById('inputAlamat').value = '';
    document.getElementById('inputNama').value = '';
    document.getElementById('inputPerihal').value = '';
    document.getElementById('pesanBaris').innerText = '';
    comboNomor.isi(comboNomor.data, '',
      comboNomor.data.length + ' nomor sisa · ' + jenisAktif() + ' ' + tahunNomor());
    perbaruiPratinjau();
  }

  /* ===========================================================
     EDIT SURAT
     =========================================================== */
  function bukaModalEdit(id) {
    var d = null;
    for (var i = 0; i < semuaRiwayat.length; i++) {
      if (semuaRiwayat[i].id === id) { d = semuaRiwayat[i]; break; }
    }
    if (!d) { tampilkanPopupError('Data surat tidak ditemukan.'); return; }

    barisYangDiedit = id;
    tahunYangDiedit = d.tahun;

    document.getElementById('editAlamat').value = d.alamat;
    document.getElementById('editTanggal').value = d.tanggalInput;
    document.getElementById('editJenis').value = d.jenisSurat;
    document.getElementById('editNama').value = d.nama;
    document.getElementById('editPerihal').value = d.perihal;

    document.getElementById('infoNomorEdit').innerText = 'Memuat...';
    document.getElementById('modalEdit').classList.add('show');

    var sp = new URLSearchParams();
    sp.set('tahun', String(d.tahun));
    sp.set('jenis', d.jenisSurat);
    sp.set('kecualiId', id);

    panggil('/api/nomor-tersedia?' + sp.toString()).then(function (daftar) {
      comboNomorEdit.isi(daftar, d.nomorSurat,
        daftar.length + ' nomor tersedia · ' + d.jenisSurat + ' ' + d.tahun);
    }).catch(function (e) {
      document.getElementById('infoNomorEdit').innerText = bersihkanPesan(e);
    });
  }

  function tutupModalEdit() {
    document.getElementById('modalEdit').classList.remove('show');
    barisYangDiedit = null;
    tahunYangDiedit = null;
  }

  function gantiJenisEdit() {
    if (!barisYangDiedit) { return; }
    var jenis = document.getElementById('editJenis').value;
    document.getElementById('infoNomorEdit').innerText = 'Memuat...';

    var sp = new URLSearchParams();
    sp.set('tahun', String(tahunYangDiedit));
    sp.set('jenis', jenis);
    sp.set('kecualiId', barisYangDiedit);

    panggil('/api/nomor-tersedia?' + sp.toString()).then(function (daftar) {
      comboNomorEdit.isi(daftar, '',
        daftar.length + ' nomor tersedia · ' + jenis + ' ' + tahunYangDiedit);
    }).catch(function (e) {
      document.getElementById('infoNomorEdit').innerText = bersihkanPesan(e);
    });
  }

  function simpanEditSurat() {
    if (!barisYangDiedit) { return; }

    var d = {
      nomorSurat: comboNomorEdit.ambil(),
      alamat: document.getElementById('editAlamat').value.trim(),
      tanggalSurat: document.getElementById('editTanggal').value,
      jenisSurat: document.getElementById('editJenis').value,
      nama: document.getElementById('editNama').value.trim(),
      perihal: document.getElementById('editPerihal').value.trim()
    };

    if (!d.nomorSurat || !d.alamat || !d.tanggalSurat ||
        !d.jenisSurat || !d.nama || !d.perihal) {
      tampilkanPopupError('Semua kolom wajib diisi.');
      return;
    }

    var id = barisYangDiedit;

    panggilJson('/api/surat/' + encodeURIComponent(id), 'PUT', d).then(function () {
      tutupModalEdit();
      tampilkanPopupBerhasil('Data surat berhasil diubah.');
      muatStatistik();
      muatRiwayat();
      muatNomorTersedia();
    }).catch(function (e) {
      tampilkanPopupError(bersihkanPesan(e));
    });
  }

  /* ===========================================================
     SISIPAN
     =========================================================== */
  function tanggalHariIniIso() {
    var d = new Date();
    var bulan = String(d.getMonth() + 1);
    var tanggal = String(d.getDate());
    if (bulan.length === 1) { bulan = '0' + bulan; }
    if (tanggal.length === 1) { tanggal = '0' + tanggal; }
    return d.getFullYear() + '-' + bulan + '-' + tanggal;
  }

  function bukaModalSisipan(angkaDasar) {
    var jenis = bukuAktif();
    if (jenis === 'SEMUA') { return; }

    sisipanAngkaAktif = angkaDasar;
    sisipanHurufAktif = '';

    document.getElementById('sisipanInfo').innerText = 'Memuat...';
    document.getElementById('sisipanAlamat').value = '';
    document.getElementById('sisipanTanggal').value = tanggalHariIniIso();
    document.getElementById('sisipanNama').value = '';
    document.getElementById('sisipanPerihal').value = '';
    document.getElementById('btnSimpanSisipan').disabled = true;
    document.getElementById('modalSisipan').classList.add('show');

    var sp = new URLSearchParams();
    sp.set('tahun', String(tahunAktif));
    sp.set('jenis', jenis);
    sp.set('angka', String(angkaDasar));

    panggil('/api/huruf-berikutnya?' + sp.toString()).then(function (res) {
      var huruf = res.huruf;
      sisipanHurufAktif = huruf;
      document.getElementById('sisipanInfo').innerText =
        'Nomor ' + angkaDasar + ' ' + huruf + '  ·  ' + jenis + '  ·  tahun ' + tahunAktif;
      document.getElementById('btnSimpanSisipan').disabled = false;
    }).catch(function (e) {
      tutupModalSisipan();
      tampilkanPopupError(bersihkanPesan(e));
    });
  }

  function tutupModalSisipan() {
    document.getElementById('modalSisipan').classList.remove('show');
    sisipanAngkaAktif = null;
    sisipanHurufAktif = '';
  }

  function simpanSisipanBaru() {
    if (!sisipanAngkaAktif || !sisipanHurufAktif) { return; }

    var d = {
      nomorSurat: String(sisipanAngkaAktif) + sisipanHurufAktif,
      alamat: document.getElementById('sisipanAlamat').value.trim(),
      tanggalSurat: document.getElementById('sisipanTanggal').value,
      jenisSurat: bukuAktif(),
      nama: document.getElementById('sisipanNama').value.trim(),
      perihal: document.getElementById('sisipanPerihal').value.trim()
    };

    if (!d.alamat || !d.tanggalSurat || !d.nama || !d.perihal) {
      tampilkanPopupError('Semua kolom wajib diisi.');
      return;
    }

    document.getElementById('btnSimpanSisipan').disabled = true;

    panggilJson('/api/surat', 'POST', d).then(function () {
      tutupModalSisipan();
      tampilkanPopupBerhasil('Surat sisipan berhasil disimpan.');
      muatStatistik();
      muatRiwayat();
    }).catch(function (e) {
      document.getElementById('btnSimpanSisipan').disabled = false;
      tampilkanPopupError(bersihkanPesan(e));
    });
  }

  /* ===========================================================
     HAPUS SURAT
     =========================================================== */
  function hapusRiwayat(id) {
    barisYangAkanDihapus = id;
    document.getElementById('popupKonfirmasiHapus').classList.add('show');
  }

  function tutupKonfirmasiHapus() {
    document.getElementById('popupKonfirmasiHapus').classList.remove('show');
    barisYangAkanDihapus = null;
  }

  function konfirmasiHapus() {
    if (!barisYangAkanDihapus) { return; }
    var id = barisYangAkanDihapus;
    barisYangAkanDihapus = null;
    document.getElementById('popupKonfirmasiHapus').classList.remove('show');

    panggilJson('/api/surat/' + encodeURIComponent(id), 'DELETE').then(function () {
      tampilkanPopupBerhasil('Data surat berhasil dihapus.');
      muatStatistik();
      muatRiwayat();
      muatNomorTersedia();
    }).catch(function (e) {
      tampilkanPopupError(bersihkanPesan(e));
    });
  }

  /* ===========================================================
     MENU PROFIL (dropdown kecil berisi "Ganti Password", supaya
     tombolnya tidak langsung terlihat di topbar dashboard)
     =========================================================== */
  function toggleMenuProfil() {
    var dropdown = document.getElementById('profileDropdown');
    if (!dropdown) return;
    dropdown.hidden = !dropdown.hidden;
  }
  function tutupMenuProfil() {
    var dropdown = document.getElementById('profileDropdown');
    if (dropdown) dropdown.hidden = true;
  }
  function onDocumentClickProfil(e) {
    var area = document.getElementById('profileArea');
    if (area && !area.contains(e.target)) { tutupMenuProfil(); }
  }
  document.addEventListener('click', onDocumentClickProfil);

  /* ===========================================================
     GANTI PASSWORD
     =========================================================== */
  function bukaModalGantiPassword() {
    document.getElementById('gpPasswordLama').value = '';
    document.getElementById('gpPasswordBaru').value = '';
    document.getElementById('gpPasswordBaru2').value = '';
    document.getElementById('gantiPasswordPesan').innerText = '';
    document.getElementById('modalGantiPassword').classList.add('show');
  }

  function tutupModalGantiPassword() {
    document.getElementById('modalGantiPassword').classList.remove('show');
  }

  function simpanGantiPassword() {
    var lama = document.getElementById('gpPasswordLama').value;
    var baru = document.getElementById('gpPasswordBaru').value;
    var baru2 = document.getElementById('gpPasswordBaru2').value;
    var pesan = document.getElementById('gantiPasswordPesan');

    if (!lama || !baru || !baru2) {
      pesan.innerText = 'Semua kolom wajib diisi.';
      return;
    }
    if (baru !== baru2) {
      pesan.innerText = 'Password baru dan pengulangannya tidak sama.';
      return;
    }
    if (baru.length < 6) {
      pesan.innerText = 'Password baru minimal 6 karakter.';
      return;
    }

    pesan.innerText = 'Menyimpan...';
    document.getElementById('btnSimpanGantiPassword').disabled = true;

    panggilJson('/api/ganti-password', 'POST', { passwordLama: lama, passwordBaru: baru })
      .then(function () {
        document.getElementById('btnSimpanGantiPassword').disabled = false;
        tutupModalGantiPassword();
        tampilkanPopupBerhasil('Password berhasil diganti. Gunakan password baru di login berikutnya.');
      })
      .catch(function (e) {
        document.getElementById('btnSimpanGantiPassword').disabled = false;
        pesan.innerText = bersihkanPesan(e);
      });
  }

  /* ===========================================================
     POPUP & UTIL
     =========================================================== */
  function bersihkanPesan(e) {
    var pesan = (e && e.message) ? e.message : String(e);
    return pesan.replace(/^Error:\s*/, '');
  }

  function tampilkanPopupBerhasil(pesan) {
    document.getElementById('popupPesan').innerText = pesan;
    document.getElementById('popupBerhasil').classList.add('show');
  }
  function tutupPopupBerhasil() {
    document.getElementById('popupBerhasil').classList.remove('show');
  }
  function tampilkanPopupError(pesan) {
    document.getElementById('popupPesanError').innerText = pesan;
    document.getElementById('popupError').classList.add('show');
  }
  function tutupPopupError() {
    document.getElementById('popupError').classList.remove('show');
  }

  function bukaHalaman(nama) {
    var keStatistik = (nama === 'statistik');

    document.getElementById('halamanAgenda').hidden = keStatistik;
    document.getElementById('halamanStatistik').hidden = !keStatistik;

    document.getElementById('tabAgenda').classList.toggle('aktif', !keStatistik);
    document.getElementById('tabStatistik').classList.toggle('aktif', keStatistik);

    if (keStatistik) { muatStatistik(); }
    window.scrollTo(0, 0);
  }

  function keluar() {
    panggilJson('/api/logout', 'POST').then(function () {
      window.location.href = '/login';
    }).catch(function () {
      window.location.href = '/login';
    });
  }

  /* ===========================================================
     EKSPOS FUNGSI KE window - markup (lihat markup.js) memanggilnya
     lewat atribut onclick="..."/onchange="..." persis seperti versi
     Apps Script asli, yang secara alami membuat semua deklarasi
     function di top-level <script> menjadi properti window. Di sini
     dilakukan manual karena kodenya dibungkus modul ES.
     =========================================================== */
  function eksposKeWindow() {
    window.bukaHalaman = bukaHalaman;
    window.keluar = keluar;
    window.gantiBuku = gantiBuku;
    window.gantiTahun = gantiTahun;
    window.filterRiwayat = filterRiwayat;
    window.balikUrutan = balikUrutan;
    window.tampilkanMingguan = tampilkanMingguan;
    window.muatRiwayat = muatRiwayat;
    window.gantiJenisSlot = gantiJenisSlot;
    window.lompatKeNomor = lompatKeNomor;
    window.halamanSlot = halamanSlot;
    window.simpanSuratBaru = simpanSuratBaru;
    window.kosongkanBarisInput = kosongkanBarisInput;
    window.panahArsip = panahArsip;
    window.lompatHalamanArsip = lompatHalamanArsip;
    window.tutupModalEdit = tutupModalEdit;
    window.simpanEditSurat = simpanEditSurat;
    window.gantiJenisEdit = gantiJenisEdit;
    window.tutupModalSisipan = tutupModalSisipan;
    window.simpanSisipanBaru = simpanSisipanBaru;
    window.tutupPopupBerhasil = tutupPopupBerhasil;
    window.tutupKonfirmasiHapus = tutupKonfirmasiHapus;
    window.konfirmasiHapus = konfirmasiHapus;
    window.tutupPopupError = tutupPopupError;
    window.pilihDariSlot = pilihDariSlot;
    window.bukaModalEdit = bukaModalEdit;
    window.hapusRiwayat = hapusRiwayat;
    window.bukaModalSisipan = bukaModalSisipan;
    window.bukaModalGantiPassword = bukaModalGantiPassword;
    window.tutupModalGantiPassword = tutupModalGantiPassword;
    window.simpanGantiPassword = simpanGantiPassword;
    window.toggleMenuProfil = toggleMenuProfil;
    window.tutupMenuProfil = tutupMenuProfil;
  }

  var FUNGSI_DIEKSPOS = [
    'bukaHalaman', 'keluar', 'gantiBuku', 'gantiTahun', 'filterRiwayat',
    'balikUrutan', 'tampilkanMingguan', 'muatRiwayat', 'gantiJenisSlot',
    'lompatKeNomor', 'halamanSlot', 'simpanSuratBaru', 'kosongkanBarisInput',
    'panahArsip', 'lompatHalamanArsip', 'tutupModalEdit', 'simpanEditSurat',
    'gantiJenisEdit', 'tutupModalSisipan', 'simpanSisipanBaru',
    'tutupPopupBerhasil', 'tutupKonfirmasiHapus', 'konfirmasiHapus',
    'tutupPopupError', 'pilihDariSlot', 'bukaModalEdit', 'hapusRiwayat',
    'bukaModalSisipan', 'bukaModalGantiPassword', 'tutupModalGantiPassword',
    'simpanGantiPassword', 'toggleMenuProfil', 'tutupMenuProfil'
  ];
  eksposKeWindow();

  /* ===========================================================
     SAAT HALAMAN DIBUKA
     =========================================================== */
  comboNomor = new Combo('comboNomor', 'inputNomor', 'listNomor', 'infoNomor');
  comboNomorEdit = new Combo('comboNomorEdit', 'editNomor', 'listNomorEdit', 'infoNomorEdit');

  var hariIni = new Date();
  var bulanAwal = String(hariIni.getMonth() + 1);
  var tanggalAwal = String(hariIni.getDate());
  if (bulanAwal.length === 1) { bulanAwal = '0' + bulanAwal; }
  if (tanggalAwal.length === 1) { tanggalAwal = '0' + tanggalAwal; }
  document.getElementById('inputTanggal').value =
    hariIni.getFullYear() + '-' + bulanAwal + '-' + tanggalAwal;

  document.getElementById('inputTanggal').addEventListener('change', function () {
    muatNomorTersedia();
    perbaruiPratinjau();
  });
  document.getElementById('inputAlamat').addEventListener('input', perbaruiPratinjau);
  document.getElementById('inputJenis').addEventListener('change', gantiJenisInput);

  var slotLompatEl = document.getElementById('slotLompat');
  if (slotLompatEl) {
    slotLompatEl.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') { e.preventDefault(); lompatKeNomor(); }
    });
  }

  perbaruiPratinjau();
  muatSemua();

  /* Fungsi pembersih dipanggil dari useEffect cleanup saat komponen
     dibongkar (misal user pindah halaman), supaya tidak ada listener
     yang menumpuk (relevan di mode React StrictMode / navigasi SPA)
     dan supaya window tidak menyimpan fungsi dari komponen yang
     sudah tidak ada. */
  return function bersihkan() {
    if (comboNomor) comboNomor.hancurkan();
    if (comboNomorEdit) comboNomorEdit.hancurkan();
    document.removeEventListener('click', onDocumentClickProfil);
    FUNGSI_DIEKSPOS.forEach(function (nama) {
      try { delete window[nama]; } catch (e) { window[nama] = undefined; }
    });
  };
}
