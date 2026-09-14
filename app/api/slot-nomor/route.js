import { withErrorHandling } from '@/lib/apiHelper';
import { pastikanAdmin } from '@/lib/auth';
import { getSlotNomor } from '@/lib/data';

export const GET = withErrorHandling(async (request) => {
  await pastikanAdmin(request);
  const sp = new URL(request.url).searchParams;
  return getSlotNomor(
    sp.get('tanggal'),
    sp.get('jenis'),
    Number(sp.get('halaman') || 0),
    sp.get('lompatKe') || null
  );
});
