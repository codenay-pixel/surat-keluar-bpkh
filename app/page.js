import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import { bacaSessionToken, namaCookieSesi } from '@/lib/auth';

export default async function Beranda() {
  const jar = await cookies();
  const token = jar.get(namaCookieSesi())?.value;
  const session = await bacaSessionToken(token);

  redirect(session ? '/dashboard' : '/login');
}
