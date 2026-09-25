'use client'

import { useCallback, useEffect, useState } from 'react'
import QRCode from 'qrcode'
import { Check, Copy, Download, Link2, Loader2, Plus, QrCode } from 'lucide-react'
import { ccgApi } from '@/lib/ccg/client'
import { message } from '@/lib/toast'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { Switch } from '@/components/ui/switch'
import { EmptyState } from '@/components/base/EmptyState'
import { ErrorScreen } from '@/components/base/ErrorScreen'
import { CcgPageHeader } from '@/components/ccg/PageHeader'
import { useCcgMe } from '@/components/ccg/CcgMeProvider'
import { Field, NullableSelect } from '@/components/ccg/form-utils'
import { ccfLabel, useCcgOptions, useSeekerOptions } from '@/components/ccg/people-types'

interface LinkRow {
  id: string
  kind: 'member_ccf' | 'convert_intake' | 'person_update'
  label: string | null
  ccf: { id: string; name: string; ccg: { name: string } } | null
  stream: { id: string; name: string } | null
  person: { id: string; full_name: string } | null
  seeker?: { id: string; full_name: string } | null
  state: 'active' | 'revoked' | 'expired' | 'used_up'
  expires_at: string | null
  max_uses: number | null
  uses: number
  created_at: string | null
}

const KIND_LABEL: Record<LinkRow['kind'], string> = {
  convert_intake: 'Convert registration',
  member_ccf: 'Member registration',
  person_update: 'Update details',
}
const STATE: Record<LinkRow['state'], { label: string; tone: 'success' | 'secondary' | 'warning' }> = {
  active: { label: 'Active', tone: 'success' },
  revoked: { label: 'Revoked', tone: 'secondary' },
  expired: { label: 'Expired', tone: 'secondary' },
  used_up: { label: 'Used up', tone: 'warning' },
}

const fmtDate = (s: string | null) => (s ? new Date(s).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' }) : null)

function linkTarget(l: LinkRow) {
  if (l.kind === 'convert_intake') return l.stream ? l.stream.name : 'Church-wide'
  if (l.kind === 'member_ccf') return l.ccf ? `${l.ccf.name} · ${l.ccf.ccg.name}` : '—'
  return l.person?.full_name ?? '—'
}

export default function CcgLinksPage() {
  const { has, loading: meLoading } = useCcgMe()
  const [links, setLinks] = useState<LinkRow[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [showInactive, setShowInactive] = useState(false)
  const [creating, setCreating] = useState(false)
  const [created, setCreated] = useState<{ link: LinkRow; url: string } | null>(null)
  const [revoking, setRevoking] = useState<string | null>(null)
  const canUse = has('links.manage') || has('links.intake')

  const load = useCallback(async () => {
    setLinks(null)
    const r = await ccgApi.get<{ links: LinkRow[] }>(`/links${showInactive ? '?include_inactive=1' : ''}`)
    if (!r.ok) return setError(r.error.message)
    setError(null)
    // The server leaves out revoked links; expired and used-up ones are hidden here too.
    setLinks(showInactive ? r.data.links : r.data.links.filter((l) => l.state === 'active'))
  }, [showInactive])

  useEffect(() => {
    if (canUse) load()
  }, [load, canUse])

  const revoke = async (l: LinkRow) => {
    setRevoking(l.id)
    const r = await ccgApi.del(`/links/${l.id}`)
    setRevoking(null)
    if (!r.ok) return message.error(r.error.message)
    message.success('Link revoked. It stops working immediately.')
    load()
  }

  if (!meLoading && !canUse) {
    return <EmptyState icon={Link2} title="Registration links" description="You don’t have access to registration links." className="mt-12" />
  }
  if (error) return <ErrorScreen title="Couldn’t load links" message={error} onRetry={load} />

  return (
    <div className="space-y-6">
      <CcgPageHeader
        title="Registration links"
        description="Share a link or QR code so converts and members can register themselves. Convert registrations are matched straight away."
        actions={
          <Button onClick={() => setCreating(true)}>
            <Plus className="size-4" />
            New link
          </Button>
        }
      />

      <label className="flex items-center gap-2 text-sm">
        <Switch checked={showInactive} onCheckedChange={setShowInactive} />
        Show revoked, expired and used-up links
      </label>

      {links === null ? (
        <div className="space-y-2">
          <Skeleton className="h-16 rounded-lg" />
          <Skeleton className="h-16 rounded-lg" />
        </div>
      ) : links.length === 0 ? (
        <EmptyState icon={QrCode} title="No links yet" description="Create a convert registration link for a service or event, and print its QR code." />
      ) : (
        <Card className="gap-0 overflow-hidden p-0">
          <ul className="divide-y">
            {links.map((l) => (
              <li key={l.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2 font-medium">
                    {l.label || KIND_LABEL[l.kind]}
                    <Badge variant={STATE[l.state].tone}>{STATE[l.state].label}</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {KIND_LABEL[l.kind]} · {linkTarget(l)}
                    {l.seeker && ` · ${l.seeker.full_name}’s converts`} · {l.uses}
                    {l.max_uses ? ` of ${l.max_uses}` : ''} used
                    {l.expires_at && ` · expires ${fmtDate(l.expires_at)}`}
                  </p>
                </div>
                {l.state === 'active' && (
                  <Button size="sm" variant="ghost" onClick={() => revoke(l)} disabled={revoking === l.id}>
                    {revoking === l.id && <Loader2 className="size-4 animate-spin" />}
                    Revoke
                  </Button>
                )}
              </li>
            ))}
          </ul>
        </Card>
      )}

      <p className="text-xs text-muted-foreground">
        For security a link’s address is shown only once, when it is created. If you lose it, revoke the link and create a new one.
      </p>

      {creating && (
        <CreateLinkDialog
          onClose={() => setCreating(false)}
          onCreated={(c) => {
            setCreating(false)
            setCreated(c)
            load()
          }}
        />
      )}
      {created && <ShareDialog created={created} onClose={() => setCreated(null)} />}
    </div>
  )
}

function CreateLinkDialog({ onClose, onCreated }: { onClose: () => void; onCreated: (c: { link: LinkRow; url: string }) => void }) {
  const { has, hasGlobal } = useCcgMe()
  const opts = useCcgOptions()
  const canIntake = has('links.intake')
  const [kind, setKind] = useState<'convert_intake' | 'member_ccf'>(canIntake ? 'convert_intake' : 'member_ccf')
  const [streamId, setStreamId] = useState<string | null>(null)
  const [ccfId, setCcfId] = useState<string | null>(null)
  const [seekerId, setSeekerId] = useState<string | null>(null)
  const seekers = useSeekerOptions(kind === 'convert_intake' ? streamId : undefined)
  const [label, setLabel] = useState('')
  const [days, setDays] = useState('')
  const [maxUses, setMaxUses] = useState('')
  const [saving, setSaving] = useState(false)

  // A stream-level Sheep Seeker must choose their stream; church-wide needs global rights.
  const churchWide = hasGlobal('links.intake')
  useEffect(() => {
    if (!churchWide && opts?.streams.length === 1) setStreamId(opts.streams[0].id)
  }, [churchWide, opts])

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    const r = await ccgApi.post<{ link: LinkRow; path: string }>('/links', {
      kind,
      ...(kind === 'convert_intake' ? { stream_id: streamId, ...(seekerId ? { seeker_person_id: seekerId } : {}) } : { ccf_id: ccfId }),
      label: label.trim() || null,
      ...(days ? { expires_in_days: Number(days) } : {}),
      ...(maxUses ? { max_uses: Number(maxUses) } : {}),
    })
    setSaving(false)
    if (!r.ok) return message.error(r.error.message)
    onCreated({ link: r.data.link, url: `${window.location.origin}${r.data.path}` })
  }

  const ready = kind === 'convert_intake' ? churchWide || !!streamId : !!ccfId

  return (
    <Dialog open onOpenChange={(o) => !o && !saving && onClose()}>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={submit} className="space-y-4">
          <DialogHeader>
            <DialogTitle>New registration link</DialogTitle>
            <DialogDescription>Anyone with the link can register, until it expires, is used up or is revoked.</DialogDescription>
          </DialogHeader>

          <Field label="Who registers?" htmlFor="l-kind">
            <NullableSelect
              id="l-kind"
              value={kind}
              onChange={(v) => v && setKind(v as typeof kind)}
              options={[
                ...(canIntake ? [{ value: 'convert_intake', label: 'New converts' }] : []),
                ...(has('links.manage') ? [{ value: 'member_ccf', label: 'Members of a CCF' }] : []),
              ]}
              noneLabel="Choose"
            />
          </Field>

          {kind === 'convert_intake' ? (
            <>
              <Field label="Stream" htmlFor="l-stream" hint="Converts are registered into this stream and matched with its CCFs">
                <NullableSelect
                  id="l-stream"
                  value={streamId}
                  onChange={(v) => {
                    setStreamId(v)
                    setSeekerId(null)
                  }}
                  options={(opts?.streams ?? []).map((s) => ({ value: s.id, label: s.name }))}
                  noneLabel={churchWide ? 'Church-wide' : 'Choose a stream'}
                />
              </Field>
              <Field label="Sheep Seeker" htmlFor="l-seeker" hint="Converts who register through this link are recorded as theirs">
                <NullableSelect
                  id="l-seeker"
                  value={seekerId}
                  onChange={setSeekerId}
                  options={(seekers ?? []).map((sk) => ({ value: sk.person_id, label: sk.name }))}
                  noneLabel="Me, or not recorded"
                />
              </Field>
            </>
          ) : (
            <Field label="CCF" htmlFor="l-ccf" hint="New members wait for their coordinator to confirm them">
              <NullableSelect
                id="l-ccf"
                value={ccfId}
                onChange={setCcfId}
                options={(opts?.ccfs ?? []).filter((f) => f.status === 'active').map((f) => ({ value: f.id, label: ccfLabel(f) }))}
                noneLabel="Choose a CCF"
              />
            </Field>
          )}

          <Field label="Label" htmlFor="l-label" hint="e.g. Sunday 12 October, main service">
            <Input id="l-label" value={label} onChange={(e) => setLabel(e.target.value)} />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Expires after (days)" htmlFor="l-days">
              <Input id="l-days" type="number" min={1} max={365} inputMode="numeric" value={days} onChange={(e) => setDays(e.target.value)} placeholder="Never" />
            </Field>
            <Field label="Maximum uses" htmlFor="l-max">
              <Input id="l-max" type="number" min={1} inputMode="numeric" value={maxUses} onChange={(e) => setMaxUses(e.target.value)} placeholder="No limit" />
            </Field>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose} disabled={saving}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving || !ready}>
              {saving && <Loader2 className="size-4 animate-spin" />}
              Create link
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function ShareDialog({ created, onClose }: { created: { link: LinkRow; url: string }; onClose: () => void }) {
  const [qr, setQr] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    QRCode.toDataURL(created.url, { width: 480, margin: 2, errorCorrectionLevel: 'M' }).then(setQr)
  }, [created.url])

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(created.url)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      message.error('Could not copy. Select the link and copy it instead.')
    }
  }

  const name = (created.link.label || KIND_LABEL[created.link.kind]).replace(/[^\w-]+/g, '-').toLowerCase()

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Share this link</DialogTitle>
          <DialogDescription>Copy the link or save the QR code now. This is the only time the link is shown.</DialogDescription>
        </DialogHeader>
        <div className="flex justify-center">
          {qr ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={qr} alt={`QR code for ${created.link.label || 'the registration link'}`} className="size-60 rounded-lg border bg-white p-2" />
          ) : (
            <Skeleton className="size-60" />
          )}
        </div>
        <div className="flex gap-2">
          <Input readOnly value={created.url} onFocus={(e) => e.target.select()} aria-label="Registration link" />
          <Button type="button" variant="outline" onClick={copy} aria-label="Copy link">
            {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
          </Button>
        </div>
        <DialogFooter>
          {qr && (
            <Button variant="outline" asChild>
              <a href={qr} download={`ccg-${name}-qr.png`}>
                <Download className="size-4" />
                Download QR code
              </a>
            </Button>
          )}
          <Button onClick={onClose}>Done</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
