import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title:       'The Daily Digest',
  description: 'Your local news aggregator',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-newsprint">
        {children}
      </body>
    </html>
  );
}
