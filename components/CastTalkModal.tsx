'use client';

import { ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { NoiseTexture } from './ui/noise-texture';

interface CastTalkModalProps {
  isOpen: boolean;
  onClose: () => void;
  children: ReactNode;
  className?: string;
  contentClassName?: string;
  maxWidth?: string;
}

const CastTalkModal = ({
  isOpen,
  onClose,
  children,
  className,
  contentClassName,
  maxWidth = 'max-w-[495px]',
}: CastTalkModalProps) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-6 animate-fade-in">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/40 backdrop-blur-sm transition-opacity" 
        onClick={onClose} 
      />
      
      {/* Modal Container */}
      <div 
        className={cn(
          "relative flex flex-col w-full overflow-hidden rounded-2xl bg-white border-2 border-[rgba(62,39,35,0.4)] shadow-2xl transition-all duration-300 font-geist animate-slide-down text-slate-900",
          maxWidth,
          className
        )}
      >
        {/* Fine Noise Overlay for Premium Aesthetic */}
        <NoiseTexture className="opacity-[0.12]" />

        {/* Content Box */}
        <div className={cn("relative z-10 flex flex-col p-6 flex-1 mt-2", contentClassName)}>
          {children}
        </div>
      </div>
    </div>
  );
};

export default CastTalkModal;
