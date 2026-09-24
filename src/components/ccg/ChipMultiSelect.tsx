'use client'

import { Check } from 'lucide-react'
import { cn } from '@/lib/utils'

/**
 * Toggle chips for picking several values from a closed list. Values not in
 * `options` (e.g. a since-deactivated vocab entry) stay visible so they can be
 * removed, but cannot be re-added.
 */
export function ChipMultiSelect({
  options,
  value,
  onChange,
  max,
  disabled,
  ariaLabel,
}: {
  options: string[]
  value: string[]
  onChange: (next: string[]) => void
  max?: number
  disabled?: boolean
  ariaLabel: string
}) {
  const legacy = value.filter((v) => !options.includes(v))
  const all = [...options, ...legacy]
  const atMax = max !== undefined && value.length >= max

  const toggle = (opt: string) => {
    if (value.includes(opt)) onChange(value.filter((v) => v !== opt))
    else if (!atMax) onChange([...value, opt])
  }

  return (
    <div className="space-y-1.5">
      <div role="group" aria-label={ariaLabel} className="flex flex-wrap gap-2">
        {all.map((opt) => {
          const selected = value.includes(opt)
          const unavailable = !selected && (atMax || legacy.includes(opt))
          return (
            <button
              key={opt}
              type="button"
              aria-pressed={selected}
              disabled={disabled || unavailable}
              onClick={() => toggle(opt)}
              className={cn(
                'inline-flex min-h-9 items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm transition-colors',
                'focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none',
                selected
                  ? 'border-primary bg-primary/10 text-primary'
                  : 'border-border bg-card text-foreground hover:bg-accent',
                unavailable && 'opacity-40',
                legacy.includes(opt) && 'line-through decoration-muted-foreground/60'
              )}
            >
              {selected && <Check className="size-3.5" aria-hidden />}
              {opt}
            </button>
          )
        })}
      </div>
      {max !== undefined && (
        <p className="text-xs text-muted-foreground">
          {value.length} of {max} chosen
        </p>
      )}
    </div>
  )
}
