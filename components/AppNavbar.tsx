'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { UserButton, useUser } from '@clerk/nextjs';
import { Bell, X, Calendar, Brain, Clock, Trash, AndroidLogo, List, House, CalendarCheck, CaretDown } from '@phosphor-icons/react';
import { Client } from 'appwrite';
import { NoiseTexture } from '@/components/ui/noise-texture';
import { useToast } from '@/components/ui/use-toast';

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
  href?: string; // Where tapping goes: the live meeting, or the schedule page
}

const mobileNavLinks: { label: string; route: string; icon: any; disabled?: boolean }[] = [
  { label: 'Home', route: '/', icon: House },
  { label: 'Schedule', route: '/upcoming', icon: CalendarCheck },
  { label: 'CastAI', route: '/cast-ai', icon: Brain },
];

const AppNavbar = () => {
  const router = useRouter();
  const pathname = usePathname();
  const { user } = useUser();
  const mobilePanelRef = useRef<HTMLDivElement>(null);

  const handleNavigation = (url: string) => {
    if (typeof window !== 'undefined' && (window as any).isAIAutomating) {
      const event = new CustomEvent('show-ai-interrupt-modal', { detail: { targetUrl: url } });
      window.dispatchEvent(event);
      return;
    }
    router.push(url);
  };
  const [time, setTime] = useState('');
  const [date, setDate] = useState('');
  const [showNotifications, setShowNotifications] = useState(false);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [mobilePanelOpen, setMobilePanelOpen] = useState(false);
  const { toast } = useToast();
  // Optimistic-write bookkeeping: polls are ignored while a write is in flight
  const pendingMutationsRef = useRef(0);
  const mutationVersionRef = useRef(0);

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
    // The clock shows minutes only, so tick on minute boundaries instead of every
    // second (which re-rendered the whole navbar 60 times a minute for nothing).
    update();
    let interval: ReturnType<typeof setInterval> | undefined;
    const msToNextMinute = 60_000 - (Date.now() % 60_000);
    const timeout = setTimeout(() => {
      update();
      interval = setInterval(update, 60_000);
    }, msToNextMinute);
    return () => {
      clearTimeout(timeout);
      if (interval) clearInterval(interval);
    };
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

  // Close mobile panel on click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (!document.body.contains(target)) return;
      if (mobilePanelRef.current && !mobilePanelRef.current.contains(target) && !target.closest('.mobile-panel-trigger')) {
        setMobilePanelOpen(false);
      }
    };
    if (mobilePanelOpen) {
      document.addEventListener('click', handleClickOutside);
      return () => document.removeEventListener('click', handleClickOutside);
    }
  }, [mobilePanelOpen]);

  // Close mobile panel on route change
  useEffect(() => {
    setMobilePanelOpen(false);
  }, [pathname]);

  // Auto-close mobile/tablet panel when screen resizes past lg breakpoint (1024px)
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth >= 1024) {
        setMobilePanelOpen(false);
      }
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Fetch initial notifications and subscribe to Appwrite Realtime
  useEffect(() => {
    if (!user?.id) return;

    const fetchNotifications = async () => {
      // Skip polls that overlap an optimistic write: their response may predate it
      // and would briefly bring back a deleted item or an unread dot.
      if (pendingMutationsRef.current > 0) return;
      const versionAtStart = mutationVersionRef.current;
      try {
        const res = await fetch('/api/notifications');
        if (res.ok) {
          const data = await res.json();
          if (pendingMutationsRef.current > 0 || mutationVersionRef.current !== versionAtStart) return;
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
    const interval = setInterval(fetchNotifications, 25000);

    // Appwrite Realtime listener with graceful fallback
    let unsubscribe = () => {};
    try {
      unsubscribe = appwriteClient.subscribe(
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
            // The 25s poll may already have added it
            setNotifications(prev => (prev.some(n => n.id === formatted.id) ? prev : [formatted, ...prev]));
          } else if (response.events.some(e => e.includes('update'))) {
            setNotifications(prev => prev.map(n => n.id === doc.$id ? { ...n, read: doc.read } : n));
          } else if (response.events.some(e => e.includes('delete'))) {
            setNotifications(prev => prev.filter(n => n.id !== doc.$id));
          }
        }
      );
    } catch (e) {
      console.warn('[AppNavbar] Appwrite Realtime subscription error, using polling fallback:', e);
    }

    return () => {
      clearInterval(interval);
      try {
        unsubscribe();
      } catch {}
    };
  }, [user?.id]);



  // ── Optimistic mutations ────────────────────────────────────────────────
  // Each action updates the list immediately, then writes to the server. If the
  // write fails (network error or non-2xx), only the items that action touched are
  // restored, so concurrent actions and realtime updates are not clobbered.
  const runOptimistic = async (
    request: () => Promise<Response>,
    apply: () => void,
    rollback: () => void,
    failureTitle: string
  ) => {
    pendingMutationsRef.current += 1;
    mutationVersionRef.current += 1;
    apply();
    try {
      const res = await request();
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
    } catch (e) {
      console.error('[AppNavbar] Notification update failed:', e);
      rollback();
      toast({ title: failureTitle, description: 'Your change was undone. Please try again.', variant: 'destructive' });
    } finally {
      pendingMutationsRef.current -= 1;
      mutationVersionRef.current += 1;
    }
  };

  const restoreItems = (items: NotificationItem[]) =>
    setNotifications(prev => {
      const existing = new Set(prev.map(n => n.id));
      const merged = [...prev, ...items.filter(n => !existing.has(n.id))];
      return merged.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    });

  const markAllRead = () => {
    const unreadIds = new Set(notifications.filter(n => !n.read).map(n => n.id));
    if (unreadIds.size === 0) return;
    return runOptimistic(
      () => fetch('/api/notifications', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ markAll: true }),
      }),
      () => setNotifications(prev => prev.map(n => (unreadIds.has(n.id) ? { ...n, read: true } : n))),
      () => setNotifications(prev => prev.map(n => (unreadIds.has(n.id) ? { ...n, read: false } : n))),
      "Couldn't mark notifications as read"
    );
  };

  const markRead = (id: string) =>
    runOptimistic(
      () => fetch('/api/notifications', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: [id] }),
      }),
      () => setNotifications(prev => prev.map(n => (n.id === id ? { ...n, read: true } : n))),
      () => setNotifications(prev => prev.map(n => (n.id === id ? { ...n, read: false } : n))),
      "Couldn't mark notification as read"
    );

  // Tapping a notification marks it read (if needed) and opens what it's about:
  // the meeting while it's joinable, otherwise the schedule page.
  const openNotification = (notif: NotificationItem) => {
    if (!notif.read) void markRead(notif.id);
    setShowNotifications(false);
    setMobilePanelOpen(false);
    handleNavigation(notif.href || '/upcoming');
  };

  const deleteNotification = (id: string) => {
    const removed = notifications.find(n => n.id === id);
    if (!removed) return;
    return runOptimistic(
      () => fetch(`/api/notifications?id=${encodeURIComponent(id)}`, { method: 'DELETE' }),
      () => setNotifications(prev => prev.filter(n => n.id !== id)),
      () => restoreItems([removed]),
      "Couldn't delete notification"
    );
  };

  const clearAllNotifications = () => {
    const removed = notifications;
    if (removed.length === 0) return;
    const removedIds = new Set(removed.map(n => n.id));
    return runOptimistic(
      () => fetch('/api/notifications?clearAll=true', { method: 'DELETE' }),
      () => setNotifications(prev => prev.filter(n => !removedIds.has(n.id))),
      () => restoreItems(removed),
      "Couldn't clear notifications"
    );
  };

  const getNotifIcon = (type: string) => {
    switch (type) {
      case 'success':
        return <Calendar size={16} weight="fill" className="text-emerald-600" />;
      case 'scheduled':
        return <Calendar size={16} weight="fill" className="text-amber-500" />;
      case 'cancelled':
        return <Calendar size={16} weight="fill" className="text-red-600" />;
      case 'ai':
        return <AndroidLogo size={16} weight="fill" className="text-violet-600" />;
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
      case 'scheduled': return 'bg-amber-50 border-amber-100';
      case 'cancelled': return 'bg-red-50 border-red-100';
      case 'ai': return 'bg-violet-50 border-violet-100';
      case 'alert': return 'bg-amber-50 border-amber-100';
      case 'update': return 'bg-blue-50 border-blue-100';
      default: return 'bg-slate-50 border-slate-100';
    }
  };

  const visibleNotifications = notifications.filter(n => n.type !== 'deleted');

  return (
    <>
      <div className="w-full relative z-40 flex justify-center border-b-2 border-dashed border-[#15803d]/20 bg-[#f3f4f6]">
        <header className="flex w-full max-w-[1440px] flex-row justify-between items-center h-[54px] px-4 md:px-6 lg:px-8">
          <div className="flex items-center h-full cursor-pointer" onClick={() => handleNavigation('/')}>
            <img src="/logo/logoMain.svg" alt="CastTalk" className="h-8 w-auto" />
          </div>

          {/* Mobile & Tablet Centered Time/Date in Header */}
          <div className="flex lg:hidden absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 items-center text-[13px] sm:text-[14px] font-medium text-slate-700 gap-1.5 whitespace-nowrap select-none pointer-events-none">
            <span>{time}</span>
            <span className="text-slate-400">•</span>
            <span>{date}</span>
          </div>

          <nav className="hidden lg:flex absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 items-center gap-1.5 text-[14px]">
            <button 
              onClick={() => handleNavigation('/')} 
              className={pathname === '/' 
                ? 'bg-[#15803d] text-white px-4 py-1.5 rounded-full font-medium shadow-sm transition-all' 
                : 'text-slate-700 hover:text-black hover:bg-black/5 px-3.5 py-1.5 rounded-full transition-colors font-medium'}
            >
              Home
            </button>
            <button 
              onClick={() => handleNavigation('/upcoming')} 
              className={pathname === '/upcoming' 
                ? 'bg-[#15803d] text-white px-4 py-1.5 rounded-full font-medium shadow-sm transition-all' 
                : 'text-slate-700 hover:text-black hover:bg-black/5 px-3.5 py-1.5 rounded-full transition-colors font-medium'}
            >
              Schedule
            </button>
            <button 
              onClick={() => handleNavigation('/cast-ai')} 
              className={pathname === '/cast-ai' 
                ? 'bg-[#15803d] text-white px-4 py-1.5 rounded-full font-medium shadow-sm transition-all' 
                : 'text-slate-700 hover:text-black hover:bg-black/5 px-3.5 py-1.5 rounded-full transition-colors font-medium'}
            >
              CastAI
            </button>
          </nav>

          <div className="flex items-center gap-4 text-slate-800">
            <div className="hidden lg:flex items-center text-[15px] font-medium gap-2 mr-4">
              <span>{time}</span><span>•</span><span>{date}</span>
            </div>
            <div className="flex items-center gap-4">
              <div className="notification-container relative flex items-center">
                <button 
                  onClick={() => setShowNotifications(!showNotifications)}                 className={`relative rounded-full p-2 transition-colors ${showNotifications ? 'bg-[#15803d]/10 text-[#15803d]' : 'hover:bg-[#15803d]/10 text-slate-800 hover:text-[#15803d]'}`}
                  title="Notifications"
                >
                  <Bell size={22} weight="regular" />
                  {visibleNotifications.filter(n => !n.read).length > 0 ? (
                    <span className="absolute top-0.5 right-0.5 min-w-4 h-4 px-1 flex items-center justify-center rounded-full bg-[#15803d] text-[9px] font-bold text-white ring-2 ring-white">
                      {visibleNotifications.filter(n => !n.read).length}
                    </span>
                  ) : (
                    <span className="absolute top-1.5 right-1.5 size-2 rounded-full bg-[#15803d] ring-2 ring-white" />
                  )}
                </button>

                {showNotifications && (
                  <div className="absolute right-0 top-[42px] w-[calc(100vw-2rem)] sm:w-[360px] max-w-[360px] bg-white/95 backdrop-blur-md text-slate-800 rounded-2xl shadow-xl border border-slate-200/80 z-50 animate-slide-down overflow-hidden" style={{ right: 'min(0px, calc(-1 * (100vw - 100%)))' }}>
                    <div className="flex items-center justify-between p-4 border-b border-slate-100">
                      <div className="flex items-center gap-2">
                        <Bell size={18} weight="fill" className="text-[#15803d]" />
                        <span className="font-bold text-[15px] text-slate-900">Notifications</span>
                      </div>
                      <div className="flex items-center gap-3">
                        {visibleNotifications.some(n => !n.read) && (
                          <button 
                            onClick={markAllRead}
                            className="px-2 py-1 text-[11px] font-semibold text-slate-600 hover:text-slate-800 bg-slate-50 hover:bg-slate-100 border border-slate-200/60 rounded-md transition-colors"
                          >
                            Mark all read
                          </button>
                        )}
                        {visibleNotifications.length > 0 && visibleNotifications.every(n => n.read) && (
                          <button 
                            onClick={clearAllNotifications}
                            className="flex items-center gap-1.5 px-2 py-1 text-[11px] font-semibold text-red-600 hover:text-red-700 bg-red-50 hover:bg-red-100 border border-red-100 rounded-md transition-colors"
                            title="Clear all notifications"
                          >
                            <Trash size={13} weight="bold" />
                            <span>Clear all</span>
                          </button>
                        )}
                      </div>
                    </div>

                    <div className="max-h-[320px] overflow-y-auto no-scrollbar py-2">
                      {visibleNotifications.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-10 px-4 text-center">
                          <div className="size-12 rounded-full bg-slate-50 flex items-center justify-center mb-3 border border-slate-100">
                            <Bell size={24} className="text-slate-400" />
                          </div>
                          <h4 className="text-sm font-semibold text-slate-700">All caught up!</h4>
                          <p className="text-xs text-slate-400 mt-1">No new notifications at the moment.</p>
                        </div>
                      ) : (
                        visibleNotifications.map((notif) => (
                          <div
                            key={notif.id}
                            role="button"
                            tabIndex={0}
                            onClick={() => openNotification(notif)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' || e.key === ' ') {
                                e.preventDefault();
                                openNotification(notif);
                              }
                            }}
                            className="group flex items-start gap-3 px-4 py-3 hover:bg-slate-50/80 active:bg-slate-100 cursor-pointer border-b border-slate-100 last:border-0 transition-colors"
                          >
                            <div className={`size-8 rounded-full flex items-center justify-center border shrink-0 ${getNotifBg(notif.type)}`}>
                              {getNotifIcon(notif.type)}
                            </div>
                            <div className="flex-1 min-w-0 pr-4">
                              <p className={`text-[12px] leading-normal line-clamp-2 ${!notif.read ? 'text-slate-900 font-medium' : 'text-slate-500 font-normal'}`}>
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
                                // Always visible on touch screens (no hover); hover-reveal only with a mouse
                                className="p-1.5 bg-red-50 hover:bg-red-100 rounded-full text-red-500 hover:text-red-600 transition-all [@media(hover:hover)]:opacity-0 [@media(hover:hover)]:group-hover:opacity-100 [@media(hover:hover)]:focus-visible:opacity-100"
                                title="Delete notification"
                                aria-label="Delete notification"
                              >
                                <Trash size={12} weight="bold" />
                              </button>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Desktop profile avatar */}
              <div className="hidden lg:flex size-[34px] rounded-full overflow-hidden items-center justify-center border-2 border-[#15803d]/40 hover:border-[#15803d] transition-colors">
                <UserButton afterSignOutUrl="/sign-in" appearance={{ elements: { avatarBox: 'w-full h-full' } }} />
              </div>

              {/* Mobile/Tablet collapsible sidebar trigger */}
              <button
                className="mobile-panel-trigger lg:hidden flex items-center gap-1.5 rounded-full p-1.5 pl-2 transition-all duration-200 border border-slate-200/80 bg-white hover:bg-slate-50 active:scale-95"
                onClick={() => setMobilePanelOpen(!mobilePanelOpen)}
                aria-label="Toggle navigation menu"
                aria-expanded={mobilePanelOpen}
              >
                <div className="size-[26px] rounded-full overflow-hidden border border-slate-200 bg-slate-100 flex items-center justify-center shrink-0">
                  {user?.imageUrl ? (
                    <img src={user.imageUrl} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <List size={14} weight="bold" className="text-slate-500" />
                  )}
                </div>
                <CaretDown 
                  size={12} 
                  weight="bold" 
                  className={`text-slate-400 transition-transform duration-300 ${mobilePanelOpen ? 'rotate-180' : ''}`} 
                />
              </button>
            </div>
          </div>
        </header>
      </div>

      {/* Mobile & Tablet collapsible sidebar panel — slides down from navbar */}
      <div
        ref={mobilePanelRef}
        className={`lg:hidden fixed left-0 right-0 z-[39] bg-[#f8f9fa] border-b border-slate-200 shadow-lg shadow-black/5 overflow-hidden ${
          mobilePanelOpen 
            ? 'max-h-[500px] opacity-100' 
            : 'max-h-0 opacity-0 pointer-events-none'
        }`}
        style={{ top: '54px', transition: 'max-height 0.4s cubic-bezier(0.16,1,0.3,1), opacity 0.3s ease' }}
      >
        {/* Subtle noise texture */}
        <NoiseTexture className="opacity-[0.1]" />
        <div className="relative z-10 px-4 pt-3 pb-4">
          {/* Navigation links with staggered slide-down animation */}
          <nav className="flex flex-col gap-1">
            {mobileNavLinks.map((link, index) => {
              const isActive = pathname === link.route || pathname.startsWith(`${link.route}/`);
              const Icon = link.icon;
              return (
                <button
                  key={link.route}
                  onClick={() => {
                    if (!link.disabled) {
                      handleNavigation(link.route);
                      setMobilePanelOpen(false);
                    }
                  }}
                  disabled={link.disabled}
                  className={`flex items-center gap-3.5 px-3 py-2.5 rounded-none text-[15px] font-medium transition-all duration-200 ${
                    link.disabled
                      ? 'text-slate-300 cursor-not-allowed'
                      : isActive
                      ? 'bg-[#15803d] text-white'
                      : 'text-slate-600 hover:bg-[#15803d]/5 hover:text-slate-900 active:scale-[0.98]'
                  }`}
                  style={{
                    opacity: mobilePanelOpen ? 1 : 0,
                    transform: mobilePanelOpen ? 'translateY(0)' : 'translateY(-12px)',
                    transition: `opacity 0.35s ease ${0.06 * (index + 1)}s, transform 0.35s ease ${0.06 * (index + 1)}s`,
                  }}
                >
                  <Icon size={20} weight={isActive ? 'bold' : 'regular'} />
                  <span>{link.label}</span>
                  {link.disabled && (
                    <span className="ml-auto text-[10px] font-semibold text-slate-300 bg-slate-100 px-2 py-0.5 rounded-full">Soon</span>
                  )}
                </button>
              );
            })}
          </nav>

          {/* Divider */}
          <div 
            className="my-4 h-px bg-slate-100"
            style={{
              opacity: mobilePanelOpen ? 1 : 0,
              transform: mobilePanelOpen ? 'scaleX(1)' : 'scaleX(0)',
              transition: 'opacity 0.3s ease 0.3s, transform 0.4s ease 0.25s',
              transformOrigin: 'left',
            }}
          />

          {/* Profile section pushed to bottom */}
          <div
            className="flex items-center gap-3 px-3.5 py-2.5 rounded-xl hover:bg-slate-50 transition-colors"
            style={{
              opacity: mobilePanelOpen ? 1 : 0,
              transform: mobilePanelOpen ? 'translateY(0)' : 'translateY(-12px)',
              transition: 'opacity 0.4s ease 0.35s, transform 0.4s ease 0.35s',
            }}
          >
            <div className="size-[36px] rounded-full overflow-hidden flex items-center justify-center border border-slate-200 shrink-0">
              <UserButton afterSignOutUrl="/sign-in" appearance={{ elements: { avatarBox: 'w-full h-full' } }} />
            </div>
            <div className="flex flex-col min-w-0">
              <span className="text-[14px] font-semibold text-slate-800 truncate">
                {user?.fullName || user?.firstName || 'Account'}
              </span>
              <span className="text-[12px] text-slate-400 truncate">
                {user?.primaryEmailAddress?.emailAddress || 'Manage account'}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Mobile & Tablet backdrop overlay */}
      {mobilePanelOpen && (
        <div 
          className="lg:hidden fixed inset-0 z-[38] bg-black/10"
          style={{ top: '54px' }}
          onClick={() => setMobilePanelOpen(false)}
        />
      )}
    </>
  );
};

export default AppNavbar;
