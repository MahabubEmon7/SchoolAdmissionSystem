import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { AlertTriangle, ShieldCheck } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { formatCountdown } from '../../lib/format';

interface PaymentDialogProps {
  open: boolean;
  classTitle: string;
  academicYear?: number;
  initialName?: string | null;
  initialAge?: number | null;
  secondsLeft: number;
  paying: boolean;
  onClose: () => void;
  onComplete: (info: { studentName: string; age: number }) => void;
}

/**
 * Clean, stylish admission fee payment modal.
 * Collects and validates student Full Name and Age (server-validated)
 * within the 10-minute hold window before official enrollment confirmation.
 */
export function PaymentDialog({
  open,
  classTitle,
  academicYear = 2026,
  initialName = '',
  initialAge = null,
  secondsLeft,
  paying,
  onClose,
  onComplete,
}: PaymentDialogProps) {
  const [studentName, setStudentName] = useState(initialName ?? '');
  const [age, setAge] = useState<string>(initialAge ? String(initialAge) : '');
  const [touched, setTouched] = useState({ name: false, age: false });

  // Reset or sync when dialog opens
  useEffect(() => {
    if (open) {
      setStudentName(initialName ?? '');
      setAge(initialAge ? String(initialAge) : '');
      setTouched({ name: false, age: false });
    }
  }, [open, initialName, initialAge]);

  const expired = secondsLeft <= 0;

  // Validation rules
  const trimmedName = studentName.trim();
  const parsedAge = parseInt(age, 10);

  const nameError =
    touched.name && (trimmedName.length < 2 || trimmedName.length > 100)
      ? 'Student full name must be between 2 and 100 characters.'
      : null;

  const ageError =
    touched.age && (isNaN(parsedAge) || parsedAge < 3 || parsedAge > 25)
      ? 'Age must be a valid number between 3 and 25 years.'
      : null;

  const isValid =
    trimmedName.length >= 2 &&
    trimmedName.length <= 100 &&
    !isNaN(parsedAge) &&
    parsedAge >= 3 &&
    parsedAge <= 25;

  const handleConfirm = () => {
    setTouched({ name: true, age: true });
    if (!isValid || expired || paying) return;
    onComplete({
      studentName: trimmedName,
      age: parsedAge,
    });
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Complete Admission Fee Payment"
      footer={
        <div className="flex items-center justify-end gap-2 w-full">
          <Button type="button" variant="outline" onClick={onClose} disabled={paying}>
            Not Now
          </Button>
          <Button
            type="button"
            onClick={handleConfirm}
            loading={paying}
            disabled={expired || (!isValid && (touched.name || touched.age))}
            className="bg-emerald-600 hover:bg-emerald-500 text-white font-medium shadow-md shadow-emerald-950/40"
          >
            {expired ? 'Hold Expired' : 'Confirm Payment & Enroll'}
          </Button>
        </div>
      }
    >
      <div className="space-y-4 text-sm text-slate-300 [overscroll-behavior:contain]">
        {/* 10-Minute Hold Countdown Bar */}
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3.5 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="size-2 rounded-full bg-amber-400 animate-pulse" />
            <div>
              <span className="text-xs font-semibold text-amber-300 block">10-Minute Hold Window</span>
              <span className="text-[11px] text-amber-400/80">Submit your info and confirm before deadline</span>
            </div>
          </div>
          <div className="text-right">
            <span className="text-[10px] uppercase tracking-wider text-slate-400 block">Time Left</span>
            <span className="font-mono text-base font-bold text-amber-400 tabular-nums">
              {formatCountdown(secondsLeft)}
            </span>
          </div>
        </div>

        {/* Assigned Class & Session Overview */}
        <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-3.5 grid grid-cols-2 gap-3">
          <div>
            <span className="text-[11px] font-medium uppercase tracking-wider text-slate-500 block">
              Assigned Class
            </span>
            <p className="font-semibold text-white text-sm mt-0.5">{classTitle}</p>
          </div>
          <div>
            <span className="text-[11px] font-medium uppercase tracking-wider text-slate-500 block">
              Academic Session
            </span>
            <div className="mt-0.5">
              <Badge tone="info" className="text-[11px]">
                Year {academicYear}–{academicYear + 1}
              </Badge>
            </div>
          </div>
        </div>

        {/* Student Basic Information Form */}
        <div className="space-y-3.5 pt-1">
          <div className="border-b border-slate-800 pb-1.5 flex items-center justify-between">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-300">
              Student Basic Details
            </h4>
            <span className="text-[11px] text-rose-400">* Both fields required</span>
          </div>

          {/* Student Full Name */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label htmlFor="student-full-name" className="text-xs font-medium text-slate-200">
                Student Full Name
              </label>
              <span className="text-[11px] text-slate-500 font-mono">
                {trimmedName.length}/100
              </span>
            </div>
            <div className="relative">
              <input
                id="student-full-name"
                name="studentFullName"
                type="text"
                autoComplete="name"
                placeholder="e.g. Walter White"
                value={studentName}
                onChange={(e) => setStudentName(e.target.value)}
                onBlur={() => setTouched((t) => ({ ...t, name: true }))}
                className="w-full rounded-xl border border-slate-800 bg-slate-950/80 px-3.5 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/50"
              />
            </div>
            {nameError && (
              <p className="mt-1 text-xs text-rose-400 flex items-center gap-1">
                <AlertTriangle className="size-3.5 shrink-0" />
                <span>{nameError}</span>
              </p>
            )}
          </div>

          {/* Student Age */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label htmlFor="student-age" className="text-xs font-medium text-slate-200">
                Student Age (Years)
              </label>
              <span className="text-[11px] text-slate-400">Permitted: 3–25 years</span>
            </div>
            <div className="relative">
              <input
                id="student-age"
                name="studentAge"
                type="number"
                min={3}
                max={25}
                placeholder="e.g. 7"
                value={age}
                onChange={(e) => setAge(e.target.value)}
                onBlur={() => setTouched((t) => ({ ...t, age: true }))}
                className="w-full rounded-xl border border-slate-800 bg-slate-950/80 px-3.5 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/50"
              />
            </div>
            {ageError && (
              <p className="mt-1 text-xs text-rose-400 flex items-center gap-1">
                <AlertTriangle className="size-3.5 shrink-0" />
                <span>{ageError}</span>
              </p>
            )}
          </div>
        </div>

        {/* Security & Validation Notice */}
        <div className="rounded-lg border border-slate-800 bg-slate-950/40 p-2.5 flex items-start gap-2 text-[11px] text-slate-400 leading-relaxed">
          <ShieldCheck className="size-4 shrink-0 text-emerald-400 mt-0.5" />
          <span>
            Server-side verified: Student basic information is validated strictly on the server and permanently bound to your 17-digit birth certificate admission record upon payment.
          </span>
        </div>
      </div>
    </Dialog>
  );
}
