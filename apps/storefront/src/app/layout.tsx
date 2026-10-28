import type { ReactNode } from 'react';

export const metadata = {
  title: 'ecom storefront',
  description: 'Multi-tenant shopper UX skeleton',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body style={{ margin: 0, fontFamily: 'Georgia, Times New Roman, serif' }}>{children}</body>
    </html>
  );
}
