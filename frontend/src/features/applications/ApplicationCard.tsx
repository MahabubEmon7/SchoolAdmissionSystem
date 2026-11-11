import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Icon } from '@/components/ui/icon';
import { Badge } from '@/components/ui/badge';
import { useCancelHold, useConfirmHold, useRefreshAdmissions } from '../../hooks/useAdmissions';
import { useCountdown } from '../../hooks/useCountdown';
import type { StudentHold } from '../../lib/types';
import { CancelDialog } from './CancelDialog';
import { Countdown } from './Countdown';
import { PaymentDialog } from './PaymentDialog';
import { StatusBadge } from './StatusBadge';
import { WaitlistNotice } from './WaitlistNotice';

type OpenDialog = 'pay' | 'cancel' | null;

const dateFormatter = new Intl.DateTimeFormat(undefined, {
  dateStyle: 'medium',
  timeStyle: 'short',
});

export function ApplicationCard({ hold }: { hold: StudentHold }) {
  const [dialog, setDialog] = useState<OpenDialog>(null);
  const refresh = useRefreshAdmissions();
  const confirm = useConfirmHold();
  const cancel = useCancelHold();

  // Count down locally; at zero the card flips to EXPIRED without waiting for the server.
  const secondsLeft = useCountdown(hold.expiresAt, hold.status === 'HELD', refresh);
  const status = hold.status === 'HELD' && secondsLeft === 0 ? 'EXPIRED' : hold.status;
  const isHeld = status === 'HELD';
  const isWaitlisted = status === 'WAITLISTED';
  const close = () => setDialog(null);

  return (
    <Card className="flex flex-col justify-between border-slate-800 bg-slate-900/60 p-5 shadow-sm hover:border-slate-700 transition-colors duration-150">
      <div className="space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <h3 className="font-semibold text-white text-base leading-snug">{hold.className}</h3>
            <div className="flex flex-wrap items-center gap-1.5 mt-0.5">
              <span className="text-xs text-slate-400">
                Applied {dateFormatter.format(new Date(hold.createdAt))}
              </span>
              <span className="text-slate-600">•</span>
              <Badge tone="neutral" className="text-[10px] px-1.5 py-0">
                Session {hold.academicYear}–{hold.academicYear + 1}
              </Badge>
            </div>
          </div>
          <StatusBadge status={status} position={isWaitlisted ? hold.waitlistPosition : null} />
        </div>

        {isHeld && <Countdown secondsLeft={secondsLeft} />}
        {isWaitlisted && <WaitlistNotice position={hold.waitlistPosition} />}

        {status === 'CONFIRMED' && (
          <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/10 p-3 text-xs text-emerald-300 flex items-center gap-2">
            <Icon name="check" className="size-4 shrink-0 text-emerald-400" aria-hidden="true" />
            <span>Admission fee confirmed. Your seat is officially secured.</span>
          </div>
        )}
        {status === 'EXPIRED' && (
          <p className="text-xs text-slate-400">The fee was not paid in time, so the held seat was released.</p>
        )}
      </div>

      <div className="mt-5 pt-3 border-t border-slate-800/60">
        {isWaitlisted && (
          <Button
            type="button"
            variant="destructive"
            className="w-full text-xs"
            onClick={() => setDialog('cancel')}
          >
            Leave Waitlist
          </Button>
        )}
        {(isHeld || status === 'EXPIRED') && (
          <div className="grid grid-cols-2 gap-2">
            <Button
              type="button"
              variant="outline"
              disabled={!isHeld}
              className="text-xs text-rose-400 hover:text-rose-300 hover:bg-rose-500/10"
              onClick={() => setDialog('cancel')}
            >
              Cancel Hold
            </Button>
            <Button
              type="button"
              disabled={!isHeld}
              className="text-xs"
              onClick={() => setDialog('pay')}
            >
              Pay Admission Fee
            </Button>
          </div>
        )}
      </div>

      <PaymentDialog
        open={dialog === 'pay'}
        classTitle={hold.className}
        academicYear={hold.academicYear}
        secondsLeft={secondsLeft}
        paying={confirm.isPending}
        onClose={close}
        onComplete={() =>
          confirm.mutate(
            { holdId: hold.holdId },
            { onSettled: close },
          )
        }
      />
      <CancelDialog
        open={dialog === 'cancel'}
        classTitle={hold.className}
        waitlisted={isWaitlisted}
        cancelling={cancel.isPending}
        onClose={close}
        onConfirm={() => cancel.mutate(hold.holdId, { onSettled: close })}
      />
    </Card>
  );
}
