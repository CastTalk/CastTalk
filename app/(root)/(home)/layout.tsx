import { Metadata } from 'next';
import { ReactNode } from 'react';

import Navbar from '@/components/Navbar';
import Sidebar from '@/components/Sidebar';
import Header from '@/components/Header';

export const metadata: Metadata = {
  title: 'Bloom.io',
  description: 'A workspace for your team, powered by Stream Chat and Clerk.',
};

const RootLayout = ({ children }: Readonly<{children: ReactNode}>) => {
  return (
    <main className="relative min-h-screen p-2 rounded-sm" style={{ backgroundColor: '#f2f2f2', border: '1px solid #e3e3e3' }}>
      {/* Header */}
      <div className="rounded-sm overflow-hidden mb-2" style={{ backgroundColor: '#fcfcfc', border: '1px solid #e3e3e3' }}>
        <Header />
      </div>

      {/* Main Layout with Sidebar and Content */}
      <div className="flex gap-2 h-[calc(100vh-60px)]">
        <div className="rounded-md overflow-hidden" style={{ backgroundColor: '#fcfcfc', border: '1px solid #e3e3e3' }}>
          <Sidebar />
        </div>
        
        <section className="flex flex-1 flex-col rounded-md overflow-hidden" style={{ backgroundColor: '#fcfcfc', border: '1px solid #e3e3e3' }}>
          <div className="w-full flex-1 px-8 py-6 max-md:px-4 max-md:py-4 overflow-auto">{children}</div>
        </section>
      </div>
    </main>
  );
};

export default RootLayout;
