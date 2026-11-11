export const STUDENT_ID_LENGTH = 17;

export const isValidStudentId = (value: string) => /^\d{17}$/.test(value);

/** Keeps only digits, capped at 17, for the ID input. */
export const sanitizeStudentId = (value: string) => value.replace(/\D/g, '').slice(0, STUDENT_ID_LENGTH);

/** Whole seconds left until `expiresAt`, never negative. */
export function secondsUntil(expiresAt: string | null, now: number): number {
  if (!expiresAt) return 0;
  const ms = Date.parse(expiresAt) - now;
  return Number.isFinite(ms) ? Math.max(0, Math.ceil(ms / 1000)) : 0;
}

/** 75 → "01:15", 3725 → "1:02:05". */
export function formatCountdown(totalSeconds: number): string {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const pad = (n: number) => String(n).padStart(2, '0');
  return hours > 0 ? `${hours}:${pad(minutes)}:${pad(seconds)}` : `${pad(minutes)}:${pad(seconds)}`;
}

/** Joins class names, skipping falsy values. */
export const cn = (...classes: Array<string | false | null | undefined>) => classes.filter(Boolean).join(' ');

/** Formats count with singular or plural noun: "1 seat" vs "2 seats", "0 seats". */
export function pluralize(count: number, singular: string, plural = `${singular}s`): string {
  return count === 1 ? `1 ${singular}` : `${count} ${plural}`;
}

/** Formats remaining seats: "1 seat remaining" vs "5 seats remaining". */
export function formatRemainingSeats(available: number): string {
  return available === 1 ? '1 seat remaining' : `${available} seats remaining`;
}

/** Formats future timestamp into human readable countdown (e.g. "3d 4h 12m" or "42m 10s"). */
export function formatFutureCountdown(targetIso: string | null): string {
  if (!targetIso) return '';
  const diffMs = Date.parse(targetIso) - Date.now();
  if (diffMs <= 0) return 'Starting now';

  const totalSecs = Math.floor(diffMs / 1000);
  const days = Math.floor(totalSecs / 86400);
  const hours = Math.floor((totalSecs % 86400) / 3600);
  const minutes = Math.floor((totalSecs % 3600) / 60);
  const seconds = totalSecs % 60;

  if (days > 0) return `${days}d ${hours}h ${minutes}m`;
  if (hours > 0) return `${hours}h ${minutes}m ${seconds}s`;
  if (minutes > 0) return `${minutes}m ${seconds}s`;
  return `${seconds}s`;
}
