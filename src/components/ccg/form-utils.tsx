'use client'

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
