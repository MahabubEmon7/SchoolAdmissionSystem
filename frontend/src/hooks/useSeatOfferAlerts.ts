import { useEffect, useRef } from 'react';
import { toast } from 'react-toastify';
import type { HoldStatus, StudentHold } from '../lib/types';

/** Toasts when polling shows a waitlisted application has just been given a seat. */
export function useSeatOfferAlerts(holds: StudentHold[] | undefined) {
  const previous = useRef<Map<string, HoldStatus> | null>(null);

  useEffect(() => {
    if (!holds) return;
    const before = previous.current;
    for (const hold of holds) {
      if (before?.get(hold.holdId) === 'WAITLISTED' && hold.status === 'HELD') {
        toast.success(`Good news! A seat opened in ${hold.className}. Pay the fee before the timer runs out.`, {
          autoClose: 10_000,
        });
      }
    }
    previous.current = new Map(holds.map((h) => [h.holdId, h.status]));
  }, [holds]);
}
