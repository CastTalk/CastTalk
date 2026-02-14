'use client';
import Image from 'next/image';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, Calendar, CalendarClock, Video, Plus } from 'lucide-react';
import { useUser } from '@clerk/nextjs';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useClerk } from '@clerk/nextjs';

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
    <section className="flex h-screen w-fit flex-col p-3 pt-3 max-sm:hidden" style={{ backgroundColor: '#fcfcfc', color: 'var(--text)', width: '200px' }}>
      <div className="flex flex-col gap-2">
        {/* Navigation Links */}
        <div className="flex flex-1 flex-col gap-2">
          {sidebarLinks.map((item) => {
            const isActive = pathname === item.route || pathname.startsWith(`${item.route}/`);
            const Icon = item.icon;
            
            return (
              <Link
                href={item.route}
                key={item.label}
                className="flex gap-3 items-center px-2 py-1.5 rounded-md justify-start transition-all"
                style={isActive ? { 
                  backgroundColor: 'var(--primary)',
                  color: 'white',
                  fontFamily: 'Geist, sans-serif',
                  fontWeight: '600'
                } : { 
                  color: 'var(--text)',
                  fontFamily: 'Geist, sans-serif',
                  backgroundColor: 'transparent',
                  fontWeight: '400'
                }}
                onMouseEnter={(e) => {
                  if (!isActive) {
                    e.currentTarget.style.backgroundColor = 'rgba(0, 0, 0, 0.05)';
                  }
                }}
                onMouseLeave={(e) => {
                  if (!isActive) {
                    e.currentTarget.style.backgroundColor = 'transparent';
                  }
                }}
              >
                <div style={{
                  backgroundColor: isActive ? 'rgba(255, 255, 255, 0.2)' : 'transparent',
                  borderRadius: '4px',
                  padding: '2px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}>
                  <Icon 
                    size={18} 
                    strokeWidth={isActive ? 2.5 : 2} 
                    style={{ 
                      color: isActive ? 'white' : 'currentColor',
                      fill: 'none'
                    }} 
                  />
                </div>
                <p className="text-xs font-normal">
                  {item.label}
                </p>
              </Link>
            );
          })}
        </div>
      </div>
    </section>
  );
};

export default Sidebar;
