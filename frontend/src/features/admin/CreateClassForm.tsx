import { useState, useEffect, type FormEvent } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Field } from '@/components/ui/field';
import { Icon } from '@/components/ui/icon';
import { Select } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { useCreateClass, useSessions } from '../../hooks/useAdmissions';
import { CURRENT_ACADEMIC_YEAR, GRADES, type ClassShift, type SchoolClass } from '../../lib/types';
import { pluralize } from '../../lib/format';

const MAX_SEATS = 100_000;

const SHIFT_OPTIONS: Array<{ value: ClassShift; label: string; description: string }> = [
  { value: 'MORNING', label: 'Morning Shift', description: '7:30 AM – 12:00 PM' },
  { value: 'DAY', label: 'Day Shift', description: '12:30 PM – 5:00 PM' },
];

const FALLBACK_YEAR_OPTIONS = [
  { value: '2026', label: 'Academic Year 2026–2027 (Active Session)' },
  { value: '2027', label: 'Academic Year 2027–2028 (Upcoming Session)' },
  { value: '2025', label: 'Academic Year 2025–2026 (Historical)' },
];

function seatsError(seats: string) {
  const n = Number(seats);
  if (!seats) return 'Enter the number of seats.';
  if (!Number.isInteger(n) || n < 1 || n > MAX_SEATS)
    return `Use a whole number from 1 to ${MAX_SEATS.toLocaleString()}.`;
  return undefined;
}

interface CreateClassFormProps {
  existing: SchoolClass[];
  selectedYear?: number | 'ALL';
  onYearChange?: (year: number) => void;
}

/** Admin form: pick Class 1–12, Morning or Day shift, Academic Year, and seat count. Validated on server. */
export function CreateClassForm({
  existing,
  selectedYear: externalYear,
  onYearChange,
}: CreateClassFormProps) {
  const { data: sessionsList } = useSessions();
  const [grade, setGrade] = useState('');
  const [shift, setShift] = useState('');
  const [year, setYear] = useState(
    typeof externalYear === 'number' && externalYear > 0 ? String(externalYear) : String(CURRENT_ACADEMIC_YEAR),
  );
  const [seats, setSeats] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const create = useCreateClass();

  useEffect(() => {
    if (typeof externalYear === 'number' && externalYear > 0) {
      setYear(String(externalYear));
    }
  }, [externalYear]);

  const dynamicYearOptions = sessionsList?.map((s) => ({
    value: String(s.academicYear),
    label: `${s.title} (${s.status})`,
  })) ?? FALLBACK_YEAR_OPTIONS;

  const selectedYear = Number(year) || CURRENT_ACADEMIC_YEAR;
  const taken = (g: number, s: string) =>
    existing.some((c) => c.grade === g && c.shift === s && c.academicYear === selectedYear);
  const duplicate = grade !== '' && shift !== '' && taken(Number(grade), shift);

  const errors = {
    grade: submitted && !grade ? 'Choose a class grade.' : undefined,
    shift: submitted && !shift
      ? 'Choose a shift.'
      : duplicate
        ? `This class & shift already exists for Academic Year ${selectedYear}.`
        : undefined,
    seats: submitted ? seatsError(seats) : undefined,
  };

  const handleReset = () => {
    setGrade('');
    setShift('');
    setSeats('');
    setSubmitted(false);
  };

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    setSubmitted(true);
    if (!grade || !shift || duplicate || seatsError(seats)) return;

    create.mutate(
      {
        grade: Number(grade),
        shift: shift as ClassShift,
        totalSeats: Number(seats),
        academicYear: selectedYear,
      },
      {
        onSuccess: () => {
          handleReset();
        },
      },
    );
  };

  const previewName = grade && shift
    ? `Class ${grade} - ${shift === 'MORNING' ? 'Morning' : 'Day'} Shift`
    : null;

  return (
    <Card className="border-slate-800 bg-slate-900/70 shadow-lg">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base font-semibold text-white">Create New Class</CardTitle>
          <Badge tone="info" className="text-[11px]">
            Year {selectedYear}
          </Badge>
        </div>
        <CardDescription className="text-xs text-slate-400">
          Strict server-side validation. Classes are scoped per Academic Year with mandatory Morning or Day shift.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={onSubmit} noValidate className="space-y-4">
          <Select
            label="Academic Admission Year"
            value={year}
            onChange={(e) => {
              setYear(e.target.value);
              onYearChange?.(Number(e.target.value));
            }}
            options={dynamicYearOptions}
          />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Select
              label="Class Grade"
              value={grade}
              onChange={(e) => setGrade(e.target.value)}
              error={errors.grade}
              options={[
                { value: '', label: 'Select Grade…', disabled: true },
                ...GRADES.map((g) => ({ value: String(g), label: `Class ${g}` })),
              ]}
            />
            <Select
              label="Shift"
              value={shift}
              onChange={(e) => setShift(e.target.value)}
              error={errors.shift}
              options={[
                { value: '', label: 'Select Shift…', disabled: true },
                ...SHIFT_OPTIONS.map((s) => {
                  const exists = grade !== '' && taken(Number(grade), s.value);
                  return {
                    value: s.value,
                    label: exists ? `${s.label} (Exists)` : s.label,
                    disabled: exists,
                  };
                }),
              ]}
            />
          </div>

          <Field
            label="Total Seat Capacity"
            name="totalSeats"
            id="total-seats"
            type="number"
            inputMode="numeric"
            autoComplete="off"
            min={1}
            max={MAX_SEATS}
            placeholder="e.g. 120…"
            value={seats}
            onChange={(e) => setSeats(e.target.value)}
            error={errors.seats}
            hint="Maximum seats allocated for admissions. Verified strictly on the server."
          />

          {previewName && !duplicate && (
            <div className="rounded-lg border border-slate-800 bg-slate-950/40 p-2.5 text-xs flex items-center justify-between">
              <div>
                <span className="text-slate-400">Preview: </span>
                <span className="font-semibold text-white">{previewName}</span>
                <span className="text-slate-500 text-[11px] ml-1">({selectedYear})</span>
              </div>
              {seats && (
                <span className="text-emerald-400 font-medium">
                  {pluralize(Number(seats) || 0, 'seat', 'seats')}
                </span>
              )}
            </div>
          )}

          <div className="flex gap-2 pt-1">
            <Button
              type="submit"
              className="flex-1"
              variant="default"
              loading={create.isPending}
              disabled={duplicate || (submitted && (!grade || !shift || Boolean(seatsError(seats))))}
            >
              <Icon name="plus" className="size-4 mr-1.5" aria-hidden="true" /> Create Class
            </Button>
            {(grade || seats || shift) && (
              <Button type="button" variant="outline" onClick={handleReset} disabled={create.isPending}>
                Clear
              </Button>
            )}
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
