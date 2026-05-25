'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { UserButton } from '@clerk/nextjs';
import { Gear } from '@phosphor-icons/react';

const AppNavbar = () => {
  const router = useRouter();
  const [time, setTime] = useState('');
  const [date, setDate] = useState('');

  useEffect(() => {
    const update = () => {
      const now = new Date();
      setTime(now.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true }));
      setDate(new Intl.DateTimeFormat('en-US', { weekday: 'short', month: 'short', day: 'numeric' }).format(now));
    };
    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="w-full relative z-40 flex justify-center border-b-2 border-dashed border-[#c4cccc] bg-[#f3f4f6]">
      <header className="flex w-full max-w-[1440px] flex-row justify-between items-center h-[54px] px-4 md:px-6 lg:px-8">
        <div className="flex items-center h-full cursor-pointer" onClick={() => router.push('/')}>
          <img src="/logo/logoMain.svg" alt="CastTalk" className="h-8 w-auto" />
        </div>

        <nav className="hidden md:flex absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 items-center gap-8 text-[15px] text-slate-800 font-medium">
          <button onClick={() => router.push('/upcoming')} className="hover:text-black transition-colors">Schedule</button>
          <button onClick={() => router.push('/upcoming')} className="hover:text-black transition-colors">Upcoming</button>
          <button onClick={() => router.push('/recordings')} className="hover:text-black transition-colors">Recordings</button>
          <button className="hover:text-black transition-colors">More</button>
        </nav>

        <div className="flex items-center gap-4 text-slate-800">
          <div className="hidden md:flex items-center text-[15px] font-medium gap-2 mr-4">
            <span>{time}</span><span>•</span><span>{date}</span>
          </div>
          <div className="flex items-center gap-4">
            <button className="hover:bg-black/5 rounded-full p-2 transition-colors" title="Settings">
              <Gear size={22} weight="regular" />
            </button>
            <div className="size-[34px] rounded-full overflow-hidden flex items-center justify-center border border-slate-300">
              <UserButton afterSignOutUrl="/sign-in" appearance={{ elements: { avatarBox: 'w-full h-full' } }} />
            </div>
          </div>
        </div>
      </header>
    </div>
  );
};

export default AppNavbar;
