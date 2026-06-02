import { currentUser } from '@clerk/nextjs/server';

export interface UserContextProfile {
  userId: string;
  firstName: string;
  role: 'admin' | 'user' | 'guest';
  isActive: boolean;
}

/**
 * Governed AI Architecture - User Context Engine
 * Dynamically retrieves user context using Clerk session credentials.
 * Supports passing a client-side Clerk user object directly, or falls back to server-side session retrieval.
 */
export const getUserContext = async (
  userId?: string,
  clientSideUser?: any
): Promise<UserContextProfile> => {
  // 1. If a client-side Clerk user object was passed directly, use it
  if (clientSideUser) {
    return {
      userId: clientSideUser.id,
      firstName: clientSideUser.firstName || 'User',
      role: clientSideUser.publicMetadata?.role === 'admin' ? 'admin' : 'user',
      isActive: true,
    };
  }

  // 2. Otherwise, attempt server-side Clerk session retrieval
  try {
    const serverUser = await currentUser();
    if (serverUser) {
      return {
        userId: serverUser.id,
        firstName: serverUser.firstName || 'User',
        role: serverUser.publicMetadata?.role === 'admin' ? 'admin' : 'user',
        isActive: true,
      };
    }
  } catch (error) {
    console.warn('Clerk server-side session could not be queried in the current context:', error);
  }

  // 3. Fallback to userId lookup
  if (userId) {
    return {
      userId,
      firstName: 'User',
      role: 'user',
      isActive: true,
    };
  }

  return {
    userId: 'guest-session',
    firstName: 'Guest',
    role: 'guest',
    isActive: false,
  };
};
