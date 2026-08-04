import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function generateShortMeetingId(): string {
  const letters = 'abcdefghijklmnopqrstuvwxyz';
  const seg = (len: number) => Array.from({ length: len }, () => letters[Math.floor(Math.random() * letters.length)]).join('');
  return `${seg(3)}-${seg(4)}-${seg(3)}`;
}
