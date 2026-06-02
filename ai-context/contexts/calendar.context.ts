export interface CalendarEventSummary {
  eventId: string;
  title: string;
  startsAt: string;
  duration: number;
}

/**
 * Governed AI Architecture - Calendar Context Engine
 * Supplies user's upcoming schedules to resolve overlaps or plan invites.
 */
export const getUserCalendarContext = async (userId: string): Promise<CalendarEventSummary[]> => {
  console.log(`Context engine retrieving calendar schedules for userId: ${userId}`);
  return [
    {
      eventId: 'evt-101',
      title: 'Sprint Sync',
      startsAt: new Date(Date.now() + 2 * 3600000).toISOString(), // 2 hours from now
      duration: 60,
    },
    {
      eventId: 'evt-102',
      title: 'Design Review',
      startsAt: new Date(Date.now() + 24 * 3600000).toISOString(), // Tomorrow
      duration: 45,
    },
  ];
};
