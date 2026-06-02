import { PolicyRequest, PolicyResult } from './privacy.policy';

/**
 * Governed AI Architecture - Role Policy
 * Ensures the AI agent adheres to active user permissions and roles.
 */
export const checkRolePolicy = async (req: PolicyRequest, userRole: 'admin' | 'user' | 'guest'): Promise<PolicyResult> => {
  const { action } = req;

  // Guest role limits
  if (userRole === 'guest') {
    if (action.startsWith('write') || action.startsWith('create') || action.startsWith('update')) {
      return {
        allowed: false,
        reason: 'Guest roles are restricted to read-only AI access.',
      };
    }
  }

  // General user limits
  if (userRole === 'user') {
    if (action === 'adminSettingsUpdate' || action === 'systemConfiguration') {
      return {
        allowed: false,
        reason: 'Standard user roles do not possess administrative permissions required to request system updates.',
      };
    }
  }

  return { allowed: true };
};
