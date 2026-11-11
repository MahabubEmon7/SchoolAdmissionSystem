import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';

interface CancelDialogProps {
  open: boolean;
  classTitle: string;
  cancelling: boolean;
  waitlisted?: boolean;
  onClose: () => void;
  onConfirm: () => void;
}

export function CancelDialog({ open, classTitle, cancelling, waitlisted, onClose, onConfirm }: CancelDialogProps) {
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={waitlisted ? 'Leave Waitlist' : 'Cancel Application'}
      footer={
        <div className="flex gap-2">
          <Button type="button" variant="outline" onClick={onClose} disabled={cancelling}>
            Keep Hold
          </Button>
          <Button type="button" variant="destructive" onClick={onConfirm} loading={cancelling}>
            {waitlisted ? 'Leave Waitlist' : 'Cancel Application'}
          </Button>
        </div>
      }
    >
      <div className="space-y-2 text-sm text-slate-300 [overscroll-behavior:contain]">
        {waitlisted ? (
          <p>
            You will lose your queue position for <strong className="text-white">{classTitle}</strong>. You can
            then apply to a different class.
          </p>
        ) : (
          <p>
            Your held seat in <strong className="text-white">{classTitle}</strong> will immediately go to the next student
            on the waitlist, or back to open vacancies.
          </p>
        )}
      </div>
    </Dialog>
  );
}
