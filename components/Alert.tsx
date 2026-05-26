import Link from 'next/link';
import { Info } from '@phosphor-icons/react';
import { NoiseTexture } from './ui/noise-texture';

interface PermissionCardProps {
  title: string;
  iconUrl?: string;
}

const Alert = ({ title, iconUrl }: PermissionCardProps) => {
  return (
    <section className="flex items-center justify-center min-h-screen w-full bg-[#FCFBFB] px-4 font-geist relative overflow-hidden select-none">
      <NoiseTexture className="opacity-[0.15]" />
      <div
        className="absolute inset-0 z-0 pointer-events-none opacity-50"
        style={{
          backgroundImage: `linear-gradient(to right, #c4cccc 1px, transparent 1px), linear-gradient(to bottom, #c4cccc 1px, transparent 1px)`,
          backgroundSize: '40px 40px',
        }}
      />
      
      <div 
        className="relative flex flex-col w-full max-w-[480px] overflow-hidden rounded-2xl bg-white border-2 border-[rgba(62,39,35,0.4)] shadow-2xl transition-all duration-300 z-10 p-8 pt-10"
      >
        <NoiseTexture className="opacity-[0.12]" />

        <div className="relative z-10 flex flex-col gap-6 items-center">
          {iconUrl ? (
            <div 
              className="size-16 flex items-center justify-center bg-[#3E2723]/5 border-2 border-[rgba(62,39,35,0.2)] rounded-2xl shadow-sm"
            >
              <img src={iconUrl} className="w-9 h-9 object-contain" alt="icon" />
            </div>
          ) : (
            <div 
              className="size-16 flex items-center justify-center bg-[#3E2723]/5 border-2 border-[rgba(62,39,35,0.2)] rounded-2xl shadow-sm text-[#3E2723]"
            >
              <Info size={32} className="text-[#3E2723]" weight="regular" />
            </div>
          )}

          <p className="text-center text-[15px] font-semibold leading-relaxed text-[#3E2723]/95 max-w-sm px-2">
            {title}
          </p>

          <Link href="/" className="w-full mt-2">
            <button 
              className="w-full h-12 bg-[#3E2723] hover:opacity-90 text-[#ffffff] text-[14px] font-bold rounded-xl transition-all shadow-md active:scale-[0.98]"
            >
              Back to Home
            </button>
          </Link>
        </div>
      </div>
    </section>
  );
};

export default Alert;
