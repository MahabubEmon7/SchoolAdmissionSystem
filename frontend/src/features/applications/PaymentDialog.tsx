import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { ShieldCheck } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { formatCountdown } from '../../lib/format';

interface PaymentDialogProps {
  open: boolean;
  classTitle: string;
  academicYear?: number;
  secondsLeft: number;
  paying: boolean;
  onClose: () => void;
  onComplete: () => void;
}

/**
 * Clean, stylish admission fee payment modal.
 * Confirms payment within the 10-minute hold window before official enrollment confirmation.
 */
export function PaymentDialog({
  open,
  classTitle,
  academicYear = 2026,
  secondsLeft,
  paying,
  onClose,
  onComplete,
}: PaymentDialogProps) {
  const expired = secondsLeft <= 0;

  const handleConfirm = () => {
    if (expired || paying) return;
    onComplete();
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
            disabled={expired}
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
              <span className="text-[11px] text-amber-400/80">Confirm payment before the deadline</span>
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

        {/* Security & Validation Notice */}
        <div className="rounded-lg border border-slate-800 bg-slate-950/40 p-2.5 flex items-start gap-2 text-[11px] text-slate-400 leading-relaxed">
          <ShieldCheck className="size-4 shrink-0 text-emerald-400 mt-0.5" />
          <span>
            Payment is verified securely and permanently binds your held seat to your admission record.
          </span>
        </div>
      </div>
    </Dialog>
  );
}
