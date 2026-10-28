import type { ReactNode } from 'react';

export const metadata = {
  title: 'ecom platform',
  description: 'Platform ops skeleton',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body style={{ margin: 0, fontFamily: 'ui-sans-serif, system-ui', background: '#111', color: '#eee' }}>
        {children}
      </body>
    </html>
  );
}
