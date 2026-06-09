import { authMiddleware } from '@clerk/nextjs';

export default authMiddleware({
  publicRoutes: [],
  clockSkewInMs: 600000, // Allow up to 10 minutes of clock skew to prevent infinite token expiration loops
});

export const config = {
  matcher: ['/((?!.+\\.[\\w]+$|_next).*)', '/', '/(api|trpc)(.*)'],
};
