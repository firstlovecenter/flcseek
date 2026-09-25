'use client'

import { useId, useMemo, useState } from 'react'
import * as Popover from '@radix-ui/react-popover'
import { Command } from 'cmdk'
import { Check, ChevronsUpDown, Search } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import type { APIResponse } from '@/lib/api'

export type FieldErrors = Record<string, string | undefined>

/** Pull zod fieldErrors (from errors.validation(…, flatten())) out of an API response. */
export function fieldErrorsFrom(res: APIResponse): FieldErrors {
  const details = res.error?.details as { fieldErrors?: Record<string, string[]> } | undefined
  const out: FieldErrors = {}
  for (const [k, v] of Object.entries(details?.fieldErrors ?? {})) out[k] = v?.[0]
  return out
}

export function Field({
  label,
  htmlFor,
  error,
  hint,
  children,
  className,
}: {
  label: string
  htmlFor?: string
  error?: string
  hint?: string
  children: React.ReactNode
  className?: string
}) {
  return (
    <div className={className ?? 'space-y-1.5'}>
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
      {error ? (
        <p className="text-xs text-destructive">{error}</p>
      ) : hint ? (
        <p className="text-xs text-muted-foreground">{hint}</p>
      ) : null}
    </div>
  )
}

const NONE = '__none'

/** Select that supports an empty (null) choice. */
export function NullableSelect({
  id,
  value,
  onChange,
  options,
  placeholder = 'Not set',
  noneLabel = 'Not set',
  disabled,
}: {
  id?: string
  value: string | null
  onChange: (v: string | null) => void
  options: Array<{ value: string; label: string }>
  placeholder?: string
  noneLabel?: string
  disabled?: boolean
}) {
  return (
    <Select
      value={value ?? NONE}
      onValueChange={(v) => onChange(v === NONE ? null : v)}
      disabled={disabled}
    >
      <SelectTrigger id={id} className="w-full">
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={NONE}>{noneLabel}</SelectItem>
        {options.map((o) => (
          <SelectItem key={o.value} value={o.value}>
            {o.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

/**
 * A dropdown for picking a group (stream, CCG, CCF…): options in alphabetical
 * order, with a search box. `search="auto"` shows the box only for longer
 * lists. Same value contract as NullableSelect (null = none).
 */
export function SearchSelect({
  id,
  value,
  onChange,
  options,
  placeholder = 'Choose',
  noneLabel,
  disabled,
  search = 'always',
  invalid,
}: {
  id?: string
  value: string | null
  onChange: (v: string | null) => void
  /** `hint` is searchable and shown under the label, e.g. the CCF's CCG. */
  options: Array<{ value: string; label: string; hint?: string }>
  placeholder?: string
  /** When given, a first option that clears the choice. */
  noneLabel?: string
  disabled?: boolean
  search?: 'always' | 'auto'
  invalid?: boolean
}) {
  const [open, setOpen] = useState(false)
  const listId = useId()
  const sorted = useMemo(() => [...options].sort((a, b) => a.label.localeCompare(b.label, undefined, { sensitivity: 'base' })), [options])
  const selected = options.find((o) => o.value === value)
  const showSearch = search === 'always' || options.length > 8

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger asChild disabled={disabled}>
        <button
          id={id}
          type="button"
          role="combobox"
          aria-expanded={open}
          aria-controls={listId}
          aria-invalid={invalid || undefined}
          className={cn(
            'flex h-9 w-full items-center justify-between gap-2 rounded-md border border-input bg-transparent px-3 py-2 text-left text-sm shadow-xs transition-[color,box-shadow]',
            'focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50',
            'aria-invalid:border-destructive dark:bg-input/30'
          )}
        >
          <span className={cn('truncate', !selected && 'text-muted-foreground')}>{selected?.label ?? (value === null && noneLabel ? noneLabel : placeholder)}</span>
          <ChevronsUpDown className="size-4 shrink-0 opacity-50" aria-hidden />
        </button>
      </Popover.Trigger>
      {/* Not portalled: it must scroll inside dialogs. */}
      <Popover.Content
        align="start"
        sideOffset={4}
        className="z-50 w-[var(--radix-popover-trigger-width)] min-w-56 overflow-hidden rounded-md border bg-popover text-popover-foreground shadow-md"
      >
        <Command loop>
          {showSearch && (
            <div className="flex items-center gap-2 border-b px-3">
              <Search className="size-4 shrink-0 opacity-50" aria-hidden />
              <Command.Input placeholder="Search…" className="h-10 w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground" />
            </div>
          )}
          <Command.List id={listId} className="max-h-64 overflow-y-auto p-1">
            <Command.Empty className="px-2 py-6 text-center text-sm text-muted-foreground">Nothing matches.</Command.Empty>
            {noneLabel && (
              <Command.Item
                value={`__none ${noneLabel}`}
                onSelect={() => {
                  onChange(null)
                  setOpen(false)
                }}
                className="flex cursor-pointer items-center gap-2 rounded-sm px-2 py-1.5 text-sm text-muted-foreground data-[selected=true]:bg-accent data-[selected=true]:text-accent-foreground"
              >
                <Check className={cn('size-4', value === null ? 'opacity-100' : 'opacity-0')} aria-hidden />
                {noneLabel}
              </Command.Item>
            )}
            {sorted.map((o) => (
              <Command.Item
                key={o.value}
                value={o.value}
                keywords={[o.label, o.hint ?? '']}
                onSelect={() => {
                  onChange(o.value)
                  setOpen(false)
                }}
                className="flex cursor-pointer items-start gap-2 rounded-sm px-2 py-1.5 text-sm data-[selected=true]:bg-accent data-[selected=true]:text-accent-foreground"
              >
                <Check className={cn('mt-0.5 size-4 shrink-0', value === o.value ? 'opacity-100' : 'opacity-0')} aria-hidden />
                <span className="min-w-0">
                  <span className="block truncate">{o.label}</span>
                  {o.hint && <span className="block truncate text-xs text-muted-foreground">{o.hint}</span>}
                </span>
              </Command.Item>
            ))}
          </Command.List>
        </Command>
      </Popover.Content>
    </Popover.Root>
  )
}
