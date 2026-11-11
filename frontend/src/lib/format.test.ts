import { describe, expect, it } from 'vitest';
import {
  formatCountdown,
  formatFutureCountdown,
  formatRemainingSeats,
  isValidStudentId,
  pluralize,
  sanitizeStudentId,
  secondsUntil,
} from './format';

describe('student id', () => {
  it('accepts exactly 17 digits', () => {
    expect(isValidStudentId('20152691234567890')).toBe(true);
    expect(isValidStudentId('2015269123456789')).toBe(false);
    expect(isValidStudentId('201526912345678901')).toBe(false);
    expect(isValidStudentId('2015269123456789a')).toBe(false);
  });

  it('strips non-digits and caps the length', () => {
    expect(sanitizeStudentId('2015-2691 2345 678901234')).toBe('20152691234567890');
  });
});

describe('pluralization and remaining seats', () => {
  it('correctly formats singular and plural seats', () => {
    expect(pluralize(1, 'seat', 'seats')).toBe('1 seat');
    expect(pluralize(0, 'seat', 'seats')).toBe('0 seats');
    expect(pluralize(5, 'seat', 'seats')).toBe('5 seats');
  });

  it('formats remaining seats label', () => {
    expect(formatRemainingSeats(1)).toBe('1 seat remaining');
    expect(formatRemainingSeats(12)).toBe('12 seats remaining');
    expect(formatRemainingSeats(0)).toBe('0 seats remaining');
  });
});

describe('countdown', () => {
  const expiresAt = '2026-11-01T04:10:00Z';
  const at = (iso: string) => Date.parse(iso);

  it('rounds partial seconds up and never goes negative', () => {
    expect(secondsUntil(expiresAt, at('2026-11-01T04:09:59.200Z'))).toBe(1);
    expect(secondsUntil(expiresAt, at('2026-11-01T04:10:00Z'))).toBe(0);
    expect(secondsUntil(expiresAt, at('2026-11-01T05:00:00Z'))).toBe(0);
  });

  it('formats minutes and hours', () => {
    expect(formatCountdown(600)).toBe('10:00');
    expect(formatCountdown(75)).toBe('01:15');
    expect(formatCountdown(3725)).toBe('1:02:05');
  });

  it('formats future countdowns for upcoming admission sessions', () => {
    const inThreeDays = new Date(Date.now() + 3 * 86400 * 1000 + 4 * 3600 * 1000 + 10 * 60 * 1000).toISOString();
    expect(formatFutureCountdown(inThreeDays)).toContain('3d 4h');

    const pastDate = new Date(Date.now() - 10000).toISOString();
    expect(formatFutureCountdown(pastDate)).toBe('Starting now');

    expect(formatFutureCountdown(null)).toBe('');
  });
});
