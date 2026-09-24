'use client'

import { useEffect, useMemo, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { ccgApi, fieldErrors } from '@/lib/ccg/client'
import { message } from '@/lib/toast'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { Textarea } from '@/components/ui/textarea'
import { Field, NullableSelect } from './form-utils'
import { QuestionFields, missingRequired, type Answers } from './QuestionFields'
import { ccfLabel, useCcgOptions, type PersonDTO } from './people-types'

type Mode = { kind: 'member' | 'convert'; personId?: string }

interface Core {
  first_name: string
  middle_name: string | null
  last_name: string
  phone: string | null
  email: string | null
  gender: string | null
  date_of_birth: string | null
  landmark: string | null
  notes: string | null
  ccf_id: string | null
  stream_id: string | null
  conversion_date: string | null
  existing_connection_note: string | null
}

const EMPTY: Core = {
  first_name: '',
  middle_name: null,
  last_name: '',
  phone: null,
  email: null,
  gender: null,
  date_of_birth: null,
  landmark: null,
  notes: null,
  ccf_id: null,
  stream_id: null,
  conversion_date: null,
  existing_connection_note: null,
}

/**
 * Register a convert or member, or edit one. A new convert is matched straight
 * away; the toast says which CCF was proposed.
 */
export function PersonFormDialog({
  mode,
  onClose,
  onSaved,
}: {
  mode: Mode | null
  onClose: () => void
  onSaved: (personId: string) => void
}) {
  const opts = useCcgOptions()
  const [core, setCore] = useState<Core>(EMPTY)
  const [answers, setAnswers] = useState<Answers>({})
  const [errors, setErrors] = useState<Record<string, string | undefined>>({})
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const editing = !!mode?.personId
  const kind = mode?.kind ?? 'convert'
  const fullName = [core.first_name, core.middle_name, core.last_name].filter((x) => x?.trim()).join(' ')

  useEffect(() => {
    if (!mode) return
    setErrors({})
    if (!mode.personId) {
      setCore(EMPTY)
      setAnswers({})
      return
    }
    setLoading(true)
    ccgApi.get<{ person: PersonDTO }>(`/people/${mode.personId}`).then((r) => {
      setLoading(false)
      if (!r.ok) return message.error(r.error.message)
      const p = r.data.person
      setCore({
        first_name: p.first_name,
        middle_name: p.middle_name,
        last_name: p.last_name ?? '',
        phone: p.phone,
        email: p.email,
        gender: p.gender,
        date_of_birth: p.date_of_birth,
        landmark: p.landmark,
        notes: p.notes,
        ccf_id: p.ccf?.id ?? null,
        stream_id: p.stream?.id ?? null,
        conversion_date: p.conversion_date,
        existing_connection_note: p.existing_connection_note,
      })
      setAnswers(p.answers ?? {})
    })
  }, [mode])

  const questions = useMemo(
    () => (opts?.questions ?? []).filter((q) => q.active && (q.audience === 'both' || q.audience === kind)),
    [opts, kind]
  )
  const activeCcfs = (opts?.ccfs ?? []).filter((f) => f.status === 'active' && f.ccg.status === 'active')
  const set = <K extends keyof Core>(k: K, v: Core[K]) => setCore((c) => ({ ...c, [k]: v }))
  const text = (k: keyof Core) => ({
    value: (core[k] as string | null) ?? '',
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => set(k, (e.target.value || null) as Core[typeof k]),
  })

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    const local: Record<string, string> = {}
    if (!core.first_name.trim()) local.first_name = 'Enter their first name'
    if (!core.last_name.trim()) local.last_name = 'Enter their last name'
    if (kind === 'member' && !core.ccf_id) local.ccf_id = 'Choose their CCF'
    // Members may become leaders: SMS goes to their phone, invitations to their email.
    if (kind === 'member' && !core.phone) local.phone = 'Enter their phone number'
    if (core.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(core.email)) local.email = 'Enter a valid email address'
    Object.assign(local, missingRequired(questions, answers))
    setErrors(local)
    if (Object.keys(local).length) return

    const { ccf_id, stream_id, conversion_date, existing_connection_note, ...shared } = core
    const body = {
      ...shared,
      ...(kind === 'member' ? (editing ? {} : { ccf_id }) : { stream_id, conversion_date, existing_connection_note }),
      answers,
    }
    setSaving(true)
    const res = editing
      ? await ccgApi.patch<{ id: string; proposal: { ccf_id: string | null; status: string } | null }>(`/people/${mode!.personId}`, body)
      : await ccgApi.post<{ id: string; proposal: { ccf_id: string | null; status: string; hold_reason: string | null } | null }>('/people', {
          kind,
          ...body,
        })
    setSaving(false)
    if (!res.ok) {
      setErrors({ ...fieldErrors(res.error), ...(res.error.details?.answers ?? {}) })
      return message.error(res.error.message)
    }
    const proposed = res.data.proposal
    const ccf = proposed?.ccf_id ? opts?.ccfs.find((f) => f.id === proposed.ccf_id) : null
    message.success(
      editing
        ? proposed
          ? `Saved and re-matched${ccf ? `: ${ccf.name} proposed` : ''}`
          : 'Saved'
        : kind === 'member'
          ? `${fullName} added`
          : ccf
            ? `${fullName} registered. Proposed: ${ccf.name}`
            : `${fullName} registered and put on hold: no CCF fits yet`
    )
    onSaved(res.data.id)
    onClose()
  }

  return (
    <Dialog open={!!mode} onOpenChange={(o) => !o && !saving && onClose()}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-2xl">
        <form onSubmit={submit} className="space-y-6" noValidate>
          <DialogHeader>
            <DialogTitle>
              {editing ? `Edit ${fullName || (kind === 'member' ? 'member' : 'convert')}` : kind === 'member' ? 'Add a member' : 'Register a convert'}
            </DialogTitle>
            <DialogDescription>
              {kind === 'convert'
                ? 'Their answers are used to propose the CCF where they are most likely to settle. The proposal goes to Approvals.'
                : 'Members’ answers shape their CCF’s profile, which new converts are matched against.'}
            </DialogDescription>
          </DialogHeader>

          {!opts || loading ? (
            <div className="space-y-3">
              <Skeleton className="h-10" />
              <Skeleton className="h-10" />
              <Skeleton className="h-40" />
            </div>
          ) : (
            <>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="grid gap-4 sm:col-span-2 sm:grid-cols-3">
                  <Field label="First name *" htmlFor="p-first" error={errors.first_name}>
                    <Input
                      id="p-first"
                      autoComplete="off"
                      value={core.first_name}
                      onChange={(e) => set('first_name', e.target.value)}
                      aria-invalid={!!errors.first_name}
                    />
                  </Field>
                  <Field label="Middle name" htmlFor="p-middle" error={errors.middle_name}>
                    <Input id="p-middle" autoComplete="off" {...text('middle_name')} />
                  </Field>
                  <Field label="Last name *" htmlFor="p-last" error={errors.last_name}>
                    <Input
                      id="p-last"
                      autoComplete="off"
                      value={core.last_name}
                      onChange={(e) => set('last_name', e.target.value)}
                      aria-invalid={!!errors.last_name}
                    />
                  </Field>
                </div>
                <Field label={kind === 'member' ? 'Phone *' : 'Phone'} htmlFor="p-phone" error={errors.phone}>
                  <Input id="p-phone" type="tel" inputMode="tel" autoComplete="off" {...text('phone')} aria-invalid={!!errors.phone} />
                </Field>
                <Field
                  label="Email"
                  htmlFor="p-email"
                  error={errors.email}
                  hint={kind === 'member' ? 'If they are given a role, their invitation to set a password is sent here' : undefined}
                >
                  <Input id="p-email" type="email" inputMode="email" autoComplete="off" {...text('email')} aria-invalid={!!errors.email} />
                </Field>
                <Field label="Gender" htmlFor="p-gender">
                  <NullableSelect
                    id="p-gender"
                    value={core.gender}
                    onChange={(v) => set('gender', v)}
                    options={[
                      { value: 'Male', label: 'Male' },
                      { value: 'Female', label: 'Female' },
                    ]}
                  />
                </Field>
                <Field label="Date of birth" htmlFor="p-dob" error={errors.date_of_birth} hint="Used for age fit and the under-18 safeguard">
                  <Input id="p-dob" type="date" {...text('date_of_birth')} />
                </Field>
                <Field label="Nearest landmark" htmlFor="p-landmark">
                  <Input id="p-landmark" {...text('landmark')} />
                </Field>

                {kind === 'member' && !editing && (
                  <Field label="CCF *" htmlFor="p-ccf" error={errors.ccf_id}>
                    <NullableSelect
                      id="p-ccf"
                      value={core.ccf_id}
                      onChange={(v) => set('ccf_id', v)}
                      options={activeCcfs.map((f) => ({ value: f.id, label: ccfLabel(f) }))}
                      placeholder="Choose a CCF"
                      noneLabel="Choose a CCF"
                    />
                  </Field>
                )}
                {kind === 'convert' && (
                  <>
                    <Field
                      label="Stream"
                      htmlFor="p-stream"
                      error={errors.stream_id}
                      hint="They are matched only with CCFs in this stream"
                    >
                      <NullableSelect
                        id="p-stream"
                        value={core.stream_id}
                        onChange={(v) => set('stream_id', v)}
                        options={opts.streams.map((s) => ({ value: s.id, label: s.name }))}
                        noneLabel="Church-wide"
                      />
                    </Field>
                    <Field label="Date of conversion" htmlFor="p-conv">
                      <Input id="p-conv" type="date" {...text('conversion_date')} />
                    </Field>
                    <Field label="Someone they already know in church" htmlFor="p-conn" className="space-y-1.5 sm:col-span-2">
                      <Input id="p-conn" placeholder="Name, and how they know them" {...text('existing_connection_note')} />
                    </Field>
                  </>
                )}
                <Field label="Notes" htmlFor="p-notes" className="space-y-1.5 sm:col-span-2">
                  <Textarea id="p-notes" rows={2} {...text('notes')} />
                </Field>
              </div>

              {questions.length > 0 && (
                <div className="space-y-2 border-t pt-4">
                  <h3 className="font-medium">Profile questions</h3>
                  <QuestionFields questions={questions} answers={answers} onChange={setAnswers} errors={errors} disabled={saving} />
                </div>
              )}
            </>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose} disabled={saving}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving || !opts || loading}>
              {saving && <Loader2 className="size-4 animate-spin" />}
              {editing ? 'Save' : kind === 'member' ? 'Add member' : 'Register'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
