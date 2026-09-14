'use client';

import { useEffect } from 'react';
import { inisialisasiDashboard } from './dashboardLogic';
import { markupDashboard } from './markup';

export default function PapanKerja({ userName, userEmail }) {
  useEffect(() => {
    var bersihkan = inisialisasiDashboard();
    return bersihkan;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div
      suppressHydrationWarning
      dangerouslySetInnerHTML={{ __html: markupDashboard(userName, userEmail) }}
    />
  );
}
