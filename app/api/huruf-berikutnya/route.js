import { withErrorHandling } from '@/lib/apiHelper';
import { pastikanAdmin } from '@/lib/auth';
import { getHurufBerikutnya } from '@/lib/data';

export const GET = withErrorHandling(async (request) => {
  await pastikanAdmin(request);
  const sp = new URL(request.url).searchParams;
  const huruf = await getHurufBerikutnya(sp.get('tahun'), sp.get('jenis'), sp.get('angka'));
  return { huruf };
});
