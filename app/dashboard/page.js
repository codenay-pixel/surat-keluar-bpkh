import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import { bacaSessionToken, namaCookieSesi } from '@/lib/auth';
import PapanKerja from './PapanKerja';

export const metadata = { title: 'Sistem Manajemen Surat Keluar' };

export default async function HalamanDashboard() {
  const jar = await cookies();
  const token = jar.get(namaCookieSesi())?.value;
  const session = await bacaSessionToken(token);

  if (!session) {
    redirect('/login');
  }

  return <PapanKerja userName={session.nama} userEmail={session.email} />;
}
