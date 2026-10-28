import type { ReactNode } from 'react';

export const metadata = {
  title: 'ecom admin',
  description: 'Merchant admin skeleton',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          fontFamily: 'IBM Plex Sans, Segoe UI, sans-serif',
          background: 'linear-gradient(180deg, #f7f5f2 0%, #e8e4dc 100%)',
          color: '#1c1917',
          minHeight: '100vh',
        }}
      >
        {children}
      </body>
    </html>
  );
}
