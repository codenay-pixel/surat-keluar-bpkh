import { NextResponse } from 'next/server';
import { namaCookieSesi } from '@/lib/auth';

export async function POST() {
  const res = NextResponse.json({ ok: true });
  res.cookies.set(namaCookieSesi(), '', { path: '/', maxAge: 0 });
  return res;
}
