export interface AICapability {
  name: string;
  description: string;
  execute: (args: any) => Promise<any>;
}

/**
 * Governed AI Architecture - createMeeting Capability
 * Encapsulates the abstract schema defining what the AI can request.
 * Does not execute directly - outputs execution plan coordinates.
 */
export const createMeetingCapability: AICapability = {
  name: 'createMeeting',
  description: 'AI capability to draft and plan a new video call meeting.',
  execute: async (args: { title: string; startsAt: string; duration: number }) => {
    // Perform abstract plan formatting
    return {
      action: 'createMeeting',
      arguments: {
        title: args.title || 'Untitled AI Meeting',
        startsAt: args.startsAt,
        duration: args.duration || 60,
      },
    };
  },
};
