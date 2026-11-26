import { authMiddleware } from '@clerk/nextjs';

export default authMiddleware({
  // Vercel Cron calls this without a Clerk session; the route checks CRON_SECRET itself.
  publicRoutes: ['/api/cron/reminders'],
  clockSkewInMs: 600000, // Allow up to 10 minutes of clock skew to prevent infinite token expiration loops
});

export const config = {
  matcher: ['/((?!.+\\.[\\w]+$|_next).*)', '/', '/(api|trpc)(.*)'],
};
