import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { cocokkanPassword, buatSessionToken, namaCookieSesi, opsiCookieSesi } from '@/lib/auth';

export async function POST(request) {
  const body = await request.json().catch(() => ({}));
  const email = String(body.email || '').trim().toLowerCase();
  const password = String(body.password || '');

  if (!email || !password) {
    return NextResponse.json({ error: 'Email dan password wajib diisi.' }, { status: 400 });
  }

  const sb = supabaseAdmin();
  const { data: user, error } = await sb
    .from('users')
    .select('*')
    .ilike('email', email)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: 'Gagal memeriksa akun: ' + error.message }, { status: 500 });
  }
  if (!user) {
    return NextResponse.json({ error: 'Email atau password salah.' }, { status: 401 });
  }

  const cocok = await cocokkanPassword(password, user.password_hash);
  if (!cocok) {
    return NextResponse.json({ error: 'Email atau password salah.' }, { status: 401 });
  }
  if (String(user.role).trim().toLowerCase() !== 'admin') {
    return NextResponse.json({ error: 'Akun ini tidak punya akses admin.' }, { status: 403 });
  }

  const token = await buatSessionToken({ email: user.email, nama: user.nama, role: user.role });

  const res = NextResponse.json({
    ok: true,
    nama: user.nama,
    email: user.email,
    wajibGantiPassword: !!user.wajib_ganti_password
  });
  res.cookies.set(namaCookieSesi(), token, opsiCookieSesi());
  return res;
}
