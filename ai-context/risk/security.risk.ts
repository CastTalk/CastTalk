import { ActionPlanCheck } from '../validators/action.validator';

/**
 * Governed AI Architecture - Security Risk Assessment
 * Evaluates destructive risks before gateway delivery.
 */
export const assessSecurityRisk = (plan: ActionPlanCheck): { riskLevel: 'low' | 'medium' | 'high'; block: boolean } => {
  const { action } = plan;

  // High Risk: Destructive deletion actions planned by AI automatically
  if (action === 'purgeHistory') {
    return {
      riskLevel: 'high',
      block: true, // Auto-block destructive AI actions
    };
  }

  return {
    riskLevel: 'low',
    block: false,
  };
};
