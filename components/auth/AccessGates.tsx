'use client';

import { FormEvent, useState } from 'react';
import { usePathname } from 'next/navigation';
import { AnimatePresence, motion } from 'framer-motion';
import CastTalkModal from '@/components/CastTalkModal';
import Logo from '@/components/Logo';
import { ArrowLeft, Lock, User } from '@/components/icons';
import { useIdentity } from '@/providers/IdentityProvider';

const authHref = (path: '/sign-in' | '/sign-up') =>
  typeof window === 'undefined' ? path : `${path}?redirect_url=${encodeURIComponent(window.location.href)}`;

/**
 * Welcome gate: visitors who are neither signed in nor a guest choose Sign in,
 * Sign up, or "Enter as guest" (asks for a display name). It can't be dismissed
 * without choosing — but the page renders behind it, so it never feels blank.
 */
export const WelcomeGate = () => {
  const { isLoaded, isSignedIn, enterAsGuest } = useIdentity();
  const pathname = usePathname();
  const [asGuest, setAsGuest] = useState(false);
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const open = isLoaded && !isSignedIn;
  const inMeeting = pathname?.startsWith('/meeting/');

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim() || busy) return;
    setBusy(true);
    setError(null);
    try {
      await enterAsGuest(name);
    } catch (err: any) {
      setError(err?.message || 'Something went wrong. Try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <CastTalkModal isOpen={open} onClose={() => {}} showClose={false} maxWidth="max-w-[420px]">
      <div className="flex flex-col items-center text-center">
        <Logo className="text-[16px]" />
        <h2 className="mt-6 font-pixel text-[26px] font-normal leading-tight text-ink">
          {inMeeting ? 'Join this meeting' : 'Welcome to CastTalk'}
        </h2>
        <p className="mt-2 max-w-[300px] font-serif text-[15px] leading-relaxed text-ink-muted">
          {inMeeting
            ? 'Sign in to use your account, or join as a guest with just your name.'
            : 'Sign in to schedule meetings and keep your history, or jump in as a guest.'}
        </p>
      </div>

      <AnimatePresence mode="wait" initial={false}>
        {!asGuest ? (
          <motion.div
            key="choices"
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.18 }}
            className="mt-7 flex flex-col gap-2.5"
          >
            <a
              href={authHref('/sign-in')}
              className="flex h-11 items-center justify-center rounded-full bg-ink text-[14px] font-medium text-white transition-colors hover:bg-ink-soft"
            >
              Sign in
            </a>
            <a
              href={authHref('/sign-up')}
              className="flex h-11 items-center justify-center rounded-full border border-black/10 text-[14px] font-medium text-ink transition-colors hover:border-ember/40 hover:bg-ember/5"
            >
              Create an account
            </a>
            <div className="my-2 flex items-center gap-3 font-mono text-[10px] uppercase tracking-widest text-ink-muted">
              <span className="h-px flex-1 bg-black/[0.07]" />
              or
              <span className="h-px flex-1 bg-black/[0.07]" />
            </div>
            <button
              type="button"
              onClick={() => setAsGuest(true)}
              className="mx-auto flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[13px] text-ink-soft transition-colors hover:text-ember-deep"
            >
              <User size={15} />
              Enter as guest
            </button>
          </motion.div>
        ) : (
          <motion.form
            key="guest"
            onSubmit={submit}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.18 }}
            className="mt-7 flex flex-col gap-3"
          >
            <label className="text-left font-mono text-[11px] uppercase tracking-widest text-ink-muted" htmlFor="guest-name">
              Your name
            </label>
            <input
              id="guest-name"
              autoFocus
              maxLength={40}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="How others will see you"
              className="h-11 rounded-xl border border-black/10 bg-white px-4 text-[15px] text-ink outline-none transition-shadow placeholder:text-ink-muted focus:border-ember/60 focus:ring-4 focus:ring-ember/15"
            />
            {error && <p className="text-left text-[12px] text-red-600">{error}</p>}
            <button
              type="submit"
              disabled={!name.trim() || busy}
              className="h-11 rounded-full bg-ember text-[14px] font-medium text-white transition-colors hover:bg-ember-deep disabled:cursor-not-allowed disabled:opacity-50"
            >
              {busy ? 'Starting…' : 'Continue as guest'}
            </button>
            <p className="font-serif text-[12px] leading-relaxed text-ink-muted">
              Guest sessions end when you close your browser. Nothing you do as a guest is saved to your account.
            </p>
            <button
              type="button"
              onClick={() => setAsGuest(false)}
              className="mx-auto flex items-center gap-1 text-[12px] text-ink-muted transition-colors hover:text-ink"
            >
              <ArrowLeft size={13} />
              Back
            </button>
          </motion.form>
        )}
      </AnimatePresence>
    </CastTalkModal>
  );
};

/** "This needs an account" — shown when a guest tries a member-only feature. */
export const AccountRequiredDialog = () => {
  const { accountPrompt, closeAccountPrompt } = useIdentity();

  return (
    <CastTalkModal isOpen={!!accountPrompt} onClose={closeAccountPrompt} maxWidth="max-w-[400px]">
      <div className="flex flex-col items-center text-center">
        <span className="flex size-12 items-center justify-center rounded-2xl bg-ember/10 text-ember-deep">
          <Lock size={22} />
        </span>
        <h2 className="mt-5 font-pixel text-[22px] font-normal leading-tight text-ink">Sign in to continue</h2>
        <p className="mt-2 max-w-[300px] font-serif text-[15px] leading-relaxed text-ink-muted">{accountPrompt}</p>
      </div>
      <div className="mt-7 flex flex-col gap-2.5">
        <a
          href={authHref('/sign-in')}
          className="flex h-11 items-center justify-center rounded-full bg-ink text-[14px] font-medium text-white transition-colors hover:bg-ink-soft"
        >
          Sign in
        </a>
        <a
          href={authHref('/sign-up')}
          className="flex h-11 items-center justify-center rounded-full border border-black/10 text-[14px] font-medium text-ink transition-colors hover:border-ember/40 hover:bg-ember/5"
        >
          Create an account
        </a>
        <button
          type="button"
          onClick={closeAccountPrompt}
          className="mt-1 text-[13px] text-ink-muted transition-colors hover:text-ink"
        >
          Not now
        </button>
      </div>
    </CastTalkModal>
  );
};
