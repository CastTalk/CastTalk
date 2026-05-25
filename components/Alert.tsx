import Link from 'next/link';
import Image from 'next/image';

import { Button } from './ui/button';
import { Card, CardContent } from './ui/card';
import { Info } from '@phosphor-icons/react';
import { NoiseTexture } from './ui/noise-texture';

interface PermissionCardProps {
  title: string;
  iconUrl?: string;
}

const Alert = ({ title, iconUrl }: PermissionCardProps) => {
  return (
    <section className="flex-center h-screen w-full bg-[#f8fafc] px-4">
      <Card 
        className="w-full max-w-[480px] border border-black/10 bg-[#ecedef] text-slate-900 rounded-sm shadow-[inset_0_1px_0_#ffffff,_0_1px_3px_rgba(0,0,0,0.02),_0_24px_50px_-12px_rgba(0,0,0,0.06)] relative overflow-hidden"
        style={{ borderWidth: '0.8px' }}
      >
        <NoiseTexture className="opacity-[0.12]" />
        
        {/* Top Accent Bar */}
        <div className="absolute top-0 left-0 right-0 h-[3px] bg-gradient-to-r from-primary via-[#3b82f6] to-primary z-30" />

        <CardContent className="p-8 pt-10 relative z-10">
          <div className="flex flex-col gap-6 items-center">
            {iconUrl ? (
              <div 
                className="size-14 flex-center bg-white border border-slate-300 rounded-none shadow-sm"
                style={{ borderWidth: '0.8px' }}
              >
                <img src={iconUrl} className="w-8 h-8 object-contain" alt="icon" />
              </div>
            ) : (
              <div 
                className="size-14 flex-center bg-white border border-slate-300 rounded-none shadow-sm text-slate-800"
                style={{ borderWidth: '0.8px' }}
              >
                <Info size={28} className="text-slate-800" weight="regular" />
              </div>
            )}

            <p className="text-center text-[15px] font-normal leading-relaxed text-slate-700 max-w-sm px-2">
              {title}
            </p>

            <Button 
              asChild 
              className="w-full h-11 border border-black bg-black hover:bg-primary hover:border-primary text-white text-xs font-bold uppercase tracking-wider transition-all duration-300 rounded-none"
              style={{ borderWidth: '0.8px' }}
            >
              <Link href="/">Back to Home</Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </section>
  );
};

export default Alert;
