'use client'

import { Check } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { TraitScale } from '@/components/ccg/TraitScale'

/**
 * Renders profile questions from the question bank, grouped by section. Used by
 * the staff registration dialog and the public self-registration page, so both
 * collect exactly what the matching engine reads.
 */

export interface FormQuestion {
  key: string
  prompt: string
  help: string | null
  section: string | null
  type: 'single' | 'multi' | 'scale5' | 'text' | string
  max_choices: number | null
  required: boolean
  /** catch_all: an "Other" option; choosing it asks what they meant. */
  options: Array<{ key: string; label: string; catch_all?: boolean }>
}

export type AnswerValue = string | string[] | number
/** Question key → answer; `<key>__other` holds what was typed after choosing "Other". */
export type Answers = Record<string, AnswerValue>

export const OTHER_SUFFIX = '__other'

/** "1 = not at all, 5 = very" → ["Not at all", "Very"]. */
function scaleEnds(help: string | null): [string, string] {
  const m = help?.match(/1\s*=\s*([^,]+),\s*5\s*=\s*(.+)/)
  const cap = (s: string) => s.trim().replace(/^./, (c) => c.toUpperCase())
  return m ? [cap(m[1]), cap(m[2])] : ['Low', 'High']
}

function Chips({
  q,
  value,
  onChange,
  disabled,
}: {
  q: FormQuestion
  value: string[]
  onChange: (v: string[]) => void
  disabled?: boolean
}) {
  const single = q.type === 'single'
  const max = single ? 1 : q.max_choices ?? undefined
  const atMax = max !== undefined && value.length >= max
  const toggle = (key: string) => {
    if (value.includes(key)) onChange(value.filter((v) => v !== key))
    else if (single) onChange([key])
    else if (!atMax) onChange([...value, key])
  }
  return (
    <div className="space-y-1.5">
      <div role={single ? 'radiogroup' : 'group'} aria-label={q.prompt} className="flex flex-wrap gap-2">
        {q.options.map((o) => {
          const selected = value.includes(o.key)
          const unavailable = !selected && !single && atMax
          return (
            <button
              key={o.key}
              type="button"
              role={single ? 'radio' : undefined}
              aria-checked={single ? selected : undefined}
              aria-pressed={single ? undefined : selected}
              disabled={disabled || unavailable}
              onClick={() => toggle(o.key)}
              className={cn(
                'inline-flex min-h-9 items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm transition-colors',
                'focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none',
                selected ? 'border-primary bg-primary/10 text-primary' : 'border-border bg-card text-foreground hover:bg-accent',
                unavailable && 'opacity-40'
              )}
            >
              {selected && <Check className="size-3.5" aria-hidden />}
              {o.label}
            </button>
          )
        })}
      </div>
      {!single && max !== undefined && (
        <p className="text-xs text-muted-foreground">
          {value.length} of {max} chosen
        </p>
      )}
    </div>
  )
}

export function QuestionField({
  q,
  value,
  onChange,
  error,
  disabled,
  other,
  onOtherChange,
  aiKeys,
}: {
  q: FormQuestion
  value: AnswerValue | undefined
  onChange: (v: AnswerValue | undefined) => void
  error?: string
  disabled?: boolean
  /** What they typed after choosing "Other". */
  other?: string
  onOtherChange?: (v: string | undefined) => void
  /** Options the AI added from that text (marked as such). */
  aiKeys?: string[]
}) {
  const label = (
    <span>
      {q.prompt}
      {q.required && <span className="text-destructive"> *</span>}
    </span>
  )

  let control: React.ReactNode
  if (q.type === 'scale5') {
    const [low, high] = scaleEnds(q.help)
    return (
      <div className="space-y-1">
        <TraitScale
          label={q.prompt + (q.required ? ' *' : '')}
          low={low}
          high={high}
          value={typeof value === 'number' ? value : null}
          onChange={(v) => onChange(v ?? undefined)}
          disabled={disabled}
        />
        {error && <p className="text-xs text-destructive">{error}</p>}
      </div>
    )
  }
  if (q.type === 'single' || q.type === 'multi') {
    const current = Array.isArray(value) ? value : typeof value === 'string' ? [value] : []
    const otherChosen = q.options.some((o) => o.catch_all && current.includes(o.key))
    const aiLabels = (aiKeys ?? []).filter((k) => current.includes(k)).map((k) => q.options.find((o) => o.key === k)?.label ?? k)
    control = (
      <>
        <Chips
          q={q}
          value={current}
          disabled={disabled}
          onChange={(v) => onChange(v.length === 0 ? undefined : q.type === 'single' ? v[0] : v)}
        />
        {otherChosen && onOtherChange && (
          <Input
            aria-label={`${q.prompt}: tell us more`}
            placeholder="Tell us more (optional)"
            maxLength={200}
            value={other ?? ''}
            disabled={disabled}
            onChange={(e) => onOtherChange(e.target.value || undefined)}
          />
        )}
        {aiLabels.length > 0 && (
          <p className="text-xs text-muted-foreground">Added from what they typed: {aiLabels.join(', ')}</p>
        )}
      </>
    )
  } else {
    control = (
      <Textarea
        id={`q-${q.key}`}
        rows={2}
        value={typeof value === 'string' ? value : ''}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value.trim() ? e.target.value : undefined)}
      />
    )
  }

  return (
    <fieldset className="space-y-2" disabled={disabled}>
      <legend className="text-sm font-medium">{label}</legend>
      {q.help && q.type !== 'scale5' && <p className="text-xs text-muted-foreground">{q.help}</p>}
      {control}
      {error && <p className="text-xs text-destructive">{error}</p>}
    </fieldset>
  )
}

/** All questions, grouped under their section headings. */
export function QuestionFields({
  questions,
  answers,
  onChange,
  errors = {},
  disabled,
  aiKeys,
}: {
  questions: FormQuestion[]
  answers: Answers
  onChange: (next: Answers) => void
  errors?: Record<string, string | undefined>
  disabled?: boolean
  /** Per question, options the AI added from "Other" text. */
  aiKeys?: Record<string, string[]>
}) {
  const sections: Array<{ name: string; items: FormQuestion[] }> = []
  for (const q of questions) {
    const name = q.section ?? 'About you'
    const s = sections.find((x) => x.name === name)
    if (s) s.items.push(q)
    else sections.push({ name, items: [q] })
  }
  const set = (key: string, v: AnswerValue | undefined) => {
    const next = { ...answers }
    if (v === undefined) delete next[key]
    else next[key] = v
    // "Other" text only while "Other" is chosen.
    const q = questions.find((x) => x.key === key)
    const chosen = Array.isArray(v) ? v : typeof v === 'string' ? [v] : []
    if (q && !q.options.some((o) => o.catch_all && chosen.includes(o.key))) delete next[key + OTHER_SUFFIX]
    onChange(next)
  }

  return (
    <div className="space-y-6">
      {sections.map((s) => (
        <section key={s.name} className="space-y-4">
          <h3 className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">{s.name}</h3>
          {s.items.map((q) => (
            <QuestionField
              key={q.key}
              q={q}
              value={answers[q.key]}
              onChange={(v) => set(q.key, v)}
              other={typeof answers[q.key + OTHER_SUFFIX] === 'string' ? (answers[q.key + OTHER_SUFFIX] as string) : undefined}
              onOtherChange={(v) => set(q.key + OTHER_SUFFIX, v)}
              aiKeys={aiKeys?.[q.key]}
              error={errors[q.key]}
              disabled={disabled}
            />
          ))}
        </section>
      ))}
    </div>
  )
}

/** Required questions left unanswered, as field errors. */
export function missingRequired(questions: FormQuestion[], answers: Answers): Record<string, string> {
  const out: Record<string, string> = {}
  for (const q of questions) if (q.required && answers[q.key] === undefined) out[q.key] = 'Please answer this question'
  return out
}
