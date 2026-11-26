import { Metadata } from 'next';
import { ReactNode } from 'react';
import AppNavbar from '@/components/AppNavbar';

export const metadata: Metadata = {
  title: 'CastTalk | Premium Video Communications',
  description: 'Next-generation video collaboration platform for modern teams.',
};

const HomeLayout = ({ children }: Readonly<{ children: ReactNode }>) => {
  return (
    <div className="flex h-screen flex-col overflow-hidden bg-white font-geist text-ink">
      <AppNavbar />

      <div className="flex w-full flex-1 justify-center overflow-hidden">
        <main className="relative flex w-full flex-1 flex-col overflow-hidden bg-white">
          {children}
        </main>
      </div>
    </div>
  );
};

export default HomeLayout;
