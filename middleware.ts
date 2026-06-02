import { authMiddleware } from '@clerk/nextjs';

export default authMiddleware({
  publicRoutes: [],
  clockSkewInMs: 300000, // Allow up to 5 minutes of clock skew to prevent infinite token expiration loops
});

export const config = {
  matcher: ['/((?!.+\\.[\\w]+$|_next).*)', '/', '/(api|trpc)(.*)'],
};
