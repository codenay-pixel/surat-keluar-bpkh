import './globals.css';

export const metadata = {
  title: 'Sistem Manajemen Surat Keluar',
  description: 'BPKH Wilayah I'
};

export const viewport = {
  width: 'device-width',
  initialScale: 1
};

export default function RootLayout({ children }) {
  return (
    <html lang="id">
      <body>{children}</body>
    </html>
  );
}
