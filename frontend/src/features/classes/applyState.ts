import type { SchoolClass, StudentHold } from '../../lib/types';

export type ApplyAction = 'apply' | 'waitlist' | 'view' | null;

export interface ApplyState {
  label: string;
  /** What the button does; null means it's disabled. */
  action: ApplyAction;
  /** One line under the button explaining the state. */
  hint?: string;
}

interface Input {
  seats: SchoolClass;
  hasValidId: boolean;
  /** The student's one active application, in any class. */
  active?: StudentHold;
  /** If this class belongs to an upcoming session with a scheduled future start time */
  upcomingStartsAt?: string | null;
  isArchived?: boolean;
}

/** Decides the class card's button: apply, join the waitlist, view your application, or why not. */
export function getApplyState({
  seats,
  hasValidId,
  active,
  upcomingStartsAt,
  isArchived,
}: Input): ApplyState {
  if (isArchived) {
    return {
      label: 'Cohort Archived',
      action: null,
      hint: 'This academic session is closed and historical.',
    };
  }

  if (upcomingStartsAt) {
    const diff = Date.parse(upcomingStartsAt) - Date.now();
    if (diff > 0) {
      const formattedDate = new Date(upcomingStartsAt).toLocaleString(undefined, {
        dateStyle: 'medium',
        timeStyle: 'short',
      });
      return {
        label: 'Applications Open Soon',
        action: null,
        hint: `Applications for this upcoming session open at ${formattedDate}.`,
      };
    }
  }

  if (!hasValidId) return { label: 'Enter your ID to apply', action: null };

  if (active?.classId === seats.id) {
    if (active.status === 'CONFIRMED') return { label: 'Admission confirmed', action: 'view' };
    if (active.status === 'WAITLISTED')
      return { label: `On waitlist · #${active.waitlistPosition ?? '–'}`, action: 'view' };
    return { label: 'Seat held · Pay now', action: 'view' };
  }

  // The list shows one banner explaining this, so the card stays quiet.
  if (active) return { label: 'Already applied elsewhere', action: null };

  if (seats.availableSeats > 0) return { label: 'Apply', action: 'apply' };

  if (seats.heldSeats > 0) {
    return {
      label: 'Join waitlist',
      action: 'waitlist',
      hint:
        seats.waitlistCount > 0
          ? `All seats are on hold · ${seats.waitlistCount} waiting. Unpaid seats go to the waitlist in order.`
          : 'All seats are on hold. If a payment is missed, the seat goes to you automatically.',
    };
  }

  return { label: 'Admission closed', action: null, hint: 'Every seat in this class is confirmed.' };
}
