import { useState, useEffect, type FormEvent } from 'react';
import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/field';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { useUpdateClassSeats } from '../../hooks/useAdmissions';
import type { SchoolClass } from '../../lib/types';
import { pluralize } from '../../lib/format';
import { AlertCircle, ArrowUpRight, Users } from 'lucide-react';

interface EditClassSeatsDialogProps {
  schoolClass: SchoolClass | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function EditClassSeatsDialog({ schoolClass, open, onOpenChange }: EditClassSeatsDialogProps) {
  const [totalSeats, setTotalSeats] = useState('');
  const [error, setError] = useState<string | null>(null);
  const updateSeats = useUpdateClassSeats();

  useEffect(() => {
    if (schoolClass && open) {
      setTotalSeats(String(schoolClass.totalSeats));
      setError(null);
    }
  }, [schoolClass, open]);

  if (!schoolClass) return null;

  const minAllowed = schoolClass.confirmedSeats + schoolClass.heldSeats;

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    const newSeats = Number(totalSeats);
    if (!Number.isInteger(newSeats) || newSeats < 1) {
      setError('Enter a valid whole number of seats (at least 1).');
      return;
    }
    if (newSeats < schoolClass.confirmedSeats) {
      setError(`Cannot reduce capacity to ${newSeats} seats because ${schoolClass.confirmedSeats} confirmed enrollments exist.`);
      return;
    }
    if (newSeats < minAllowed) {
      setError(`Cannot reduce capacity below occupied seats (${minAllowed} seats: ${schoolClass.confirmedSeats} confirmed + ${schoolClass.heldSeats} held).`);
      return;
    }

    updateSeats.mutate(
      { classId: schoolClass.id, totalSeats: newSeats },
      {
        onSuccess: () => {
          onOpenChange(false);
        },
        onError: (err: any) => {
          setError(err?.message || 'Server rejected seat capacity update.');
        },
      },
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md bg-slate-900 border-slate-800 text-white">
        <form onSubmit={handleSubmit}>
          <DialogHeader className="space-y-1.5">
            <DialogTitle className="text-base font-semibold text-white flex items-center gap-2">
              <Users className="size-4 text-sky-400" aria-hidden="true" />
              Edit Class Capacity
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-400">
              Update seat allocation for <span className="font-semibold text-white">{schoolClass.name}</span>.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* Current Occupancy Metrics */}
            <div className="grid grid-cols-3 gap-2 rounded-lg border border-slate-800/80 bg-slate-950/60 p-3 text-center text-xs">
              <div>
                <span className="text-slate-400 block text-[11px]">Confirmed</span>
                <span className="font-semibold text-emerald-400 tabular-nums">
                  {pluralize(schoolClass.confirmedSeats, 'seat', 'seats')}
                </span>
              </div>
              <div>
                <span className="text-slate-400 block text-[11px]">Held</span>
                <span className="font-semibold text-amber-400 tabular-nums">
                  {pluralize(schoolClass.heldSeats, 'seat', 'seats')}
                </span>
              </div>
              <div>
                <span className="text-slate-400 block text-[11px]">Current Total</span>
                <span className="font-semibold text-white tabular-nums">
                  {pluralize(schoolClass.totalSeats, 'seat', 'seats')}
                </span>
              </div>
            </div>

            {/* Total Seats Input */}
            <Field
              label="New Total Seat Capacity"
              name="newTotalSeats"
              id="new-total-seats"
              type="number"
              inputMode="numeric"
              min={Math.max(1, schoolClass.confirmedSeats)}
              max={100_000}
              value={totalSeats}
              onChange={(e) => {
                setTotalSeats(e.target.value);
                setError(null);
              }}
              error={error ?? undefined}
              hint={`Must be at least ${minAllowed || 1} seats to accommodate current enrollments.`}
            />

            {/* Server-side waitlist note */}
            {schoolClass.waitlistCount > 0 && (
              <div className="flex items-start gap-2 rounded-lg border border-sky-500/30 bg-sky-950/30 p-2.5 text-xs text-sky-200">
                <ArrowUpRight className="size-4 shrink-0 text-sky-400 mt-0.5" aria-hidden="true" />
                <span>
                  Increasing capacity will automatically promote{' '}
                  <strong className="text-white">
                    {pluralize(schoolClass.waitlistCount, 'applicant', 'applicants')}
                  </strong>{' '}
                  from the waitlist in fair queue order.
                </span>
              </div>
            )}

            {error && (
              <div
                role="alert"
                className="flex items-start gap-2 rounded-lg border border-rose-500/40 bg-rose-950/50 p-2.5 text-xs text-rose-200"
              >
                <AlertCircle className="size-4 shrink-0 text-rose-400 mt-0.5" aria-hidden="true" />
                <span className="leading-snug">{error}</span>
              </div>
            )}
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={updateSeats.isPending}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="default"
              loading={updateSeats.isPending}
            >
              Save Changes
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

