import type { Metadata } from 'next';
import './globals.css';
import Navbar from '@/components/Navbar';

export const metadata: Metadata = {
  title: 'free-re | Real-Time 1v1 Competitive Coding',
  description: 'Head-to-head live 1v1 coding battle arena with CRDT sync, hidden test validation, and ELO ranking.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="bg-dark-900 text-zinc-100 antialiased selection:bg-brand-500 selection:text-black">
        <div className="flex flex-col min-h-screen">
          <Navbar />
          <main className="flex-1">{children}</main>
        </div>
      </body>
    </html>
  );
}
