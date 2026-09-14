import { withErrorHandling } from '@/lib/apiHelper';
import { pastikanAdmin } from '@/lib/auth';
import { getNomorTersedia } from '@/lib/data';

export const GET = withErrorHandling(async (request) => {
  await pastikanAdmin(request);
  const sp = new URL(request.url).searchParams;
  return getNomorTersedia(sp.get('tahun'), sp.get('jenis'), sp.get('kecualiId') || null);
});
