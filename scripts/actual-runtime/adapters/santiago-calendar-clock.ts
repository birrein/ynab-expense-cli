import type { CalendarClock } from '../application/get-status.ts';

export const santiagoCalendarClock: CalendarClock = {
  today: () => new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Santiago',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date()),
};
