import { withErrorHandling } from '@/lib/apiHelper';
import { pastikanAdmin, cocokkanPassword, buatHashPassword } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';

export const POST = withErrorHandling(async (request) => {
  const session = await pastikanAdmin(request);
  const { passwordLama, passwordBaru } = await request.json();

  if (!passwordLama || !passwordBaru) {
    const e = new Error('Password lama dan password baru wajib diisi.');
    e.status = 400;
    throw e;
  }
  if (String(passwordBaru).length < 6) {
    const e = new Error('Password baru minimal 6 karakter.');
    e.status = 400;
    throw e;
  }

  const sb = supabaseAdmin();
  const { data: user, error } = await sb.from('users').select('*').ilike('email', session.email).maybeSingle();
  if (error || !user) {
    const e = new Error('Akun tidak ditemukan.');
    e.status = 404;
    throw e;
  }

  const cocok = await cocokkanPassword(passwordLama, user.password_hash);
  if (!cocok) {
    const e = new Error('Password lama salah.');
    e.status = 401;
    throw e;
  }

  const hashBaru = await buatHashPassword(passwordBaru);
  const { error: errUpdate } = await sb
    .from('users')
    .update({ password_hash: hashBaru, wajib_ganti_password: false })
    .eq('id', user.id);
  if (errUpdate) throw new Error('Gagal menyimpan password baru: ' + errUpdate.message);

  return { ok: true };
});
