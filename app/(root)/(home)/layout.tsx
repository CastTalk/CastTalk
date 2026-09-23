import { Metadata } from 'next';
import { ReactNode } from 'react';
import AppNavbar from '@/components/AppNavbar';

export const metadata: Metadata = {
  title: 'CanTalk | Premium Video Communications',
  description: 'Next-generation video collaboration platform for modern teams.',
};

const HomeLayout = ({ children }: Readonly<{ children: ReactNode }>) => {
  return (
    <div className="h-screen flex flex-col bg-[#f3f4f6] font-geist overflow-hidden">
      <div className="w-full h-[3px] bg-[#15803d] shrink-0" />
      <AppNavbar />

      <div className="flex-1 w-full flex justify-center overflow-hidden">
        <main className="relative w-full max-w-[1440px] flex flex-col flex-1 border-l-2 border-r-2 border-dashed border-[#15803d]/20 bg-[var(--theme-background)] overflow-hidden">
          {children}
        </main>
      </div>
    </div>
  );
};

export default HomeLayout;
