'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { UserButton } from '@clerk/nextjs';
import { useIdentity, useUser } from '@/providers/IdentityProvider';
import { Bell, Calendar, Clock, Trash, AndroidLogo, List, CaretDown } from '@/components/icons';
import { AnimatePresence, motion } from 'framer-motion';
import Logo from '@/components/Logo';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import NavDock from '@/components/NavDock';
import { useToast } from '@/components/ui/use-toast';

interface NotificationItem {
  id: string;
  text: string;
  read: boolean;
  type: string;
  createdAt: string;
  time: string; // Dynamic formatted label (e.g. "Just now")
  href?: string; // Where tapping goes: the live meeting, or the schedule page
}

const GuestAvatar = ({ name, className = '' }: { name: string; className?: string }) => (
  <span className={`flex shrink-0 items-center justify-center rounded-full border border-ember/30 bg-ember/10 font-pixel uppercase text-ember-deep ${className}`}>
    {name[0] || 'G'}
  </span>
);

/** Desktop menu for guests: who they are, sign in / create account, leave guest mode */
const GuestMenu = ({ name, onLeave }: { name: string; onLeave: () => Promise<void> }) => (
  <DropdownMenu>
    <DropdownMenuTrigger className="flex items-center gap-2 rounded-full border border-black/10 bg-white py-1 pl-1 pr-3 outline-none transition-colors hover:border-ember/40" aria-label="Guest menu">
      <GuestAvatar name={name} className="size-[26px] text-[12px]" />
      <span className="max-w-[120px] truncate text-[13px] text-ink">{name}</span>
      <span className="rounded-full bg-black/5 px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-wider text-ink-muted">Guest</span>
    </DropdownMenuTrigger>
    <DropdownMenuContent align="end" className="z-[60] w-56 rounded-2xl border border-black/5 bg-white p-1.5 shadow-[0_16px_40px_-12px_rgba(0,0,0,0.2)]">
      <div className="px-3 py-2">
        <p className="truncate text-[13px] font-medium text-ink">{name}</p>
        <p className="font-mono text-[10px] text-ink-muted">Guest session · ends when you close the browser</p>
      </div>
      <DropdownMenuSeparator className="my-1 bg-black/5" />
      <DropdownMenuItem asChild className="cursor-pointer rounded-xl px-3 py-2 text-[13px] focus:bg-ember/10">
        <a href="/sign-in">Sign in</a>
      </DropdownMenuItem>
      <DropdownMenuItem asChild className="cursor-pointer rounded-xl px-3 py-2 text-[13px] focus:bg-ember/10">
        <a href="/sign-up">Create an account</a>
      </DropdownMenuItem>
      <DropdownMenuSeparator className="my-1 bg-black/5" />
      <DropdownMenuItem onClick={() => { void onLeave(); }} className="cursor-pointer rounded-xl px-3 py-2 text-[13px] text-red-600 focus:bg-red-50 focus:text-red-700">
        Leave guest mode
      </DropdownMenuItem>
    </DropdownMenuContent>
  </DropdownMenu>
);

const AppNavbar = () => {
  const router = useRouter();
  const pathname = usePathname();
  const { user } = useUser();
  const { isMember, isGuest, leaveGuest } = useIdentity();
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

  // Fetch notifications (polling + refresh on tab focus)
  useEffect(() => {
    // Notifications are database-backed: members only
    if (!user?.id || user.isGuest) return;

    const fetchNotifications = async () => {
      // Skip polls that overlap an optimistic write: their response may predate it
      // and would briefly bring back a deleted item or an unread dot.
      if (pendingMutationsRef.current > 0) return;
      const versionAtStart = mutationVersionRef.current;
      try {
        const res = await fetch('/api/notifications');
        if (res.ok) {
          const data = await res.json();
          if (data.degraded) return; // Keep existing notifications during transient backend blips
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

    // Notifications come only from our authenticated API. (The browser used to
    // subscribe to Appwrite Realtime on the whole collection, which required public
    // read access and delivered every user's notifications to every browser.)
    // Poll every 25s while the tab is visible, and refresh as soon as it's shown again.
    fetchNotifications();
    const interval = setInterval(() => {
      if (document.visibilityState === 'visible') fetchNotifications();
    }, 25000);
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') fetchNotifications();
    };
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [user?.id, user?.isGuest]);



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
        return <Calendar size={16} weight="fill" className="text-orange-600" />;
      case 'scheduled':
        return <Calendar size={16} weight="fill" className="text-amber-500" />;
      case 'cancelled':
        return <Calendar size={16} weight="fill" className="text-red-600" />;
      case 'ai':
        return <AndroidLogo size={16} weight="fill" className="text-violet-600" />;
      case 'alert':
        return <Clock size={16} weight="fill" className="text-amber-600" />;
      case 'update':
        return <Calendar size={16} weight="fill" className="text-amber-600" />;
      default:
        return <Bell size={16} weight="fill" className="text-slate-600" />;
    }
  };

  const getNotifBg = (type: string) => {
    switch (type) {
      case 'success': return 'bg-orange-50 border-orange-100';
      case 'scheduled': return 'bg-amber-50 border-amber-100';
      case 'cancelled': return 'bg-red-50 border-red-100';
      case 'ai': return 'bg-violet-50 border-violet-100';
      case 'alert': return 'bg-amber-50 border-amber-100';
      case 'update': return 'bg-amber-50 border-amber-100';
      default: return 'bg-slate-50 border-slate-100';
    }
  };

  const visibleNotifications = notifications.filter(n => n.type !== 'deleted');

  return (
    <>
      <div className="w-full relative z-40 flex justify-center border-b border-black/5 bg-white/80 backdrop-blur-md">
        <header className="flex w-full max-w-[1440px] flex-row justify-between items-center h-[54px] px-4 md:px-6 lg:px-8">
          <div className="flex items-center h-full cursor-pointer" onClick={() => handleNavigation('/')}>
            <Logo />
          </div>

          {/* Mobile & Tablet Centered Time/Date in Header */}
          <div className="hidden md:flex lg:hidden absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 items-center gap-1.5 whitespace-nowrap font-mono text-[12px] text-ink-soft select-none pointer-events-none sm:text-[13px]">
            <span>{time}</span>
            <span className="text-slate-400">•</span>
            <span>{date}</span>
          </div>

          <div className="absolute left-1/2 top-1/2 hidden -translate-x-1/2 -translate-y-1/2 lg:block">
            <NavDock compact pathname={pathname} onNavigate={handleNavigation} />
          </div>

          <div className="flex items-center gap-2 text-slate-800 sm:gap-4">
            <div className="mr-4 hidden items-center gap-2 font-mono text-[13px] text-ink-soft lg:flex">
              <span>{time}</span><span>•</span><span>{date}</span>
            </div>
            <div className="flex items-center gap-2 sm:gap-3">
              {isMember && (
              <div className="notification-container relative flex items-center">
                <button 
                  onClick={() => setShowNotifications(!showNotifications)}                 className={`relative rounded-full p-2 transition-colors ${showNotifications ? 'bg-[#f97316]/10 text-[#9a3412]' : 'hover:bg-[#f97316]/5 text-slate-800 hover:text-[#9a3412]'}`}
                  title="Notifications"
                >
                  <Bell size={22} weight="regular" />
                  {visibleNotifications.filter(n => !n.read).length > 0 ? (
                    <span className="absolute top-0.5 right-0.5 min-w-4 h-4 px-1 flex items-center justify-center rounded-full bg-[#f97316] text-[9px] font-bold text-white ring-2 ring-white">
                      {visibleNotifications.filter(n => !n.read).length}
                    </span>
                  ) : (
                    <span className="absolute top-1.5 right-1.5 size-2 rounded-full bg-[#f97316] ring-2 ring-white" />
                  )}
                </button>

                <AnimatePresence>
                {showNotifications && (
                  <motion.div
                    key="notif-panel"
                    initial={{ opacity: 0, scale: 0.96, y: -6 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.97, y: -4, transition: { duration: 0.15, ease: 'easeIn' } }}
                    transition={{ duration: 0.45, ease: [0.075, 0.82, 0.165, 1] }}
                    style={{ transformOrigin: 'top right' }}
                    className="fixed inset-x-3 top-[62px] z-50 rounded-[20px] bg-[#fafafa] p-1 shadow-[0_30px_80px_-28px_rgba(154,52,18,0.4),0_0_0_1px_rgba(0,0,0,0.04)] sm:absolute sm:inset-x-auto sm:right-0 sm:top-[46px] sm:w-[380px]"
                  >
                    <div className="relative overflow-hidden rounded-2xl border-[0.8px] border-[#e0e0e0] bg-white text-ink">
                      <div aria-hidden className="pointer-events-none absolute -bottom-24 -left-16 size-64 rounded-full bg-[radial-gradient(closest-side,rgba(249,115,22,0.12),rgba(253,230,138,0.1)_60%,transparent)] blur-2xl" />
                      <div className="relative flex items-center justify-between border-b border-black/[0.06] px-4 py-3.5">
                        <span className="font-pixel text-[17px] text-ink">Notifications</span>
                        <div className="flex items-center gap-1.5">
                          {visibleNotifications.some(n => !n.read) && (
                            <button
                              onClick={markAllRead}
                              className="rounded-full border border-black/10 px-2.5 py-1 text-[11px] font-medium text-ink-soft transition-colors hover:border-ember/40 hover:bg-ember/5 hover:text-ember-deep"
                            >
                              Mark all read
                            </button>
                          )}
                          {visibleNotifications.length > 0 && visibleNotifications.every(n => n.read) && (
                            <button
                              onClick={clearAllNotifications}
                              className="flex items-center gap-1 rounded-full border border-black/10 px-2.5 py-1 text-[11px] font-medium text-ink-soft transition-colors hover:border-red-200 hover:bg-red-50 hover:text-red-600"
                              title="Clear all notifications"
                            >
                              <Trash size={12} />
                              Clear all
                            </button>
                          )}
                        </div>
                      </div>

                      <div className="relative max-h-[340px] overflow-y-auto no-scrollbar p-1.5">
                        {visibleNotifications.length === 0 ? (
                          <div className="flex flex-col items-center justify-center px-4 py-10 text-center">
                            <div className="mb-3 flex size-11 items-center justify-center rounded-xl bg-ember/10 text-ember-deep">
                              <Bell size={22} />
                            </div>
                            <h4 className="font-pixel text-[15px] text-ink">All caught up</h4>
                            <p className="mt-1 font-serif text-[13px] text-ink-muted">No new notifications right now.</p>
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
                              className="group flex cursor-pointer items-start gap-3 rounded-xl px-2.5 py-2.5 transition-colors hover:bg-ember/[0.05] active:bg-ember/10"
                            >
                              <div className={`flex size-8 shrink-0 items-center justify-center rounded-lg border ${getNotifBg(notif.type)}`}>
                                {getNotifIcon(notif.type)}
                              </div>
                              <div className="min-w-0 flex-1">
                                <p className={`line-clamp-2 text-[13px] leading-snug ${!notif.read ? 'font-medium text-ink' : 'text-ink-muted'}`}>
                                  {notif.text}
                                </p>
                                <span className="mt-1 block font-mono text-[10px] text-ink-muted">{notif.time}</span>
                              </div>
                              {!notif.read && <span aria-label="Unread" className="mt-1.5 size-1.5 shrink-0 rounded-full bg-ember" />}
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  deleteNotification(notif.id);
                                }}
                                // Always visible on touch screens (no hover); hover-reveal only with a mouse
                                className="shrink-0 rounded-lg p-1.5 text-ink-muted transition-all hover:bg-red-50 hover:text-red-600 [@media(hover:hover)]:opacity-0 [@media(hover:hover)]:group-hover:opacity-100 [@media(hover:hover)]:focus-visible:opacity-100"
                                title="Delete notification"
                                aria-label="Delete notification"
                              >
                                <Trash size={13} />
                              </button>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  </motion.div>
                )}
                </AnimatePresence>
              </div>
              )}

              {/* Desktop profile avatar (member) or guest menu */}
              {isMember ? (
                <div className="hidden lg:flex size-[34px] rounded-full overflow-hidden items-center justify-center border-2 border-[#f97316]/40 hover:border-[#f97316] transition-colors">
                  <UserButton afterSignOutUrl="/" appearance={{ elements: { avatarBox: 'w-full h-full' } }} />
                </div>
              ) : isGuest && user ? (
                <div className="hidden lg:block">
                  <GuestMenu name={user.fullName || 'Guest'} onLeave={leaveGuest} />
                </div>
              ) : null}

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
                  ) : isGuest ? (
                    <span className="font-pixel text-[12px] uppercase text-ember-deep">{(user?.fullName || 'G')[0]}</span>
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
        className={`lg:hidden fixed left-0 right-0 z-[39] bg-white border-b border-black/5 shadow-lg shadow-black/5 overflow-hidden ${
          mobilePanelOpen 
            ? 'max-h-[500px] opacity-100' 
            : 'max-h-0 opacity-0 pointer-events-none'
        }`}
        style={{ top: '54px', transition: 'max-height 0.4s cubic-bezier(0.16,1,0.3,1), opacity 0.3s ease' }}
      >
        <div className="relative z-10 px-4 py-3">
          {/* Navigation lives in the bottom dock; this panel is just the profile */}
          {/* Profile section pushed to bottom */}
          <div
            className="flex items-center gap-3 px-3.5 py-2.5 rounded-xl hover:bg-slate-50 transition-colors"
            style={{
              opacity: mobilePanelOpen ? 1 : 0,
              transform: mobilePanelOpen ? 'translateY(0)' : 'translateY(-12px)',
              transition: 'opacity 0.4s ease 0.35s, transform 0.4s ease 0.35s',
            }}
          >
            {isGuest ? (
              <>
                <GuestAvatar name={user?.fullName || 'Guest'} className="size-[36px] text-[14px]" />
                <div className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate text-[14px] font-semibold text-slate-800">{user?.fullName || 'Guest'}</span>
                  <span className="truncate font-mono text-[11px] text-ink-muted">Guest session</span>
                </div>
                <button
                  type="button"
                  onClick={() => { setMobilePanelOpen(false); void leaveGuest(); }}
                  className="shrink-0 rounded-full px-2.5 py-1.5 text-[12px] text-ink-muted transition-colors hover:text-red-600"
                >
                  Leave
                </button>
                <a href="/sign-in" className="shrink-0 rounded-full bg-ink px-3 py-1.5 text-[12px] font-medium text-white">Sign in</a>
              </>
            ) : (
              <>
                <div className="size-[36px] rounded-full overflow-hidden flex items-center justify-center border border-slate-200 shrink-0">
                  <UserButton afterSignOutUrl="/" appearance={{ elements: { avatarBox: 'w-full h-full' } }} />
                </div>
                <div className="flex flex-col min-w-0">
                  <span className="text-[14px] font-semibold text-slate-800 truncate">
                    {user?.fullName || user?.firstName || 'Account'}
                  </span>
                  <span className="text-[12px] text-slate-400 truncate">
                    {user?.primaryEmailAddress?.emailAddress || 'Manage account'}
                  </span>
                </div>
              </>
            )}
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

      {/* Mobile & tablet: floating square dock — the main navigation below lg */}
      <div className="pointer-events-none fixed inset-x-0 bottom-0 z-40 flex justify-center px-3 pb-[calc(env(safe-area-inset-bottom)+10px)] lg:hidden">
        <NavDock
          className="pointer-events-auto"
          layoutId="nav-dock-active-mobile"
          pathname={pathname}
          onNavigate={handleNavigation}
        />
      </div>
    </>
  );
};

export default AppNavbar;
