'use client';
import Image from 'next/image';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { House, Calendar, CalendarCheck, VideoCamera, Plus, Gear } from '@phosphor-icons/react';
import { UserButton, useUser, SignedIn } from '@clerk/nextjs';

import { cn } from '@/lib/utils';

const sidebarLinks = [
  {
    label: 'Home',
    route: '/',
    icon: House,
  },
  {
    label: 'Upcoming',
    route: '/upcoming',
    icon: Calendar,
  },
  {
    label: 'Previous',
    route: '/previous',
    icon: CalendarCheck,
  },
  {
    label: 'Recordings',
    route: '/recordings',
    icon: VideoCamera,
  },
  {
    label: 'Personal Room',
    route: '/personal-room',
    icon: Plus,
  },
];

const Sidebar = () => {
  const pathname = usePathname();

  return (
    <section className="flex h-screen w-[80px] flex-col justify-between border-r border-slate-100 bg-white p-4 max-sm:hidden shrink-0 shadow-[1px_0_0_0_rgba(0,0,0,0.02)]">
      
      <div className="flex flex-col items-center gap-10">
        {/* Logo / Brand Icon */}
        <Link href="/" className="flex-center group">
          <div className="size-[44px] flex-center bg-primary rounded-[14px] shadow-lg shadow-primary/20 group-hover:scale-105 transition-transform duration-300">
             <VideoCamera weight="bold" size={24} className="text-white" />
          </div>
        </Link>
        
        {/* Navigation Links */}
        <div className="flex flex-col gap-5 w-full items-center">
          {sidebarLinks.map((item) => {
            const isActive = pathname === item.route || pathname.startsWith(`${item.route}/`);
            const Icon = item.icon;
            
            return (
              <Link
                href={item.route}
                key={item.label}
                title={item.label}
                className={cn(
                  "flex-center size-[48px] rounded-[16px] transition-all duration-300 relative group",
                  isActive 
                    ? "bg-primary/5 text-primary" 
                    : "text-slate-400 hover:bg-slate-50 hover:text-slate-900"
                )}
              >
                <Icon 
                  size={24} 
                  weight={isActive ? "bold" : "regular"}
                  className="transition-transform group-hover:scale-110"
                />
                {isActive && (
                  <div className="absolute -left-4 w-1 h-6 bg-primary rounded-r-full" />
                )}
              </Link>
            );
          })}
        </div>
      </div>

      <div className="flex flex-col items-center gap-4">
        <button className="flex-center size-[48px] rounded-[16px] text-slate-400 hover:bg-slate-50 hover:text-slate-900 transition-all duration-300 group" title="Settings">
          <Gear size={24} weight="regular" className="group-hover:rotate-45 transition-transform duration-500" />
        </button>
      </div>

    </section>
  );
};

export default Sidebar;
