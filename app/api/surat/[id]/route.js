import { withErrorHandling } from '@/lib/apiHelper';
import { pastikanAdmin } from '@/lib/auth';
import { editDataSurat, hapusSuratKeluar } from '@/lib/data';

export const PUT = withErrorHandling(async (request, { params }) => {
  await pastikanAdmin(request);
  const { id } = await params;
  const d = await request.json();
  await editDataSurat(id, d);
  return { ok: true };
});

export const DELETE = withErrorHandling(async (request, { params }) => {
  await pastikanAdmin(request);
  const { id } = await params;
  await hapusSuratKeluar(id);
  return { ok: true };
});
