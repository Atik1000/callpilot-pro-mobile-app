export type Availability = 'available' | 'dnd';

export type OutOfHoursDestination = 'Voicemail' | 'Mobile' | 'Out-of-hours team';

export interface BusinessHours {
  days: string;
  start: string;
  end: string;
}
