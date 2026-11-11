import { describe, expect, it } from 'vitest';
import type { SchoolClass, StudentHold } from '../../lib/types';
import { getApplyState } from './applyState';

const seats = (over: Partial<SchoolClass> = {}): SchoolClass => ({
  id: 'c6', name: 'Class 6 - Morning Shift', grade: 6, shift: 'MORNING', totalSeats: 10,
  heldSeats: 0, confirmedSeats: 0, availableSeats: 10, waitlistCount: 0, academicYear: 2026, ...over,
});

const hold = (over: Partial<StudentHold> = {}): StudentHold => ({
  holdId: 'h1', classId: 'c6', className: 'Class 6', status: 'HELD',
  expiresAt: '2030-01-01T00:00:00Z', createdAt: '2026-01-01T00:00:00Z', waitlistPosition: null, academicYear: 2026, ...over,
});

describe('getApplyState', () => {
  it('asks for an ID first', () => {
    expect(getApplyState({ seats: seats(), hasValidId: false }).action).toBeNull();
  });

  it('applies when seats are free', () => {
    expect(getApplyState({ seats: seats(), hasValidId: true })).toMatchObject({ label: 'Apply', action: 'apply' });
  });

  it('offers the waitlist when every seat is held, not "full"', () => {
    const state = getApplyState({ seats: seats({ heldSeats: 10, availableSeats: 0 }), hasValidId: true });
    expect(state).toMatchObject({ label: 'Join waitlist', action: 'waitlist' });
    expect(state.hint).toMatch(/automatically/);
  });

  it('closes only when every seat is confirmed', () => {
    const state = getApplyState({ seats: seats({ confirmedSeats: 10, availableSeats: 0 }), hasValidId: true });
    expect(state).toMatchObject({ label: 'Admission closed', action: null });
  });

  it('links to the application in this class', () => {
    expect(getApplyState({ seats: seats(), hasValidId: true, active: hold() }))
      .toMatchObject({ label: 'Seat held · Pay now', action: 'view' });
    expect(getApplyState({ seats: seats(), hasValidId: true, active: hold({ status: 'WAITLISTED', waitlistPosition: 3 }) }))
      .toMatchObject({ label: 'On waitlist · #3', action: 'view' });
  });

  it('blocks other classes while the student has an active application', () => {
    const state = getApplyState({ seats: seats({ id: 'c7', name: 'Class 7' }), hasValidId: true, active: hold() });
    expect(state).toMatchObject({ label: 'Already applied elsewhere', action: null });
  });

  it('disables applications for upcoming session classes before exact start time', () => {
    const futureDate = new Date(Date.now() + 86400000).toISOString();
    const state = getApplyState({ seats: seats({ academicYear: 2027 }), hasValidId: true, upcomingStartsAt: futureDate });
    expect(state.action).toBeNull();
    expect(state.label).toBe('Applications Open Soon');
    expect(state.hint).toContain('Applications for this upcoming session open at');
  });

  it('disables applications for archived historical cohort classes', () => {
    const state = getApplyState({ seats: seats({ academicYear: 2025 }), hasValidId: true, isArchived: true });
    expect(state.action).toBeNull();
    expect(state.label).toBe('Cohort Archived');
  });
});
