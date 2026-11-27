import { authMiddleware } from '@clerk/nextjs';

export default authMiddleware({
  // Pages are public so visitors land straight on Home (sign in / sign up / guest
  // prompt) and guests can open meeting links. API routes stay protected except
  // the few guests need — each of those checks for a member OR a valid signed
  // guest session itself (lib/caller.ts).
  publicRoutes: [
    '/',
    '/upcoming',
    '/cast-ai',
    '/meeting/(.*)',
    '/api/guest/session',
    '/api/stream/token',
    '/api/speechmatics/token',
    '/api/cast-ai',
    // Vercel Cron calls this without a Clerk session; the route checks CRON_SECRET itself.
    '/api/cron/reminders',
  ],
  clockSkewInMs: 600000, // Allow up to 10 minutes of clock skew to prevent infinite token expiration loops
});

export const config = {
  matcher: ['/((?!.+\\.[\\w]+$|_next).*)', '/', '/(api|trpc)(.*)'],
};
