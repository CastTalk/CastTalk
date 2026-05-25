import { IconProps } from '@phosphor-icons/react';
import { cn } from '@/lib/utils';
import { ElementType } from 'react';

interface HomeCardProps {
  className?: string;
  icon: ElementType<IconProps>;
  title: string;
  description: string;
  handleClick?: () => void;
  iconColor?: string;
}

const HomeCard = ({ className, icon: Icon, title, description, handleClick, iconColor = "text-primary" }: HomeCardProps) => {
  return (
    <div
      className={cn(
        'p-8 flex flex-col justify-between w-full h-[240px] rounded-[32px] cursor-pointer bg-white border border-slate-100 shadow-sm transition-all duration-500 hover:shadow-xl hover:shadow-slate-200/60 hover:-translate-y-1 relative group overflow-hidden',
        className
      )}
      onClick={handleClick}
    >
      {/* Decorative hover effect */}
      <div className="absolute -bottom-20 -right-20 size-40 bg-slate-50 rounded-full group-hover:scale-150 transition-transform duration-700 pointer-events-none" />
      
      <div className={cn(
        "relative z-10 size-14 rounded-2xl flex-center transition-all duration-500 shadow-sm border border-slate-100 group-hover:scale-110 group-hover:rotate-6 bg-white",
        iconColor
      )}>
        <Icon weight="bold" size={28} />
      </div>
      
      <div className="relative z-10 flex flex-col gap-1.5">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">{title}</h1>
        <p className="text-sm font-semibold text-slate-400 group-hover:text-slate-600 transition-colors">{description}</p>
      </div>
      
      {/* Subtle bottom arrow that appears on hover */}
      <div className="absolute bottom-8 right-8 text-slate-200 group-hover:text-primary group-hover:translate-x-1 transition-all duration-300">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg>
      </div>
    </div>
  );
};

export default HomeCard;
