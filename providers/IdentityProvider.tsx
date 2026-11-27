'use client';

import { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { useUser as useClerkUser } from '@clerk/nextjs';

/**
 * One identity for the whole app: a signed-in Clerk member, a session guest, or
 * nobody yet. Pages use `useUser()` from here (same shape as Clerk's) so most
 * code works for members and guests alike.
 *
 * Guest identity is owned by the server (signed httpOnly cookie, see
 * lib/guest-session.ts); this provider only asks the server who the guest is.
 */

export type AppUser = {
  id: string;
  fullName: string | null;
  firstName: string | null;
  username: string | null;
  imageUrl: string;
  primaryEmailAddress: { emailAddress: string } | null;
  isGuest: boolean;
};

type IdentityContextValue = {
  user: AppUser | null;
  /** Clerk and the guest-session check have both resolved */
  isLoaded: boolean;
  /** Member or guest */
  isSignedIn: boolean;
  isGuest: boolean;
  isMember: boolean;
  enterAsGuest: (name: string) => Promise<void>;
  leaveGuest: () => Promise<void>;
  /** Open the "this needs an account" dialog (guests / visitors) */
  requireAccount: (reason?: string) => void;
  accountPrompt: string | null;
  closeAccountPrompt: () => void;
};

const IdentityContext = createContext<IdentityContextValue | null>(null);

type GuestInfo = { id: string; name: string; exp: number };

export const IdentityProvider = ({ children }: { children: ReactNode }) => {
  const { user: clerkUser, isLoaded: clerkLoaded } = useClerkUser();
  const [guest, setGuest] = useState<GuestInfo | null>(null);
  const [guestChecked, setGuestChecked] = useState(false);
  const [accountPrompt, setAccountPrompt] = useState<string | null>(null);
  const clearedGuestCookie = useRef(false);

  // Ask the server for the guest session (the cookie is httpOnly). Members skip it,
  // and a leftover guest cookie is cleared once someone signs in.
  useEffect(() => {
    if (!clerkLoaded) return;
    if (clerkUser) {
      setGuest(null);
      setGuestChecked(true);
      if (!clearedGuestCookie.current) {
        clearedGuestCookie.current = true;
        fetch('/api/guest/session', { method: 'DELETE' }).catch(() => {});
      }
      return;
    }
    let cancelled = false;
    fetch('/api/guest/session')
      .then((r) => (r.ok ? r.json() : { guest: null }))
      .then((data) => {
        if (!cancelled) setGuest(data?.guest ?? null);
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setGuestChecked(true);
      });
    return () => {
      cancelled = true;
    };
  }, [clerkLoaded, clerkUser]);

  // Expire the guest locally when its session ends
  useEffect(() => {
    if (!guest) return;
    const ms = guest.exp * 1000 - Date.now();
    if (ms <= 0) {
      setGuest(null);
      return;
    }
    const t = window.setTimeout(() => setGuest(null), Math.min(ms, 2 ** 31 - 1));
    return () => window.clearTimeout(t);
  }, [guest]);

  // Stable user object: Clerk hands back a new `user` identity on every refresh
  const memberKey = clerkUser ? [clerkUser.id, clerkUser.fullName, clerkUser.firstName, clerkUser.username, clerkUser.imageUrl, clerkUser.primaryEmailAddress?.emailAddress].join('|') : '';
  const user = useMemo<AppUser | null>(() => {
    if (clerkUser) {
      return {
        id: clerkUser.id,
        fullName: clerkUser.fullName,
        firstName: clerkUser.firstName,
        username: clerkUser.username,
        imageUrl: clerkUser.imageUrl,
        primaryEmailAddress: clerkUser.primaryEmailAddress ? { emailAddress: clerkUser.primaryEmailAddress.emailAddress } : null,
        isGuest: false,
      };
    }
    if (guest) {
      return {
        id: guest.id,
        fullName: guest.name,
        firstName: guest.name,
        username: null,
        imageUrl: '',
        primaryEmailAddress: null,
        isGuest: true,
      };
    }
    return null;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [memberKey, guest?.id, guest?.name]);

  const enterAsGuest = useCallback(async (name: string) => {
    const res = await fetch('/api/guest/session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data?.guest) throw new Error(data?.error || 'Could not start a guest session');
    setGuest(data.guest);
  }, []);

  const leaveGuest = useCallback(async () => {
    await fetch('/api/guest/session', { method: 'DELETE' }).catch(() => {});
    setGuest(null);
  }, []);

  const requireAccount = useCallback((reason?: string) => {
    setAccountPrompt(reason || 'This feature needs a CastTalk account.');
  }, []);
  const closeAccountPrompt = useCallback(() => setAccountPrompt(null), []);

  const value = useMemo<IdentityContextValue>(
    () => ({
      user,
      isLoaded: clerkLoaded && guestChecked,
      isSignedIn: !!user,
      isGuest: !!user?.isGuest,
      isMember: !!user && !user.isGuest,
      enterAsGuest,
      leaveGuest,
      requireAccount,
      accountPrompt,
      closeAccountPrompt,
    }),
    [user, clerkLoaded, guestChecked, enterAsGuest, leaveGuest, requireAccount, accountPrompt, closeAccountPrompt]
  );

  return <IdentityContext.Provider value={value}>{children}</IdentityContext.Provider>;
};

export const useIdentity = () => {
  const ctx = useContext(IdentityContext);
  if (!ctx) throw new Error('useIdentity must be used inside <IdentityProvider>');
  return ctx;
};

/** Drop-in for Clerk's useUser(): works for members and guests. */
export const useUser = () => {
  const { user, isLoaded, isSignedIn } = useIdentity();
  return { user, isLoaded, isSignedIn };
};
