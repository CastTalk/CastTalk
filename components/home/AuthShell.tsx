import { ReactNode } from 'react';
import EmberAurora from './EmberAurora';

/** Shared ember layout for the Clerk sign-in / sign-up screens. */
const AuthShell = ({ title, subtitle, children }: { title: string; subtitle: string; children: ReactNode }) => (
  <main className="relative flex min-h-[100dvh] w-full flex-col items-center overflow-x-hidden bg-white px-4 pb-16 text-ink">
    <EmberAurora />
    <div className="relative z-10 flex w-full max-w-6xl items-center px-2 pt-6">
      <img src="/logo/logoMain.svg" alt="CastTalk" className="h-7 w-auto" />
    </div>
    <div className="relative z-10 mt-14 flex flex-col items-center text-center sm:mt-20">
      <h1 className="font-pixel text-4xl leading-[1.05] tracking-[-0.02em] [text-wrap:balance] sm:text-5xl">{title}</h1>
      <p className="mt-4 max-w-sm font-serif text-lg text-ink-muted">{subtitle}</p>
    </div>
    <div className="relative z-10 mt-10">{children}</div>
  </main>
);

export default AuthShell;

/** Clerk appearance matching the ember redesign (rounded card, black pill button). */
export const clerkAppearance = {
  elements: {
    card: 'rounded-3xl border border-black/5 shadow-[0_24px_60px_-24px_rgba(154,52,18,0.35)]',
    headerTitle: 'font-pixel font-normal text-ink',
    headerSubtitle: 'font-serif text-ink-muted',
    formButtonPrimary: 'rounded-full bg-ink hover:bg-ink-soft normal-case text-[14px] font-medium',
    formFieldInput: 'rounded-xl border-black/10 focus:border-ember focus:ring-ember/20',
    socialButtonsIconButton: 'rounded-xl border-black/10 hover:bg-ember/5',
    footerActionLink: 'text-ember-deep hover:text-ember',
  },
};
