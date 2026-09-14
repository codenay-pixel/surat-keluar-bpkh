import { withErrorHandling } from '@/lib/apiHelper';
import { pastikanAdmin } from '@/lib/auth';
import { getHalamanBuku } from '@/lib/data';

export const GET = withErrorHandling(async (request) => {
  await pastikanAdmin(request);
  const sp = new URL(request.url).searchParams;
  return getHalamanBuku(sp.get('tahun'), sp.get('jenis'), Number(sp.get('halaman') || 0));
});
