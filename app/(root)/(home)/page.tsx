'use client';

import MeetingTypeList from '@/components/MeetingTypeList';
import { Search, ArrowUpRight } from 'lucide-react';
import { UserButton } from '@clerk/nextjs';
import { useState, useEffect } from 'react';
import { useGetCalls } from '@/hooks/useGetCalls';
import Link from 'next/link';
import Loader from '@/components/Loader';

const Home = () => {
  const [time, setTime] = useState('');
  const [date, setDate] = useState('');
  const { upcomingCalls, isLoading } = useGetCalls();

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setTime(now.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true }));
      setDate((new Intl.DateTimeFormat('en-US', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })).format(now));
    };

    updateTime();
    const interval = setInterval(updateTime, 1000);

    return () => clearInterval(interval);
  }, []);

  const getTimeUntilMeeting = (startsAt: Date) => {
    const now = new Date();
    const diff = startsAt.getTime() - now.getTime();
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    
    if (hours > 24) {
      const days = Math.floor(hours / 24);
      return `starts in ${days} day${days > 1 ? 's' : ''}`;
    } else if (hours > 0) {
      return `starts in ${hours} hour${hours > 1 ? 's' : ''}`;
    } else if (minutes > 0) {
      return `starts in ${minutes} minute${minutes > 1 ? 's' : ''}`;
    }
    return 'starting soon';
  };

  return (
    <section className="flex size-full flex-col gap-6">
      
      {/* Top Header Row inside Main Content */}
      <div className="flex-between w-full">
        <h1 className="text-2xl font-bold text-gray-800">Home</h1>
        
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 rounded-full bg-white px-4 py-2 shadow-sm border border-gray-100 min-w-[300px]">
            <Search size={18} className="text-gray-400" />
            <input 
              type="text" 
              placeholder="Search by keywords" 
              className="bg-transparent text-sm w-full outline-none placeholder:text-gray-400 text-gray-800"
            />
          </div>
          <div className="flex-center size-10 rounded-full bg-orange-1">
             <UserButton afterSignOutUrl="/sign-in" />
          </div>
        </div>
      </div>

      {/* Main Grid Content */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 h-full">
        
        {/* Left Column: Actions */}
        <div className="lg:col-span-7 flex flex-col gap-6">
          <MeetingTypeList />
        </div>

        {/* Right Column: Time & Meetings list */}
        <div className="lg:col-span-5 flex flex-col gap-6">
          {/* Time Hero Block */}
          <div 
            className="h-[200px] w-full rounded-2xl flex flex-col justify-end p-6 text-white relative overflow-hidden shadow-lg border border-white/10"
            style={{
              background: 'rgba(74, 94, 107, 0.75)',
              backdropFilter: 'blur(20px)',
              WebkitBackdropFilter: 'blur(20px)',
            }}
          >
             {/* Subtle gradient overlay for depth */}
             <div className="absolute inset-0 bg-gradient-to-br from-white/10 to-transparent pointer-events-none"></div>
             {/* Decorative gradient */}
             <div className="absolute right-0 top-0 h-full w-1/2 bg-gradient-to-l from-emerald-500/20 to-transparent"></div>
             
             <div className="relative z-10">
               <h1 className="text-5xl font-semibold mb-2 drop-shadow-lg">{time}</h1>
               <p className="text-sm font-light text-white/90 drop-shadow-sm">{date}</p>
             </div>
          </div>

          {/* Upcoming Meetings Container */}
          <div className="flex-1 rounded-2xl border-2 border-gray-300 p-6 flex flex-col gap-4">
            <h2 className="text-lg font-semibold text-gray-800">Upcoming Meetings</h2>
            
            {isLoading ? (
              <div className="flex-center py-8">
                <Loader />
              </div>
            ) : upcomingCalls && upcomingCalls.length > 0 ? (
              <div className="flex flex-col gap-3">
                {upcomingCalls.slice(0, 3).map((call) => {
                  const startsAt = new Date(call.state.startsAt!);
                  const startTime = startsAt.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: false });
                  const endTime = new Date(startsAt.getTime() + 60 * 60 * 1000).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: false });
                  
                  return (
                    <Link 
                      href="/upcoming" 
                      key={call.id}
                      className="p-4 rounded-lg border border-gray-300 flex items-center justify-between hover:border-gray-400 hover:bg-gray-50 transition-all"
                    >
                      <div className="flex flex-col gap-1">
                        <h3 className="text-sm font-semibold text-gray-800">{call.state.custom.description || 'Meeting'}</h3>
                        <p className="text-xs text-gray-500">
                          {startTime} - {endTime} <span className="mx-2">|</span> {getTimeUntilMeeting(startsAt)}
                        </p>
                      </div>
                      <ArrowUpRight size={20} className="text-gray-400 hover:text-blue-1 transition-colors" />
                    </Link>
                  );
                })}
              </div>
            ) : (
              <div className="flex-center py-12">
                <p className="text-sm text-gray-400">No upcoming meetings</p>
              </div>
            )}
          </div>
        </div>

      </div>

    </section>
  );
};

export default Home;
