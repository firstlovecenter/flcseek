'use client'

import { cn } from '@/lib/utils'

/** 1–5 self-rating as a segmented control. Clicking the chosen value clears it. */
export function TraitScale({
  label,
  low,
  high,
  value,
  onChange,
  disabled,
}: {
  label: string
  low: string
  high: string
  value: number | null
  onChange: (v: number | null) => void
  disabled?: boolean
}) {
  return (
    <fieldset className="space-y-2" disabled={disabled}>
      <legend className="text-sm font-medium">{label}</legend>
      <div className="flex items-center gap-2">
        <span className="hidden w-28 shrink-0 text-right text-xs text-muted-foreground sm:block">{low}</span>
        <div className="flex flex-1 gap-1.5">
          {[1, 2, 3, 4, 5].map((n) => {
            const selected = value === n
            return (
              <button
                key={n}
                type="button"
                aria-pressed={selected}
                aria-label={`${label}: ${n} of 5`}
                onClick={() => onChange(selected ? null : n)}
                className={cn(
                  'h-10 flex-1 rounded-md border text-sm font-medium tabular-nums transition-colors',
                  'focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none',
                  selected
                    ? 'border-primary bg-primary text-primary-foreground'
                    : 'border-border bg-card hover:bg-accent'
                )}
              >
                {n}
              </button>
            )
          })}
        </div>
        <span className="hidden w-28 shrink-0 text-xs text-muted-foreground sm:block">{high}</span>
      </div>
      <div className="flex justify-between text-xs text-muted-foreground sm:hidden">
        <span>{low}</span>
        <span>{high}</span>
      </div>
    </fieldset>
  )
}
