export interface PolicyRequest {
  userId: string;
  action: string;
  payload: any;
}

export interface PolicyResult {
  allowed: boolean;
  reason?: string;
}

/**
 * Governed AI Architecture - Privacy Policy
 * Ensures the AI agent is not permitted to read or expose private user metadata or transcripts
 * without active explicit role access.
 */
export const checkPrivacyPolicy = async (req: PolicyRequest): Promise<PolicyResult> => {
  // Destructure policy inputs
  const { action, payload } = req;

  // Strict Policy Check: AI cannot query global transcripts without filter
  if (action === 'readTranscripts' && !payload.meetingId) {
    return {
      allowed: false,
      reason: 'AI is not authorized to query global transcripts without a specific meeting context filter.',
    };
  }

  // Strict Policy Check: Destructive deletion queries are blocked
  if (action.toLowerCase().includes('delete') || action.toLowerCase().includes('purge')) {
    return {
      allowed: false,
      reason: 'Destructive delete operations are strictly prohibited in the default AI context.',
    };
  }

  return { allowed: true };
};
