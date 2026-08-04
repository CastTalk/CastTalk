'use client';
import Image from 'next/image';
import Link from 'next/link';
import { useUser } from '@clerk/nextjs';
import { UserCircle, SignOut, UserGear, VideoCamera } from '@phosphor-icons/react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useClerk } from '@clerk/nextjs';

const Header = () => {
  const { user } = useUser();
  const { signOut } = useClerk();

  return (
    <header className="flex items-center justify-between px-6 py-4 bg-white/80 backdrop-blur-md sticky top-0 z-50 border-b border-slate-100">
      {/* Logo */}
      <Link href="/" className="flex items-center gap-2 group">
        <div className="size-8 bg-primary rounded-lg flex-center shadow-sm group-hover:rotate-12 transition-transform duration-300">
          <VideoCamera weight="bold" size={18} className="text-white" />
        </div>
        <span className="text-xl font-bold tracking-tightest text-slate-900">CanTalk</span>
      </Link>

      {/* Profile */}
      {user && (
        <DropdownMenu>
          <DropdownMenuTrigger className="outline-none">
            <div className="flex items-center gap-3 p-1 pr-3 rounded-full border border-slate-100 hover:bg-slate-50 transition-colors cursor-pointer">
              <UserCircle
                size={32}
                weight="light"
                className="text-slate-600"
              />
              <span className="text-sm font-medium text-slate-700 hidden sm:inline-block">
                {user.firstName || 'Account'}
              </span>
            </div>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-64 p-2 rounded-2xl shadow-xl border-slate-100">
            <DropdownMenuLabel className="p-3">
              <div className="flex flex-col gap-1">
                <p className="text-sm font-semibold text-slate-900">{user.fullName || user.username || 'User'}</p>
                <p className="text-xs text-slate-500 font-normal truncate">{user.primaryEmailAddress?.emailAddress}</p>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator className="bg-slate-50" />
            <DropdownMenuItem
              onClick={() => window.location.href = '/profile'}
              className="flex items-center gap-2 p-2.5 rounded-xl cursor-pointer"
            >
              <UserGear size={18} weight="regular" />
              <span>Profile Settings</span>
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => signOut()}
              className="flex items-center gap-2 p-2.5 rounded-xl text-destructive focus:text-destructive cursor-pointer"
            >
              <SignOut size={18} weight="regular" />
              <span>Sign Out</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </header>
  );
};

export default Header;
