'use client';
import Image from 'next/image';
import Link from 'next/link';
import { useUser } from '@clerk/nextjs';
import { CircleUserRound } from 'lucide-react';
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
    <header className="flex items-center justify-between px-4 py-2" style={{ backgroundColor: '#fcfcfc' }}>
      {/* Logo */}
      <Link href="/" className="flex items-center">
        <Image
          src="/logo/logoMain.svg"
          width={120}
          height={40}
          alt="logo"
        />
      </Link>

      {/* Profile */}
      {user && (
        <DropdownMenu>
          <DropdownMenuTrigger className="outline-none">
            <CircleUserRound 
              size={28} 
              strokeWidth={1.5}
              className="cursor-pointer hover:opacity-70 transition-opacity"
              style={{ color: 'var(--text)' }}
            />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel>
              <div>
                <p className="text-sm font-medium">{user.fullName || user.username || 'User'}</p>
                <p className="text-xs text-gray-500">{user.primaryEmailAddress?.emailAddress}</p>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => window.location.href = '/profile'}>
              Profile Settings
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => signOut()}>
              Sign Out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </header>
  );
};

export default Header;
