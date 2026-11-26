'use client';

import { ReactNode } from 'react';
import { cn } from '@/lib/utils';

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
          "relative flex flex-col w-full overflow-hidden rounded-3xl bg-white border border-black/5 shadow-[0_30px_80px_-30px_rgba(154,52,18,0.45)] transition-all duration-300 font-geist animate-slide-down text-ink",
          maxWidth,
          className
        )}
      >

        {/* Content Box */}
        <div className={cn("relative z-10 flex flex-col p-6 flex-1 mt-2", contentClassName)}>
          {children}
        </div>
      </div>
    </div>
  );
};

export default CastTalkModal;
