import { createClient } from '@supabase/supabase-js';

/**
 * Client sisi server, pakai SERVICE ROLE KEY supaya bisa baca/tulis
 * penuh ke tabel - sama seperti Apps Script yang dulu punya akses
 * penuh ke spreadsheet. Semua pengecekan hak akses (login admin)
 * tetap dilakukan di lib/auth.js + setiap API route, BUKAN oleh
 * Row Level Security - jadi kunci ini TIDAK BOLEH pernah dikirim
 * ke browser. Hanya dipakai di file-file app/api/.../route.js.
 */
let _client = null;

export function supabaseAdmin() {
  if (_client) return _client;

  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    throw new Error(
      'SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY belum diatur. ' +
      'Lihat PANDUAN-PEMASANGAN.md bagian "Environment variables".'
    );
  }

  _client = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false }
  });
  return _client;
}
