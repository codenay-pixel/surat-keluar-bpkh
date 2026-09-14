import { withErrorHandling } from '@/lib/apiHelper';
import { pastikanAdmin } from '@/lib/auth';
import { getDataAwal } from '@/lib/data';

export const GET = withErrorHandling(async (request) => {
  await pastikanAdmin(request);
  const tahun = new URL(request.url).searchParams.get('tahun');
  return getDataAwal(tahun ? Number(tahun) : null);
});
