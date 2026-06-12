'use client';

import { useState, useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { UserButton, useUser } from '@clerk/nextjs';
import { Bell, X, Calendar, Brain, Clock } from '@phosphor-icons/react';
import { Client } from 'appwrite';

const appwriteClient = new Client()
  .setEndpoint(process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT || 'https://syd.cloud.appwrite.io/v1')
  .setProject(process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID || '6a27f0d9002671523088');

interface NotificationItem {
  id: string;
  text: string;
  read: boolean;
  type: string;
  createdAt: string;
  time: string; // Dynamic formatted label (e.g. "Just now")
}

const AppNavbar = () => {
  const router = useRouter();
  const pathname = usePathname();
  const { user } = useUser();
  const [time, setTime] = useState('');
  const [date, setDate] = useState('');
  const [showNotifications, setShowNotifications] = useState(false);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);

  const formatRelativeTime = (isoString: string) => {
    try {
      const date = new Date(isoString);
      const now = new Date();
      const diffSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);
      
      if (diffSeconds < 60) return 'Just now';
      
      const diffMinutes = Math.floor(diffSeconds / 60);
      if (diffMinutes < 60) return `${diffMinutes}m ago`;
      
      const diffHours = Math.floor(diffMinutes / 60);
      if (diffHours < 24) return `${diffHours}h ago`;
      
      const diffDays = Math.floor(diffHours / 24);
      return `${diffDays}d ago`;
    } catch (e) {
      return 'Just now';
    }
  };

  // Clock updates
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

  // Dropdown close trigger
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (!document.body.contains(target)) return;
      if (!target.closest('.notification-container')) {
        setShowNotifications(false);
      }
    };
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, []);

  // Fetch initial notifications and subscribe to Appwrite Realtime
  useEffect(() => {
    if (!user?.id) return;

    const fetchNotifications = async () => {
      try {
        const res = await fetch('/api/notifications');
        if (res.ok) {
          const data = await res.json();
          const formatted = (data.notifications || []).map((n: any) => ({
            ...n,
            time: formatRelativeTime(n.createdAt)
          }));
          setNotifications(formatted);
        }
      } catch (err) {
        console.error('[AppNavbar] Error fetching notifications:', err);
      }
    };

    fetchNotifications();

    // Appwrite Realtime listener
    const unsubscribe = appwriteClient.subscribe(
      'databases.castdb.collections.notifications.documents',
      (response) => {
        const doc = response.payload as any;
        if (doc.userId !== user.id) return;

        if (response.events.some(e => e.includes('create'))) {
          const formatted: NotificationItem = {
            id: doc.$id,
            text: doc.text,
            read: doc.read,
            type: doc.type,
            createdAt: doc.createdAt,
            time: formatRelativeTime(doc.createdAt)
          };
          setNotifications(prev => [formatted, ...prev]);
        } else if (response.events.some(e => e.includes('update'))) {
          setNotifications(prev => prev.map(n => n.id === doc.$id ? { ...n, read: doc.read } : n));
        } else if (response.events.some(e => e.includes('delete'))) {
          setNotifications(prev => prev.filter(n => n.id !== doc.$id));
        }
      }
    );

    return () => unsubscribe();
  }, [user?.id]);

  const markAllRead = async () => {
    try {
      await fetch('/api/notifications', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ markAll: true })
      });
      setNotifications(prev => prev.map(n => ({ ...n, read: true })));
    } catch (e) {
      console.error(e);
    }
  };

  const markRead = async (id: string) => {
    try {
      await fetch('/api/notifications', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: [id] })
      });
      setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
    } catch (e) {
      console.error(e);
    }
  };

  const deleteNotification = async (id: string) => {
    try {
      await fetch(`/api/notifications?id=${id}`, {
        method: 'DELETE'
      });
      setNotifications(prev => prev.filter(n => n.id !== id));
    } catch (e) {
      console.error(e);
    }
  };

  const getNotifIcon = (type: string) => {
    switch (type) {
      case 'success':
        return <Calendar size={16} weight="fill" className="text-emerald-600" />;
      case 'ai':
        return <Brain size={16} weight="fill" className="text-violet-600" />;
      case 'alert':
        return <Clock size={16} weight="fill" className="text-amber-600" />;
      case 'update':
        return <Calendar size={16} weight="fill" className="text-blue-600" />;
      default:
        return <Bell size={16} weight="fill" className="text-slate-600" />;
    }
  };

  const getNotifBg = (type: string) => {
    switch (type) {
      case 'success': return 'bg-emerald-50 border-emerald-100';
      case 'ai': return 'bg-violet-50 border-violet-100';
      case 'alert': return 'bg-amber-50 border-amber-100';
      case 'update': return 'bg-blue-50 border-blue-100';
      default: return 'bg-slate-50 border-slate-100';
    }
  };

  return (
    <div className="w-full relative z-40 flex justify-center border-b-2 border-dashed border-[#c4cccc] bg-[#f3f4f6]">
      <header className="flex w-full max-w-[1440px] flex-row justify-between items-center h-[54px] px-4 md:px-6 lg:px-8">
        <div className="flex items-center h-full cursor-pointer" onClick={() => router.push('/')}>
          <img src="/logo/logoMain.svg" alt="CastTalk" className="h-8 w-auto" />
        </div>

        <nav className="hidden md:flex absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 items-center gap-8 text-[15px] text-slate-800 font-medium">
          <button 
            onClick={() => router.push('/')} 
            className={pathname === '/' ? 'text-black font-semibold' : 'hover:text-black transition-colors'}
          >
            Home
          </button>
          <button 
            onClick={() => router.push('/upcoming')} 
            className={pathname === '/upcoming' ? 'text-black font-semibold' : 'hover:text-black transition-colors'}
          >
            Schedule
          </button>
          <button 
            disabled 
            className="text-slate-400 cursor-not-allowed opacity-50 select-none" 
            title="Under development"
          >
            Recordings
          </button>
          <button 
            onClick={() => router.push('/cast-ai')} 
            className={pathname === '/cast-ai' ? 'text-black font-semibold' : 'hover:text-black transition-colors'}
          >
            CastAI
          </button>
        </nav>

        <div className="flex items-center gap-4 text-slate-800">
          <div className="hidden md:flex items-center text-[15px] font-medium gap-2 mr-4">
            <span>{time}</span><span>•</span><span>{date}</span>
          </div>
          <div className="flex items-center gap-4">
            <div className="notification-container relative flex items-center">
              <button 
                onClick={() => setShowNotifications(!showNotifications)} 
                className={`relative rounded-full p-2 transition-colors ${showNotifications ? 'bg-black/5 text-black' : 'hover:bg-black/5 text-slate-800'}`}
                title="Notifications"
              >
                <Bell size={22} weight="regular" />
                {notifications.some(n => !n.read) && (
                  <span className="absolute top-1.5 right-1.5 size-2 rounded-full bg-rose-500 ring-2 ring-white animate-pulse" />
                )}
              </button>

              {showNotifications && (
                <div className="absolute right-0 top-[42px] w-[360px] bg-white/95 backdrop-blur-md text-slate-800 rounded-2xl shadow-xl border border-slate-200/80 z-50 animate-slide-down overflow-hidden">
                  <div className="flex items-center justify-between p-4 border-b border-slate-100">
                    <div className="flex items-center gap-2">
                      <Bell size={18} weight="fill" className="text-amber-500" />
                      <span className="font-bold text-[15px] text-slate-900">Notifications</span>
                    </div>
                    <div className="flex items-center gap-2">
                      {notifications.some(n => !n.read) && (
                        <button 
                          onClick={markAllRead}
                          className="text-xs text-slate-500 hover:text-slate-800 font-semibold transition-colors"
                        >
                          Mark all read
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="max-h-[320px] overflow-y-auto no-scrollbar py-2">
                    {notifications.length === 0 ? (
                      <div className="flex flex-col items-center justify-center py-10 px-4 text-center">
                        <div className="size-12 rounded-full bg-slate-50 flex items-center justify-center mb-3 border border-slate-100">
                          <Bell size={24} className="text-slate-400" />
                        </div>
                        <h4 className="text-sm font-semibold text-slate-700">All caught up!</h4>
                        <p className="text-xs text-slate-400 mt-1">No new notifications at the moment.</p>
                      </div>
                    ) : (
                      notifications.map((notif) => (
                        <div 
                          key={notif.id}
                          onClick={() => !notif.read && markRead(notif.id)}
                          className="flex items-start gap-3 px-4 py-3 hover:bg-slate-50/80 cursor-pointer border-b border-slate-100 last:border-0 transition-colors"
                        >
                          <div className={`size-8 rounded-full flex items-center justify-center border shrink-0 ${getNotifBg(notif.type)}`}>
                            {getNotifIcon(notif.type)}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className={`text-[13px] leading-normal ${!notif.read ? 'text-slate-900 font-semibold' : 'text-slate-500 font-normal'}`}>
                              {notif.text}
                            </p>
                            <span className="text-[10px] text-slate-400 mt-1 block">{notif.time}</span>
                          </div>
                          <div className="flex flex-col items-center justify-center gap-2 shrink-0">
                            <button 
                              onClick={(e) => {
                                e.stopPropagation();
                                deleteNotification(notif.id);
                              }}
                              className="p-1 hover:bg-slate-100 rounded text-slate-400 hover:text-slate-600 transition-colors"
                              title="Delete notification"
                            >
                              <X size={12} />
                            </button>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>

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
