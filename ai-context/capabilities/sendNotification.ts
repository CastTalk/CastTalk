import { AICapability } from './createMeeting';

/**
 * Governed AI Architecture - sendNotification Capability
 * Maps capability to generate notifications and meeting summaries.
 */
export const sendNotificationCapability: AICapability = {
  name: 'sendNotification',
  description: 'AI capability to formulate notifications or action reminders for the active team sync.',
  execute: async (args: { recipientId: string; title: string; message: string }) => {
    if (!args.recipientId || !args.title || !args.message) {
      throw new Error('recipientId, title, and message are required properties to create notifications.');
    }
    return {
      action: 'sendNotification',
      arguments: {
        recipientId: args.recipientId,
        title: args.title,
        message: args.message,
      },
    };
  },
};
