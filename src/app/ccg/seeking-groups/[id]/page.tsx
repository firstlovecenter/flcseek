'use client'

import { use, useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ListChecks, Loader2, Plus, Search, Trash2, UserPlus, X } from 'lucide-react'
import { ccgApi } from '@/lib/ccg/client'
import { message } from '@/lib/toast'
import { useConfirm } from '@/hooks/use-confirm'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { ErrorScreen } from '@/components/base/ErrorScreen'
import { SearchSelect } from '@/components/ccg/form-utils'
import { PERSON_STATUS, type PersonDTO } from '@/components/ccg/people-types'
import { Initials, SectionLabel, StickyHeader } from '@/components/ccg/synago'

interface Detail {
  group: { id: string; name: string; status: string; notes: string | null; stream: { id: string; name: string } | null }
  can_manage: boolean
  seekers: Array<{ user_id: string; person_id: string | null; name: string; since: string | null }>
  converts: Array<{ id: string; full_name: string; phone: string | null; status: string; ccf: string | null; days: number | null }>
}

/** One sheep seeking group: who looks after it, and its converts wherever they are placed. */
export default function SeekingGroupPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const router = useRouter()
  const { confirm, ConfirmDialog } = useConfirm()
  const [d, setD] = useState<Detail | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [team, setTeam] = useState<Array<{ user_id: string; name: string }>>([])
  const [adding, setAdding] = useState<string | null>(null)
  const [picking, setPicking] = useState(false)

  const load = useCallback(async () => {
    const r = await ccgApi.get<Detail>(`/seeking-groups/${id}`)
    if (!r.ok) return setError(r.error.message)
    setError(null)
    setD(r.data)
  }, [id])

  useEffect(() => {
    load()
  }, [load])

  // The stream's Sheep Seekers, to assign to this group.
  const streamId = d?.group.stream?.id
  const canManage = !!d?.can_manage
  useEffect(() => {
    if (!streamId || !canManage) return
    ccgApi.get<{ seekers: Array<{ user_id: string; name: string }> }>(`/streams/${streamId}/seekers`).then((r) => r.ok && setTeam(r.data.seekers))
  }, [streamId, canManage])

  const addSeeker = async (userId: string | null) => {
    if (!userId) return
    setAdding(userId)
    const r = await ccgApi.post(`/seeking-groups/${id}/seekers`, { user_id: userId })
    setAdding(null)
    if (!r.ok) return message.error(r.error.message)
    load()
  }
  const removeSeeker = async (s: Detail['seekers'][number]) => {
    const r = await ccgApi.del(`/seeking-groups/${id}/seekers/${s.user_id}`)
    if (!r.ok) return message.error(r.error.message)
    message.success(`${s.name} no longer looks after ${d?.group.name}`)
    load()
  }
  const removeConvert = async (c: Detail['converts'][number]) => {
    const ok = await confirm({ title: `Take ${c.full_name} out of ${d?.group.name}?`, description: 'They stay registered, with no group until you put them in one.', confirmLabel: 'Take out' })
    if (!ok) return
    const r = await ccgApi.del(`/seeking-groups/${id}/converts/${c.id}`)
    if (!r.ok) return message.error(r.error.message)
    load()
  }
  const close = async () => {
    const ok = await confirm({ title: `Close ${d?.group.name}?`, description: 'The group must have no converts left.', confirmLabel: 'Close group', destructive: true })
    if (!ok) return
    const r = await ccgApi.del(`/seeking-groups/${id}`)
    if (!r.ok) return message.error(r.error.message)
    message.success('Group closed')
    router.push('/ccg/seeking-groups')
  }

  if (error) return <ErrorScreen title="Couldn’t load the group" message={error} onRetry={load} />

  const unassigned = team.filter((t) => !d?.seekers.some((s) => s.user_id === t.user_id))

  return (
    <div className="pb-10">
      <StickyHeader className="space-y-1">
        <p className="text-xs text-muted-foreground">
          <Link href="/ccg/seeking-groups" className="hover:text-foreground">
            Sheep seeking groups
          </Link>
          {d?.group.stream ? ` · ${d.group.stream.name}` : ''}
        </p>
        <div className="flex items-center justify-between gap-3">
          {d ? (
            <h1 className="truncate text-2xl font-bold tracking-tight text-foreground">
              {d.group.name} <span className="text-members">Group</span>
            </h1>
          ) : (
            <Skeleton className="h-8 w-56" />
          )}
          <div className="flex shrink-0 gap-2">
            <Button variant="outline" size="sm" className="h-9 gap-1.5" asChild>
              <Link href="/ccg">
                <ListChecks className="size-4" />
                <span className="hidden sm:inline">Milestones</span>
              </Link>
            </Button>
            {canManage && (
              <Button variant="ghost" size="sm" className="h-9 gap-1.5 text-destructive hover:text-destructive" onClick={close}>
                <Trash2 className="size-4" />
                <span className="hidden sm:inline">Close</span>
              </Button>
            )}
          </div>
        </div>
      </StickyHeader>

      <div className="space-y-8 pt-4">
        <section>
          <SectionLabel>Sheep Seekers</SectionLabel>
          {!d ? (
            <Skeleton className="h-12 rounded-xl" />
          ) : (
            <div className="space-y-3">
              {d.seekers.length === 0 ? (
                <p className="text-sm text-muted-foreground">No Sheep Seekers look after this group yet.</p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {d.seekers.map((s) => (
                    <span key={s.user_id} className="inline-flex items-center gap-2 rounded-full border border-border bg-card py-1 pr-1 pl-1.5 text-sm">
                      <Initials name={s.name} className="size-6 text-[10px]" />
                      {s.name}
                      {canManage && (
                        <button type="button" onClick={() => removeSeeker(s)} className="rounded-full p-1 hover:bg-accent" aria-label={`Take ${s.name} off this group`}>
                          <X className="size-3.5" />
                        </button>
                      )}
                    </span>
                  ))}
                </div>
              )}
              {canManage && (
                <div className="flex max-w-sm items-center gap-2">
                  <SearchSelect
                    value={null}
                    onChange={addSeeker}
                    options={unassigned.map((t) => ({ value: t.user_id, label: t.name }))}
                    placeholder={unassigned.length ? 'Assign a Sheep Seeker…' : 'Every Sheep Seeker of the stream is here'}
                    disabled={!unassigned.length || !!adding}
                  />
                  {adding && <Loader2 className="size-4 animate-spin text-muted-foreground" />}
                </div>
              )}
            </div>
          )}
        </section>

        <section>
          <SectionLabel
            action={
              canManage ? (
                <Button variant="outline" size="sm" className="h-8 gap-1" onClick={() => setPicking(true)}>
                  <UserPlus className="size-4" /> Add converts
                </Button>
              ) : null
            }
          >
            {`Converts${d ? ` (${d.converts.length})` : ''}`}
          </SectionLabel>
          {!d ? (
            <Skeleton className="h-40 rounded-xl" />
          ) : d.converts.length === 0 ? (
            <p className="text-sm text-muted-foreground">No converts in this group yet.</p>
          ) : (
            <Card className="gap-0 overflow-hidden p-0">
              <ul className="divide-y">
                {d.converts.map((c) => (
                  <li key={c.id} className="flex items-center gap-3 px-4 py-2.5">
                    <Initials name={c.full_name} className="size-8 text-[11px]" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{c.full_name}</p>
                      <p className="truncate text-xs text-muted-foreground">{c.ccf ? `In ${c.ccf}` : 'Not placed yet'}</p>
                    </div>
                    <Badge variant={PERSON_STATUS[c.status]?.tone ?? 'outline'} className="shrink-0">
                      {PERSON_STATUS[c.status]?.label ?? c.status}
                    </Badge>
                    {canManage && (
                      <Button variant="ghost" size="icon" className="size-8 shrink-0" onClick={() => removeConvert(c)} aria-label={`Take ${c.full_name} out of the group`}>
                        <X className="size-4" />
                      </Button>
                    )}
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </section>
      </div>

      {picking && d?.group.stream && (
        <AddConvertsDialog
          groupId={id}
          groupName={d.group.name}
          streamId={d.group.stream.id}
          onClose={() => setPicking(false)}
          onDone={() => {
            setPicking(false)
            load()
          }}
        />
      )}
      {ConfirmDialog}
    </div>
  )
}

/** Pick converts of the stream (those not in a group first) to put in this group. */
function AddConvertsDialog({ groupId, groupName, streamId, onClose, onDone }: { groupId: string; groupName: string; streamId: string; onClose: () => void; onDone: () => void }) {
  const [search, setSearch] = useState('')
  const [rows, setRows] = useState<PersonDTO[] | null>(null)
  const [chosen, setChosen] = useState<Set<string>>(new Set())
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    const t = setTimeout(async () => {
      const q = new URLSearchParams({ kind: 'convert', stream_id: streamId, limit: '100' })
      if (search.trim()) q.set('search', search.trim())
      const r = await ccgApi.get<{ people: PersonDTO[] }>(`/people?${q}`)
      setRows(r.ok ? r.data.people : [])
    }, 250)
    return () => clearTimeout(t)
  }, [search, streamId])

  const list = useMemo(
    () => (rows ?? []).filter((p) => p.seeking_group?.id !== groupId).sort((a, b) => Number(!!a.seeking_group) - Number(!!b.seeking_group)),
    [rows, groupId]
  )

  const save = async () => {
    setSaving(true)
    const r = await ccgApi.post(`/seeking-groups/${groupId}/converts`, { person_ids: [...chosen] })
    setSaving(false)
    if (!r.ok) return message.error(r.error.message)
    message.success(`${chosen.size} convert${chosen.size === 1 ? '' : 's'} added to ${groupName}`)
    onDone()
  }

  return (
    <Dialog open onOpenChange={(o) => !o && !saving && onClose()}>
      <DialogContent className="flex max-h-[85dvh] flex-col sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Add converts to {groupName}</DialogTitle>
          <DialogDescription>Converts of this stream. Those already in another group move here.</DialogDescription>
        </DialogHeader>
        <div className="relative">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by name or phone" className="pl-9" aria-label="Search converts" />
        </div>
        <div className="-mx-1 min-h-40 flex-1 overflow-y-auto px-1">
          {!rows ? (
            <Skeleton className="h-40 rounded-lg" />
          ) : list.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">No converts to add.</p>
          ) : (
            <ul className="divide-y rounded-lg border">
              {list.map((p) => (
                <li key={p.id}>
                  <label className="flex cursor-pointer items-center gap-3 px-3 py-2 hover:bg-accent/40">
                    <Checkbox
                      checked={chosen.has(p.id)}
                      onCheckedChange={(v) =>
                        setChosen((c) => {
                          const n = new Set(c)
                          if (v) n.add(p.id)
                          else n.delete(p.id)
                          return n
                        })
                      }
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium">{p.full_name}</span>
                      <span className="block truncate text-xs text-muted-foreground">
                        {p.seeking_group ? `Now in ${p.seeking_group.name}` : 'No group yet'}
                        {p.placement?.ccf ? ` · ${p.placement.ccf.name}` : ''}
                      </span>
                    </span>
                  </label>
                </li>
              ))}
            </ul>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={save} disabled={saving || chosen.size === 0}>
            {saving ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
            Add {chosen.size || ''}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
