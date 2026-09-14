import bcrypt from 'bcryptjs';
import { SignJWT, jwtVerify } from 'jose';

const SESSION_COOKIE = 'sesi_surat';
const SESSION_TTL_DETIK = 21600; // 6 jam, sama seperti CacheService di versi lama

function kunciRahasia() {
  const rahasia = process.env.SESSION_SECRET;
  if (!rahasia || rahasia.length < 16) {
    throw new Error(
      'SESSION_SECRET belum diatur (minimal 16 karakter acak). ' +
      'Lihat PANDUAN-PEMASANGAN.md bagian "Environment variables".'
    );
  }
  return new TextEncoder().encode(rahasia);
}

/* =============== PASSWORD =============== */

export async function buatHashPassword(passwordPolos) {
  return bcrypt.hash(String(passwordPolos), 10);
}

export async function cocokkanPassword(passwordDiketik, hashTersimpan) {
  if (!hashTersimpan) return false;
  try {
    return await bcrypt.compare(String(passwordDiketik), String(hashTersimpan));
  } catch {
    return false;
  }
}

/* =============== SESSION (token JWT, disimpan di cookie httpOnly) =============== */

export async function buatSessionToken(user) {
  const sekarang = Math.floor(Date.now() / 1000);
  return new SignJWT({
    email: user.email,
    nama: user.nama,
    role: user.role
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt(sekarang)
    .setExpirationTime(sekarang + SESSION_TTL_DETIK)
    .sign(kunciRahasia());
}

export async function bacaSessionToken(token) {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, kunciRahasia());
    return { email: payload.email, nama: payload.nama, role: payload.role };
  } catch {
    return null;
  }
}

export function namaCookieSesi() {
  return SESSION_COOKIE;
}

export function opsiCookieSesi() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: SESSION_TTL_DETIK
  };
}

/**
 * Dipakai di setiap API route yang menyentuh data - lemparan Error
 * di sini otomatis jadi respons 401 lewat helper di lib/apiHelper.js.
 */
export async function pastikanAdmin(request) {
  const token = request.cookies.get(SESSION_COOKIE)?.value;
  const session = await bacaSessionToken(token);
  if (!session) {
    const e = new Error('Sesi sudah habis. Silakan masuk ulang.');
    e.status = 401;
    throw e;
  }
  if (String(session.role).trim().toLowerCase() !== 'admin') {
    const e = new Error('Akses ditolak.');
    e.status = 403;
    throw e;
  }
  return session;
}
