'use client'

import { use, useEffect, useMemo, useState } from 'react'
import { CheckCircle2, Link2Off, Loader2 } from 'lucide-react'
import { ccgApi, fieldErrors } from '@/lib/ccg/client'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { Field, NullableSelect } from '@/components/ccg/form-utils'
import { QuestionFields, missingRequired, type Answers, type FormQuestion } from '@/components/ccg/QuestionFields'

/**
 * Public self-registration (no login). Opened from a CCF member link, a
 * convert intake link or QR code, or a personal update link.
 */

interface PublicForm {
  kind: 'member_ccf' | 'convert_intake' | 'person_update'
  title: string
  ccf: { name: string; ccg_name: string } | null
  fields: Array<{ key: string; label: string; type: string; required: boolean }>
  questions: FormQuestion[]
  prefill?: { person: Record<string, string | null>; answers: Answers }
}

type Person = Record<string, string | null>

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <main className="min-h-dvh bg-muted/30 px-4 py-8 sm:py-12">
      <div className="mx-auto w-full max-w-xl space-y-6">
        <p className="text-center text-sm font-semibold tracking-wide text-primary uppercase">City Church Group</p>
        {children}
      </div>
    </main>
  )
}

export default function JoinPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params)
  const [form, setForm] = useState<PublicForm | null>(null)
  const [gone, setGone] = useState(false)
  const [person, setPerson] = useState<Person>({})
  const [answers, setAnswers] = useState<Answers>({})
  const [errors, setErrors] = useState<Record<string, string | undefined>>({})
  const [formError, setFormError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [reference, setReference] = useState<string | null>(null)
  // One id per form fill: a retried submission is recognised, never duplicated.
  const submissionId = useMemo(() => crypto.randomUUID(), [])

  useEffect(() => {
    ccgApi.get<PublicForm>(`/public/forms/${encodeURIComponent(token)}`).then((r) => {
      if (!r.ok) return setGone(true)
      setForm(r.data)
      if (r.data.prefill) {
        setPerson(r.data.prefill.person)
        setAnswers(r.data.prefill.answers)
      }
    })
  }, [token])

  const setField = (key: string, v: string | null) => setPerson((p) => ({ ...p, [key]: v && v.trim() ? v : null }))

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form) return
    const missing: Record<string, string> = { ...missingRequired(form.questions, answers) }
    for (const f of form.fields) if (f.required && !person[f.key]) missing[f.key] = `${f.label} is required`
    setErrors(missing)
    if (Object.keys(missing).length) {
      setFormError('Please complete the highlighted questions.')
      return
    }
    setSaving(true)
    setFormError(null)
    const res = await ccgApi.post<{ ok: boolean; reference: string | null }>(`/public/forms/${encodeURIComponent(token)}`, {
      client_submission_id: submissionId,
      person,
      answers,
    })
    setSaving(false)
    if (!res.ok) {
      if (res.status === 404 || res.status === 410) return setGone(true)
      setErrors({ ...fieldErrors(res.error), ...(res.error.details?.answers ?? {}) })
      setFormError(res.error.message)
      return
    }
    setReference(res.data.reference ?? '')
  }

  if (gone) {
    return (
      <Shell>
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-10 text-center">
            <Link2Off className="size-8 text-muted-foreground" aria-hidden />
            <p className="font-semibold">This link is no longer valid</p>
            <p className="text-sm text-muted-foreground">It may have expired or been used up. Please ask the person who shared it for a new one.</p>
          </CardContent>
        </Card>
      </Shell>
    )
  }

  if (reference !== null) {
    return (
      <Shell>
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-10 text-center">
            <CheckCircle2 className="size-10 text-success" aria-hidden />
            <p className="text-lg font-semibold">Thank you!</p>
            <p className="text-sm text-muted-foreground">
              {form?.kind === 'person_update'
                ? 'Your details have been updated.'
                : form?.kind === 'member_ccf'
                  ? `Your details have been sent to ${form.ccf?.name ?? 'your CCF'}. Your coordinator will confirm you shortly.`
                  : 'We have received your details. Someone from church will be in touch soon.'}
            </p>
            {reference && <p className="text-xs text-muted-foreground">Reference: {reference}</p>}
          </CardContent>
        </Card>
      </Shell>
    )
  }

  if (!form) {
    return (
      <Shell>
        <Skeleton className="h-24 rounded-xl" />
        <Skeleton className="h-96 rounded-xl" />
      </Shell>
    )
  }

  return (
    <Shell>
      <form onSubmit={submit} className="space-y-6" noValidate>
        <Card>
          <CardHeader>
            <CardTitle className="text-xl">{form.title}</CardTitle>
            {form.ccf && (
              <CardDescription>
                {form.ccf.name} · {form.ccf.ccg_name}
              </CardDescription>
            )}
          </CardHeader>
          <CardContent className="space-y-4">
            {form.fields.map((f) => {
              const id = `f-${f.key}`
              const label = f.label + (f.required ? ' *' : '')
              const value = person[f.key] ?? null
              if (f.type === 'gender') {
                return (
                  <Field key={f.key} label={label} htmlFor={id} error={errors[f.key]}>
                    <NullableSelect
                      id={id}
                      value={value}
                      onChange={(v) => setField(f.key, v)}
                      options={[
                        { value: 'Male', label: 'Male' },
                        { value: 'Female', label: 'Female' },
                      ]}
                      placeholder="Choose"
                      noneLabel="Prefer not to say"
                    />
                  </Field>
                )
              }              return (
                <Field key={f.key} label={label} htmlFor={id} error={errors[f.key]}>
                  <Input
                    id={id}
                    type={f.type === 'date' || f.type === 'tel' || f.type === 'email' ? f.type : 'text'}
                    inputMode={f.type === 'tel' ? 'tel' : f.type === 'email' ? 'email' : undefined}
                    autoComplete={
                      ({ first_name: 'given-name', middle_name: 'additional-name', last_name: 'family-name' } as Record<string, string>)[f.key] ??
                      (f.type === 'tel' ? 'tel' : f.type === 'email' ? 'email' : undefined)
                    }
                    value={value ?? ''}
                    onChange={(e) => setField(f.key, e.target.value)}
                    aria-invalid={!!errors[f.key]}
                  />
                </Field>
              )
            })}
          </CardContent>
        </Card>

        {form.questions.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">About you</CardTitle>
              <CardDescription>This helps us connect you with people you will get on with.</CardDescription>
            </CardHeader>
            <CardContent>
              <QuestionFields questions={form.questions} answers={answers} onChange={setAnswers} errors={errors} disabled={saving} />
            </CardContent>
          </Card>
        )}

        {formError && <p className="text-sm text-destructive">{formError}</p>}
        <Button type="submit" size="lg" className="w-full" disabled={saving}>
          {saving && <Loader2 className="size-4 animate-spin" />}
          {form.kind === 'person_update' ? 'Save my details' : 'Send'}
        </Button>
      </form>
    </Shell>
  )
}
