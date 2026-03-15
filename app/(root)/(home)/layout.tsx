import { Metadata } from 'next';
import { ReactNode } from 'react';

import Sidebar from '@/components/Sidebar';
import Header from '@/components/Header'; // We might pull this into the main content or keep it top right
import { GridPattern } from '@/components/ui/grid-pattern';
import { cn } from '@/lib/utils';

export const metadata: Metadata = {
  title: 'Bloom.io',
  description: 'A workspace for your team, powered by Stream Chat and Clerk.',
};

const RootLayout = ({ children }: Readonly<{children: ReactNode}>) => {
  return (
    <main className="relative min-h-screen bg-[#F8F9FA] text-[#151414] font-body flex overflow-hidden">
      
      {/* --- Background Effects --- */}
      {/* 1. Grid Pattern */}
      <GridPattern
        width={40}
        height={40}
        x={-1}
        y={-1}
        className={cn(
          "[mask-image:linear-gradient(to_bottom_right,white,transparent,transparent)]",
          "absolute inset-0 z-0 opacity-80"
        )}
      />
      
      {/* 2. Hard Blue Blob (Bottom Left) */}
      <div className="absolute -bottom-[20%] -left-[10%] z-0 h-[600px] w-[600px] rounded-full bg-[#0E78F9]/20 blur-[100px] pointer-events-none" />

      {/* 3. Soft Warm Blur (Diagonal Center) */}
      <div className="absolute top-[20%] left-[30%] z-0 h-[400px] w-[800px] rotate-[-45deg] rounded-full bg-[#FF742E]/10 blur-[120px] pointer-events-none" />
      {/* ------------------------- */}

      {/* Sidebar with higher z-index to sit above background */}
      <div className="relative z-10 shrink-0">
        <Sidebar />
      </div>

      {/* Main Content Area */}
      <div className="relative z-10 flex flex-1 flex-col overflow-hidden">
        {/* We can place the Header/TopBar here as part of the main page column if needed, or inside the children */}
        <section className="flex flex-1 flex-col overflow-hidden">
          <div className="w-full h-full flex-1 px-8 py-6 max-md:px-4 max-md:py-4 overflow-auto">
            {children}
          </div>
        </section>
      </div>
    </main>
  );
};

export default RootLayout;
