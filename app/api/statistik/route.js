import { withErrorHandling } from '@/lib/apiHelper';
import { pastikanAdmin } from '@/lib/auth';
import { getStatistikSurat } from '@/lib/data';

export const GET = withErrorHandling(async (request) => {
  await pastikanAdmin(request);
  return getStatistikSurat();
});
