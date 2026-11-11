import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { useResetDatabase } from '../../hooks/useAdmissions';

interface ResetDbDialogProps {
  open: boolean;
  onClose: () => void;
}

export function ResetDbDialog({ open, onClose }: ResetDbDialogProps) {
  const [confirmText, setConfirmText] = useState('');
  const resetDb = useResetDatabase();

  const handleConfirm = () => {
    resetDb.mutate(undefined, {
      onSuccess: () => {
        setConfirmText('');
        onClose();
      },
    });
  };

  const handleClose = () => {
    setConfirmText('');
    onClose();
  };

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      title="Reset Entire Database"
      footer={
        <div className="flex gap-2">
          <Button type="button" variant="outline" onClick={handleClose} disabled={resetDb.isPending}>
            Cancel
          </Button>
          <Button
            type="button"
            variant="destructive"
            loading={resetDb.isPending}
            disabled={confirmText !== 'RESET'}
            onClick={handleConfirm}
          >
            Clear All Data
          </Button>
        </div>
      }
    >
      <div className="space-y-3 text-sm text-slate-300 [overscroll-behavior:contain]">
        <p className="text-rose-400 font-medium">
          Warning: This action will permanently erase all created classes, student applications, seat holds, and waitlist records.
        </p>
        <p className="text-slate-400 text-xs">
          The database and cache will be completely restored to an empty state.
        </p>
        <div className="pt-2">
          <label htmlFor="reset-confirm" className="block text-xs font-semibold text-slate-400 mb-1.5">
            Type <span className="text-white font-mono bg-slate-800 px-1.5 py-0.5 rounded">RESET</span> to confirm:
          </label>
          <input
            id="reset-confirm"
            name="resetConfirm"
            type="text"
            autoComplete="off"
            spellCheck={false}
            value={confirmText}
            onChange={(e) => setConfirmText(e.target.value)}
            placeholder="RESET"
            className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-1.5 text-sm text-white placeholder-slate-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-rose-500/50"
          />
        </div>
      </div>
    </Dialog>
  );
}
