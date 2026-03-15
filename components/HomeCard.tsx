'use client';

import Image from 'next/image';

import { cn } from '@/lib/utils';

interface HomeCardProps {
  className?: string;
  img: string;
  title: string;
  description: string;
  cardNumber?: string;
  handleClick?: () => void;
}

const HomeCard = ({ className, img, title, description, cardNumber, handleClick }: HomeCardProps) => {
  return (
    <section
      className={cn(
        'px-6 py-8 flex flex-col justify-between w-full h-[220px] rounded-2xl cursor-pointer text-white shadow-lg transition-all duration-300 hover:brightness-110 relative overflow-hidden backdrop-blur-xl border border-white/10',
        className
      )}
      onClick={handleClick}
      style={{
        background: className?.includes('FF742E') 
          ? 'rgba(255, 116, 46, 0.9)' 
          : 'rgba(14, 120, 249, 0.9)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
      }}
    >
      {/* Subtle gradient overlay for depth */}
      <div className="absolute inset-0 bg-gradient-to-br from-white/10 to-transparent pointer-events-none" />
      
      {/* Pale Opacitated Numbering */}
      {cardNumber && (
        <div className="absolute -top-[30px] -right-[10px] text-[140px] font-extrabold text-white/10 select-none pointer-events-none z-0 leading-none tracking-tighter mix-blend-overlay">
          {cardNumber}
        </div>
      )}
      
      <div className="relative z-10 flex-center size-14 rounded-[16px] bg-black/5 backdrop-blur-md border border-white/5 shadow-[inset_0_2px_4px_rgba(0,0,0,0.1),0_1px_1px_rgba(255,255,255,0.1)] transition-all">
        <Image src={img} alt="meeting icon" width={28} height={28} className="opacity-90 contrast-[0.9] brightness-[1.1]" />
      </div>
      
      <div className="relative z-10 flex flex-col gap-1 mt-4">
        <h1 className="text-xl font-semibold tracking-wide drop-shadow-sm">{title}</h1>
        <p className="text-sm font-light text-white/95 drop-shadow-sm">{description}</p>
      </div>
    </section>
  );
};

export default HomeCard;
