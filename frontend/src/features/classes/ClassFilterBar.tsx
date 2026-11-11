import { Search, X, SlidersHorizontal, Sun, Moon } from 'lucide-react';
import { GRADES, type ClassFilters, type ClassShift } from '../../lib/types';
import { cn } from '../../lib/format';
import { Button } from '@/components/ui/button';

interface ClassFilterBarProps {
  filters: ClassFilters;
  onChange: (filters: ClassFilters) => void;
  resultCount: number;
}

export function ClassFilterBar({ filters, onChange, resultCount }: ClassFilterBarProps) {
  const hasActiveFilters =
    Boolean(filters.grade) ||
    Boolean(filters.shift) ||
    Boolean(filters.availableOnly) ||
    Boolean(filters.search?.trim());

  const handleSearchChange = (search: string) => {
    onChange({ ...filters, search: search || undefined });
  };

  const handleGradeChange = (gradeStr: string) => {
    const grade = gradeStr ? Number.parseInt(gradeStr, 10) : undefined;
    onChange({ ...filters, grade });
  };

  const handleShiftSelect = (shift?: ClassShift) => {
    onChange({ ...filters, shift });
  };

  const handleToggleAvailable = () => {
    onChange({ ...filters, availableOnly: !filters.availableOnly });
  };

  const handleClearFilters = () => {
    onChange({});
  };

  return (
    <div className="space-y-3 rounded-xl border border-slate-800 bg-slate-900/60 p-3.5 backdrop-blur-sm sm:p-4">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        {/* Search Input */}
        <div className="relative flex-1">
          <label htmlFor="class-search" className="sr-only">
            Search classes
          </label>
          <Search
            className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-500 pointer-events-none"
            aria-hidden="true"
          />
          <input
            id="class-search"
            name="classSearch"
            value={filters.search ?? ''}
            onChange={(e) => handleSearchChange(e.target.value)}
            placeholder="Search classes (e.g. Class 1, Morning)…"
            autoComplete="off"
            spellCheck={false}
            className="h-9 w-full rounded-lg border border-slate-800 bg-slate-950/80 pl-9 pr-8 text-xs text-white placeholder:text-slate-500 focus:border-sky-500/50 focus:outline-none focus:ring-2 focus:ring-sky-500/20 transition-colors duration-150"
          />
          {filters.search && (
            <button
              type="button"
              onClick={() => handleSearchChange('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
              aria-label="Clear search"
            >
              <X className="size-3.5" />
            </button>
          )}
        </div>

        {/* Grade Selector & Available Toggle */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Grade Dropdown */}
          <div className="relative">
            <label htmlFor="grade-select" className="sr-only">
              Filter by Grade
            </label>
            <select
              id="grade-select"
              name="gradeSelect"
              value={filters.grade ?? ''}
              onChange={(e) => handleGradeChange(e.target.value)}
              className="h-9 rounded-lg border border-slate-800 bg-slate-950/80 px-3 text-xs text-slate-200 focus:border-sky-500/50 focus:outline-none focus:ring-2 focus:ring-sky-500/20 transition-colors duration-150"
            >
              <option value="">All Grades (1–12)</option>
              {GRADES.map((g) => (
                <option key={g} value={g}>
                  Grade {g}
                </option>
              ))}
            </select>
          </div>

          {/* Available Only Toggle */}
          <button
            type="button"
            onClick={handleToggleAvailable}
            className={cn(
              'flex h-9 items-center gap-1.5 rounded-lg border px-3 text-xs font-medium transition-colors duration-150',
              filters.availableOnly
                ? 'border-emerald-500/50 bg-emerald-950/40 text-emerald-300'
                : 'border-slate-800 bg-slate-950/60 text-slate-400 hover:text-white hover:border-slate-700',
            )}
            aria-pressed={Boolean(filters.availableOnly)}
          >
            <span
              className={cn(
                'size-2 rounded-full',
                filters.availableOnly ? 'bg-emerald-400' : 'bg-slate-600',
              )}
              aria-hidden="true"
            />
            Available Only
          </button>
        </div>
      </div>

      {/* Shifts Bar & Clear Action */}
      <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-800/60">
        <div className="flex items-center gap-1.5">
          <span className="text-[11px] font-medium text-slate-400 flex items-center gap-1 mr-1">
            <SlidersHorizontal className="size-3" aria-hidden="true" />
            Shift:
          </span>

          <button
            type="button"
            onClick={() => handleShiftSelect(undefined)}
            className={cn(
              'h-7 rounded-md px-2.5 text-xs font-medium transition-colors duration-150',
              !filters.shift
                ? 'bg-sky-500/20 text-sky-300 border border-sky-500/40'
                : 'text-slate-400 hover:text-white hover:bg-slate-800/60',
            )}
          >
            All Shifts
          </button>

          <button
            type="button"
            onClick={() => handleShiftSelect('MORNING')}
            className={cn(
              'h-7 flex items-center gap-1 rounded-md px-2.5 text-xs font-medium transition-colors duration-150',
              filters.shift === 'MORNING'
                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                : 'text-slate-400 hover:text-white hover:bg-slate-800/60',
            )}
          >
            <Sun className="size-3" aria-hidden="true" />
            Morning Shift
          </button>

          <button
            type="button"
            onClick={() => handleShiftSelect('DAY')}
            className={cn(
              'h-7 flex items-center gap-1 rounded-md px-2.5 text-xs font-medium transition-colors duration-150',
              filters.shift === 'DAY'
                ? 'bg-blue-500/20 text-blue-300 border border-blue-500/40'
                : 'text-slate-400 hover:text-white hover:bg-slate-800/60',
            )}
          >
            <Moon className="size-3" aria-hidden="true" />
            Day Shift
          </button>
        </div>

        <div className="flex items-center gap-3">
          <span className="text-xs text-slate-400 tabular-nums">
            {resultCount === 1 ? '1 class matching' : `${resultCount} classes matching`}
          </span>

          {hasActiveFilters && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={handleClearFilters}
              className="h-7 text-xs text-rose-400 hover:text-rose-300 hover:bg-rose-950/30 px-2"
            >
              <X className="size-3 mr-1" aria-hidden="true" />
              Reset filters
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

