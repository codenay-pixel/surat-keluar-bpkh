import { NextResponse } from 'next/server';

/**
 * Membungkus handler API route: kalau handler melempar Error, otomatis
 * diubah jadi respons JSON { error: pesan } dengan status yang sesuai -
 * meniru cara withFailureHandler() menangkap Error di google.script.run
 * pada versi Apps Script.
 */
export function withErrorHandling(handler) {
  return async (request, ctx) => {
    try {
      const hasil = await handler(request, ctx);
      if (hasil instanceof NextResponse) return hasil;
      return NextResponse.json(hasil ?? {});
    } catch (e) {
      const status = e.status || 500;
      return NextResponse.json({ error: e.message || String(e) }, { status });
    }
  };
}
