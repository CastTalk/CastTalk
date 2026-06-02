import { ActionPlanCheck } from '../validators/action.validator';

/**
 * Governed AI Architecture - Privacy Risk Assessment
 * Evaluates exposure risks prior to gateway delivery.
 */
export const assessPrivacyRisk = (plan: ActionPlanCheck): { riskLevel: 'low' | 'medium' | 'high'; block: boolean } => {
  const { action, arguments: args } = plan;

  // High Risk: Exposing transcripts to third party API hooks without filters
  if (action === 'exportTranscripts' && !args.authorized) {
    return {
      riskLevel: 'high',
      block: true,
    };
  }

  // Medium Risk: AI reading context across multiple calendars
  if (action === 'readContext' && args.userIds && args.userIds.length > 5) {
    return {
      riskLevel: 'medium',
      block: false,
    };
  }

  return {
    riskLevel: 'low',
    block: false,
  };
};
