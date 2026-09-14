import { withErrorHandling } from '@/lib/apiHelper';
import { pastikanAdmin } from '@/lib/auth';
import { simpanSurat } from '@/lib/data';

export const POST = withErrorHandling(async (request) => {
  const session = await pastikanAdmin(request);
  const d = await request.json();
  await simpanSurat(d, session.email);
  return { ok: true };
});
