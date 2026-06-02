import { checkActionPlanValidity } from '../validators/action.validator';
import { assessPrivacyRisk } from '../risk/privacy.risk';
import { assessSecurityRisk } from '../risk/security.risk';

export interface RawAIIntent {
  intent: string;
  entities: any;
}

/**
 * Governed AI Architecture - Action Planner
 * Converts unstructured raw AI intent metadata into governed Action Plans.
 * Layer 6: Audits risk assessments and structural validity, returning execution coordinates.
 */
export class ActionPlanner {
  /**
   * Plans an action from raw intent.
   * Governs planning pipelines prior to execution gateway delivery.
   */
  static planAction(intent: RawAIIntent): { success: boolean; plan?: any; error?: string } {
    // 1. Convert intent into planned action plan
    const proposedPlan = {
      action: intent.intent,
      arguments: intent.entities,
    };

    // 2. Perform Layer 4 structural logical checks
    const validation = checkActionPlanValidity(proposedPlan);
    if (!validation.valid) {
      return {
        success: false,
        error: `Validation error: ${validation.reason || 'Logical checks failed.'}`,
      };
    }

    // 3. Perform Layer 5 Privacy Risk Checks
    const privacyRisk = assessPrivacyRisk(proposedPlan);
    if (privacyRisk.block) {
      return {
        success: false,
        error: 'Risk Assessment Block: Planned action exposes sensitive metadata rules.',
      };
    }

    // 4. Perform Layer 5 Security Risk Checks
    const securityRisk = assessSecurityRisk(proposedPlan);
    if (securityRisk.block) {
      return {
        success: false,
        error: 'Risk Assessment Block: Destructive actions planned automatically are blocked.',
      };
    }

    return {
      success: true,
      plan: proposedPlan,
    };
  }
}
