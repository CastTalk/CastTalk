import { PolicyRequest, PolicyResult } from './privacy.policy';

/**
 * Governed AI Architecture - Security Policy
 * Verifies boundaries and tokens so that user inputs are securely bound.
 */
export const checkSecurityPolicy = async (req: PolicyRequest): Promise<PolicyResult> => {
  const { userId, payload } = req;

  // Strict Security Policy Check: Ensure target user operations match request origin user
  if (payload.targetUserId && payload.targetUserId !== userId) {
    return {
      allowed: false,
      reason: 'AI is prohibited from operating on user data belonging to a different userId origin context.',
    };
  }

  // Strict Security Policy Check: Block token extraction queries
  if (payload.query && (payload.query.includes('token') || payload.query.includes('key') || payload.query.includes('password'))) {
    return {
      allowed: false,
      reason: 'AI is blocked from querying credential-like keywords (token, key, password) to prevent leakage.',
    };
  }

  return { allowed: true };
};
