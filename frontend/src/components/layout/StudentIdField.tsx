import { useState, useEffect, useRef } from 'react';
import { STUDENT_ID_LENGTH, cn, sanitizeStudentId } from '../../lib/format';
import { useAppStore } from '../../store/useAppStore';
import { useStudentId } from '../../hooks/useStudentId';
import { Check, User, AlertTriangle, X } from 'lucide-react';

/** Global 17-digit Birth Registration Number input, persisted in localStorage. */
export function StudentIdField() {
  const setStudentId = useAppStore((s) => s.setStudentId);
  const { studentId, isValid } = useStudentId();
  const [warning, setWarning] = useState<string | null>(null);
  const warningTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const partial = studentId.length > 0 && !isValid;

  const triggerWarning = (msg: string) => {
    setWarning(msg);
    if (warningTimerRef.current) clearTimeout(warningTimerRef.current);
    warningTimerRef.current = setTimeout(() => {
      setWarning(null);
    }, 4500);
  };

  useEffect(() => {
    return () => {
      if (warningTimerRef.current) clearTimeout(warningTimerRef.current);
    };
  }, []);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    // Allow control keys, backspace, tab, enter, arrow keys, copy/paste shortcuts
    if (
      e.ctrlKey ||
      e.metaKey ||
      e.altKey ||
      ['Backspace', 'Delete', 'ArrowLeft', 'ArrowRight', 'Tab', 'Enter', 'Home', 'End'].includes(e.key)
    ) {
      return;
    }

    // If key is a printable character but NOT a digit 0-9
    if (e.key.length === 1 && !/^\d$/.test(e.key)) {
      e.preventDefault();
      triggerWarning('Invalid character! Only numeric digits (0–9) are permitted in Birth Registration Number.');
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawValue = e.target.value;
    if (/[^\d]/.test(rawValue)) {
      triggerWarning('Letters and symbols are prohibited! Only numeric digits (0–9) are allowed.');
    }
    const clean = sanitizeStudentId(rawValue);
    setStudentId(clean);
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    const pasted = e.clipboardData.getData('text');
    if (/[^\d]/.test(pasted)) {
      triggerWarning('Pasted text contained non-digit characters which were rejected.');
    }
  };

  return (
    <div className="relative w-44 sm:w-64 md:w-72">
      <label htmlFor="student-id" className="sr-only">
        Birth Registration Number (17 Digits)
      </label>
      <div
        className={cn(
          'flex h-9 items-center gap-2 rounded-lg border bg-slate-900/90 px-2.5 transition-colors duration-150',
          warning && 'border-rose-500/80 ring-2 ring-rose-500/30',
          !warning && isValid && 'border-emerald-500/50 focus-within:ring-2 focus-within:ring-emerald-500/30',
          !warning && partial && 'border-amber-500/50 focus-within:ring-2 focus-within:ring-amber-500/30',
          !warning && !studentId && 'border-slate-800 focus-within:border-sky-500/50 focus-within:ring-2 focus-within:ring-sky-500/20',
        )}
      >
        <User
          className={cn('size-3.5 shrink-0', isValid ? 'text-emerald-400' : 'text-slate-500')}
          aria-hidden="true"
        />
        <input
          id="student-id"
          name="studentId"
          value={studentId}
          onKeyDown={handleKeyDown}
          onChange={handleChange}
          onPaste={handlePaste}
          inputMode="numeric"
          autoComplete="off"
          spellCheck={false}
          maxLength={STUDENT_ID_LENGTH}
          placeholder="17-digit Student ID…"
          aria-describedby="student-id-status"
          className="min-w-0 flex-1 bg-transparent font-mono text-xs text-white placeholder:font-sans placeholder:text-slate-500 focus:outline-none"
        />
        <span
          id="student-id-status"
          className={cn(
            'shrink-0 text-[10px] font-medium tabular-nums',
            isValid ? 'text-emerald-400' : 'text-slate-500',
          )}
          aria-live="polite"
        >
          {isValid ? (
            <Check className="size-3.5 text-emerald-400" aria-label="Valid ID confirmed" />
          ) : (
            `${studentId.length}/${STUDENT_ID_LENGTH}`
          )}
        </span>
      </div>

      {warning && (
        <div
          role="alert"
          className="absolute left-0 right-0 top-full z-50 mt-1 flex items-start gap-1.5 rounded-lg border border-rose-500/40 bg-rose-950/95 p-2 text-[11px] text-rose-200 shadow-xl backdrop-blur-md"
        >
          <AlertTriangle className="size-3.5 shrink-0 text-rose-400 mt-0.5" aria-hidden="true" />
          <span className="flex-1 font-medium leading-tight">{warning}</span>
          <button
            type="button"
            onClick={() => setWarning(null)}
            className="text-rose-400 hover:text-rose-200 shrink-0 ml-1"
            aria-label="Dismiss warning"
          >
            <X className="size-3.5" />
          </button>
        </div>
      )}
    </div>
  );
}
