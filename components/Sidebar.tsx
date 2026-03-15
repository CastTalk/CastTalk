'use client';
import Image from 'next/image';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, Calendar, CalendarClock, Video, Plus, Settings } from 'lucide-react';
import { UserButton, useUser, SignedIn } from '@clerk/nextjs';

import { cn } from '@/lib/utils';

const sidebarLinks = [
  {
    label: 'Home',
    route: '/',
    icon: Home,
  },
  {
    label: 'Upcoming',
    route: '/upcoming',
    icon: Calendar,
  },
  {
    label: 'Previous',
    route: '/previous',
    icon: CalendarClock,
  },
  {
    label: 'Recordings',
    route: '/recordings',
    icon: Video,
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
    <section className="flex h-screen w-[80px] flex-col justify-between border-r border-gray-200 bg-white p-4 max-sm:hidden shrink-0">
      
      <div className="flex flex-col items-center gap-8">
        {/* Logo / Brand Icon */}
        <Link href="/" className="flex-center">
          <Image 
            src="/logo/Main.svg" 
            alt="CastTalk" 
            width={40} 
            height={40}
            className="object-contain"
          />
        </Link>
        
        {/* Navigation Links */}
        <div className="flex flex-col gap-4 w-full items-center">
          {sidebarLinks.map((item) => {
            const isActive = pathname === item.route || pathname.startsWith(`${item.route}/`);
            const Icon = item.icon;
            
            return (
              <Link
                href={item.route}
                key={item.label}
                title={item.label}
                className={cn(
                  "flex-center size-[46px] rounded-2xl transition-all duration-200",
                  isActive ? "bg-blue-1/10 text-blue-1" : "text-gray-500 hover:bg-gray-100 hover:text-gray-900"
                )}
              >
                <Icon 
                  size={22} 
                  strokeWidth={isActive ? 2.5 : 2} 
                  className={isActive ? "text-blue-1" : "currentColor"}
                />
              </Link>
            );
          })}
        </div>
      </div>

      <div className="flex flex-col items-center gap-4">
        <button className="flex-center size-[46px] rounded-2xl text-gray-500 hover:bg-gray-100 hover:text-gray-900 transition-all duration-200" title="Settings">
          <Settings size={22} strokeWidth={2} />
        </button>
      </div>

    </section>
  );
};

export default Sidebar;
