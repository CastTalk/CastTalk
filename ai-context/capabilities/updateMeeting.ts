import { AICapability } from './createMeeting';

/**
 * Governed AI Architecture - updateMeeting Capability
 * Captures abstract intent to update a scheduled meeting event.
 */
export const updateMeetingCapability: AICapability = {
  name: 'updateMeeting',
  description: 'AI capability to plan and coordinate modifications to a scheduled calendar event.',
  execute: async (args: { meetingId: string; title?: string; startsAt?: string; duration?: number }) => {
    if (!args.meetingId) {
      throw new Error('meetingId is a required parameter for the updateMeeting capability.');
    }
    return {
      action: 'updateMeeting',
      arguments: {
        meetingId: args.meetingId,
        updates: {
          ...(args.title && { title: args.title }),
          ...(args.startsAt && { startsAt: args.startsAt }),
          ...(args.duration && { duration: args.duration }),
        },
      },
    };
  },
};
