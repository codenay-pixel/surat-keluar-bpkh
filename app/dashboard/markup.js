/*****************************************************************
 * MARKUP DASHBOARD - dipindahkan dari AdminDashboard.html.
 * Dirender lewat dangerouslySetInnerHTML supaya struktur & atribut
 * onclick="..." di dalamnya persis sama dengan versi Apps Script asli
 * (fungsi-fungsi itu dipasang ke window oleh dashboardLogic.js).
 *****************************************************************/

function amanHtml(teks) {
  return String(teks === null || teks === undefined ? '' : teks)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function markupDashboard(userName, userEmail) {
  const nama = amanHtml(userName || '');
  const email = amanHtml(userEmail || '');
  const inisial = amanHtml((userName ? userName.charAt(0).toUpperCase() : 'A'));

  return `
<div class="topbar">
  <div class="topbar-left">
    <img
      src="/logo-bpkh.jpg"
      alt="Logo BPKH"
      class="logo-bpkh">
    <div class="topbar-title">
      <h1>Sistem Manajemen Surat Keluar</h1>
      <p class="subtitle">BPKH Wilayah I</p>
    </div>
  </div>

  <div class="topbar-meta">
    <div class="profile-area" id="profileArea">
      <div class="profile-chip" onclick="toggleMenuProfil()">
        <div class="avatar">${inisial}</div>
        <div class="profile-info">
          <div class="profile-name">
            ${nama}
            <span class="role-badge">ADMIN</span>
          </div>
          <div class="profile-email">${email}</div>
        </div>
      </div>
      <div class="profile-dropdown" id="profileDropdown" hidden>
        <button type="button" class="profile-dropdown-item" onclick="tutupMenuProfil();bukaModalGantiPassword();">Ganti Password</button>
      </div>
    </div>
    <button type="button" class="btn-logout" onclick="keluar()">Keluar</button>
  </div>
</div>

<div class="page">

  <div class="tab-bar">
    <button type="button" class="tab-btn aktif" id="tabAgenda"
            onclick="bukaHalaman('agenda')">Buku Agenda</button>
    <button type="button" class="tab-btn" id="tabStatistik"
            onclick="bukaHalaman('statistik')">Statistik</button>
  </div>

  <div id="halamanStatistik" hidden>
  <div class="card">
    <h2>Ringkasan Surat</h2>
    <p class="hint">
      Hari ini, bulan ini, dan tahun ini dihitung ulang otomatis &mdash;
      angka kembali ke 0 setiap 1 Januari. Total Semua Surat tidak pernah direset.
    </p>
    <div class="stat-grid">
      <div class="stat-box">
        <span class="stat-label">Hari Ini</span>
        <span class="stat-number" id="statHariIni">0</span>
      </div>
      <div class="stat-box">
        <span class="stat-label">Minggu Ini</span>
        <span class="stat-number" id="statMingguIni">0</span>
      </div>
      <div class="stat-box">
        <span class="stat-label">Bulan Ini</span>
        <span class="stat-number" id="statBulanIni">0</span>
      </div>
      <div class="stat-box">
        <span class="stat-label">Tahun Ini</span>
        <span class="stat-number" id="statTahunIni">0</span>
      </div>
      <div class="stat-box utama">
        <span class="stat-label">Total Semua Surat</span>
        <span class="stat-number" id="statTotalSemua">0</span>
      </div>
    </div>

    <p class="slot-subjudul" id="judulPerJenis">Rincian per jenis surat</p>
    <div class="table-wrap">
      <table class="data tabel-jenis">
        <thead>
          <tr>
            <th>Jenis Surat</th>
            <th class="angka">Hari Ini</th>
            <th class="angka">Tahun Ini</th>
            <th class="angka">Nomor Terakhir</th>
          </tr>
        </thead>
        <tbody id="isiPerJenis">
          <tr><td colspan="4" class="sel-kosong">Memuat...</td></tr>
        </tbody>
      </table>
    </div>
  </div>
  </div>

  <div id="halamanAgenda">
  <div class="card buku-spread">
    <h2 id="judulBuku">Buku Agenda Surat Keluar</h2>

    <div class="filter-row">
      <select id="filterJenis" onchange="gantiBuku()"></select>
      <select id="filterTahun" onchange="gantiTahun()"></select>
      <input
        type="text"
        id="cari"
        placeholder="Cari nomor, alamat, jenis surat, nama pengaju, atau perihal..."
        oninput="filterRiwayat()">
      <button type="button" class="btn-outline" id="btnUrutan" onclick="balikUrutan()">Nomor terkecil dulu</button>
      <button type="button" class="btn-outline" id="btn7Hari" onclick="tampilkanMingguan()">7 Hari Terakhir</button>
      <button type="button" class="btn-outline" id="btnMuatUlang" onclick="muatRiwayat()">Muat Ulang</button>
    </div>

    <div class="slot-panel">
      <div class="slot-header">
        <p class="slot-judul" id="slotJudul">Memuat nomor kosong...</p>
        <div class="slot-nav">
          <select id="slotJenis" class="slot-jenis" onchange="gantiJenisSlot()"></select>
          <input type="number" id="slotLompat" class="slot-lompat"
                 placeholder="ke nomor" min="1" max="2000">
          <button type="button" class="btn-outline slot-btn-lompat"
                  onclick="lompatKeNomor()">Lompat</button>
          <button type="button" id="slotPrev" class="slot-panah" title="Halaman sebelumnya"
                  onclick="halamanSlot(-1)">&#8249;</button>
          <span class="slot-halaman" id="slotHalaman">&nbsp;</span>
          <button type="button" id="slotNext" class="slot-panah" title="Halaman berikutnya"
                  onclick="halamanSlot(1)">&#8250;</button>
        </div>
      </div>
      <div id="slotHarian"></div>
      <p class="slot-subjudul" id="slotSubjudul">Nomor kosong berikutnya</p>
      <div class="slot-chips" id="slotChips"></div>
      <p class="slot-catatan" id="slotCatatan"></p>
      <div class="slot-terlewat" id="slotTerlewat"></div>
    </div>

    <p id="pesanBaris"></p>

    <div class="table-wrap">
      <table class="data buku-tabel">
        <colgroup>
          <col class="col-nomor-w">
          <col class="col-alamat-w">
          <col class="col-jenis-w">
          <col class="col-nama-w">
          <col class="col-perihal-w">
          <col class="col-simpan-w">
          <col class="col-aksi-w">
        </colgroup>

        <thead>
          <tr>
            <th class="kolom-nomor-buku">Nomor Surat</th>
            <th>Alamat dan Tanggal Surat</th>
            <th>Jenis Surat</th>
            <th>Nama Pengaju</th>
            <th>Perihal</th>
            <th>Tanggal Simpan</th>
            <th>Aksi</th>
          </tr>
        </thead>

        <tbody>
          <tr class="baris-input">
            <td>
              <div class="combo" id="comboNomor">
                <input
                  type="text"
                  id="inputNomor"
                  placeholder="Pilih nomor"
                  autocomplete="off">
                <div class="combo-list" id="listNomor"></div>
              </div>
              <div class="keterangan-sel" id="infoNomor">Memuat...</div>
            </td>

            <td>
              <input type="text" id="inputAlamat" placeholder="Contoh: Medan">
              <input type="date" id="inputTanggal" class="isian-tanggal">
              <div class="keterangan-sel" id="pratinjauAlamatTanggal"></div>
            </td>

            <td>
              <select id="inputJenis">
                <option value="">-- Pilih --</option>
              </select>
            </td>

            <td>
              <input type="text" id="inputNama" placeholder="Nama pengaju">
            </td>

            <td>
              <textarea id="inputPerihal" rows="3" placeholder="Isi ringkas surat"></textarea>
            </td>

            <td class="sel-kosong">otomatis</td>

            <td>
              <button type="button" class="btn-simpan-baris" onclick="simpanSuratBaru()">Simpan</button>
              <button type="button" class="btn-outline btn-bersih-baris" onclick="kosongkanBarisInput()">Bersihkan</button>
            </td>
          </tr>
        </tbody>

        <tbody id="isiTabel">
          <tr><td colspan="7" class="sel-kosong">Memuat...</td></tr>
        </tbody>
      </table>
    </div>

    <div class="arsip-nav" id="arsipNav" hidden>
      <button type="button" class="slot-panah" id="arsipPrev"
              title="Halaman sebelumnya" onclick="panahArsip(-1)">&#8249;</button>
      <span class="arsip-info" id="arsipInfo"></span>
      <input
        type="number"
        id="arsipHalamanInput"
        class="slot-lompat"
        min="1"
        placeholder="ke halaman"
        onkeydown="if(event.key==='Enter'){lompatHalamanArsip();}">
      <button type="button" class="btn-outline slot-btn-lompat" onclick="lompatHalamanArsip()">Buka</button>
      <button type="button" class="slot-panah" id="arsipNext"
              title="Halaman berikutnya" onclick="panahArsip(1)">&#8250;</button>
    </div>
  </div>
  </div>

</div>

<div id="modalEdit" class="modal-overlay">
  <div class="modal-box">
    <div class="modal-header">
      <h3>Ubah Data Surat</h3>
      <button type="button" class="modal-close" onclick="tutupModalEdit()">&times;</button>
    </div>
    <div class="modal-body">
      <table class="form-table" style="margin-top:0">
        <tbody>
          <tr>
            <th>Nomor Surat</th>
            <td>
              <div class="combo" id="comboNomorEdit">
                <input type="text" id="editNomor" autocomplete="off" placeholder="Pilih nomor">
                <div class="combo-list" id="listNomorEdit"></div>
              </div>
              <div class="keterangan-sel" id="infoNomorEdit"></div>
            </td>
          </tr>
          <tr>
            <th>Alamat</th>
            <td><input type="text" id="editAlamat"></td>
          </tr>
          <tr>
            <th>Tanggal Surat</th>
            <td><input type="date" id="editTanggal"></td>
          </tr>
          <tr>
            <th>Jenis Surat</th>
            <td><select id="editJenis" onchange="gantiJenisEdit()"></select></td>
          </tr>
          <tr>
            <th>Nama Pengaju</th>
            <td><input type="text" id="editNama"></td>
          </tr>
          <tr>
            <th>Perihal</th>
            <td><textarea id="editPerihal" rows="3"></textarea></td>
          </tr>
        </tbody>
      </table>
    </div>
    <div class="modal-footer">
      <button type="button" class="btn-outline" onclick="tutupModalEdit()">Batal</button>
      <button type="button" onclick="simpanEditSurat()">Simpan Perubahan</button>
    </div>
  </div>
</div>

<div id="modalSisipan" class="modal-overlay">
  <div class="modal-box">
    <div class="modal-header">
      <h3>Tambah Surat Sisipan</h3>
      <button type="button" class="modal-close" onclick="tutupModalSisipan()">&times;</button>
    </div>
    <div class="modal-body">
      <p class="hint" id="sisipanInfo">Memuat...</p>
      <table class="form-table" style="margin-top:0">
        <tbody>
          <tr>
            <th>Alamat</th>
            <td><input type="text" id="sisipanAlamat" placeholder="Contoh: Medan"></td>
          </tr>
          <tr>
            <th>Tanggal Surat</th>
            <td><input type="date" id="sisipanTanggal"></td>
          </tr>
          <tr>
            <th>Nama Pengaju</th>
            <td><input type="text" id="sisipanNama"></td>
          </tr>
          <tr>
            <th>Perihal</th>
            <td><textarea id="sisipanPerihal" rows="3"></textarea></td>
          </tr>
        </tbody>
      </table>
    </div>
    <div class="modal-footer">
      <button type="button" class="btn-outline" onclick="tutupModalSisipan()">Batal</button>
      <button type="button" id="btnSimpanSisipan" onclick="simpanSisipanBaru()">Simpan Sisipan</button>
    </div>
  </div>
</div>

<div id="modalGantiPassword" class="modal-overlay">
  <div class="modal-box">
    <div class="modal-header">
      <h3>Ganti Password</h3>
      <button type="button" class="modal-close" onclick="tutupModalGantiPassword()">&times;</button>
    </div>
    <div class="modal-body">
      <p class="hint" id="gantiPasswordPesan"></p>
      <table class="form-table" style="margin-top:0">
        <tbody>
          <tr>
            <th>Password Lama</th>
            <td><input type="password" id="gpPasswordLama" autocomplete="current-password"></td>
          </tr>
          <tr>
            <th>Password Baru</th>
            <td><input type="password" id="gpPasswordBaru" autocomplete="new-password" placeholder="Minimal 6 karakter"></td>
          </tr>
          <tr>
            <th>Ulangi Password Baru</th>
            <td><input type="password" id="gpPasswordBaru2" autocomplete="new-password"></td>
          </tr>
        </tbody>
      </table>
    </div>
    <div class="modal-footer">
      <button type="button" class="btn-outline" onclick="tutupModalGantiPassword()">Batal</button>
      <button type="button" id="btnSimpanGantiPassword" onclick="simpanGantiPassword()">Simpan Password Baru</button>
    </div>
  </div>
</div>

<div id="popupBerhasil" class="popup-overlay">
  <div class="popup-box">
    <div class="popup-icon">&#10003;</div>
    <h3>Berhasil</h3>
    <p id="popupPesan"></p>
    <div class="popup-actions">
      <button type="button" onclick="tutupPopupBerhasil()">OK</button>
    </div>
  </div>
</div>

<div id="popupKonfirmasiHapus" class="popup-overlay">
  <div class="popup-box">
    <div class="popup-icon-hapus">!</div>
    <h3>Yakin ingin menghapus?</h3>
    <p>Data surat yang dihapus tidak dapat dikembalikan.</p>
    <div class="popup-actions">
      <button type="button" class="popup-batal" onclick="tutupKonfirmasiHapus()">Batal</button>
      <button type="button" class="popup-hapus" onclick="konfirmasiHapus()">Hapus</button>
    </div>
  </div>
</div>

<div id="popupError" class="popup-overlay">
  <div class="popup-box">
    <div class="popup-icon-error">!</div>
    <h3>Gagal</h3>
    <p id="popupPesanError"></p>
    <div class="popup-actions">
      <button type="button" class="popup-error-ok" onclick="tutupPopupError()">OK</button>
    </div>
  </div>
</div>
`;
}
