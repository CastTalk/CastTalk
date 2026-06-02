import { validateDatePlan } from './date.validator';
import { validateTargetUser } from './user.validator';

export interface ActionPlanCheck {
  action: string;
  arguments: any;
}

/**
 * Governed AI Architecture - Action Validator
 * Performs logical constraint checks on plans created by the AI Action Planner.
 */
export const checkActionPlanValidity = (plan: ActionPlanCheck): { valid: boolean; reason?: string } => {
  const { action, arguments: args } = plan;

  if (action === 'createMeeting' || action === 'updateMeeting') {
    if (args.startsAt && !validateDatePlan(args.startsAt)) {
      return {
        valid: false,
        reason: 'Target meeting start timestamp is invalid or is set in the past.',
      };
    }
  }

  if (action === 'sendNotification') {
    if (args.recipientId && !validateTargetUser(args.recipientId)) {
      return {
        valid: false,
        reason: 'Recipient userId format is invalid or unauthorized.',
      };
    }
  }

  return { valid: true };
};
