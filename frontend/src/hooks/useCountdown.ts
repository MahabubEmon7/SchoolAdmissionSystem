import { useEffect, useRef, useState } from 'react';
import { secondsUntil } from '../lib/format';

/**
 * Seconds left until `expiresAt`, re-rendering every second while `active`.
 * Calls `onExpire` once when it reaches zero.
 */
export function useCountdown(expiresAt: string | null, active: boolean, onExpire?: () => void) {
  const [now, setNow] = useState(Date.now);
  const onExpireRef = useRef(onExpire);
  onExpireRef.current = onExpire;

  useEffect(() => {
    if (!active || !expiresAt) return;
    let fired = false;
    const tick = () => {
      const t = Date.now();
      setNow(t);
      if (!fired && secondsUntil(expiresAt, t) === 0) {
        fired = true;
        onExpireRef.current?.();
      }
    };
    tick();
    const timer = window.setInterval(tick, 1000);
    return () => window.clearInterval(timer);
  }, [expiresAt, active]);

  // Computed during render, so a new deadline (e.g. a waitlist promotion) shows immediately.
  return secondsUntil(expiresAt, now);
}
