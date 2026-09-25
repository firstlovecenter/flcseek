'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ChevronRight, Loader2, Plus, UsersRound } from 'lucide-react'
import { ccgApi, fieldErrors } from '@/lib/ccg/client'
import { message } from '@/lib/toast'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { Textarea } from '@/components/ui/textarea'
import { EmptyState } from '@/components/base/EmptyState'
import { ErrorScreen } from '@/components/base/ErrorScreen'
import { useCcgMe } from '@/components/ccg/CcgMeProvider'
import { useCcgFocus, useSeekingRole } from '@/components/ccg/CcgFocusProvider'
import { Field } from '@/components/ccg/form-utils'
import { StickyHeader } from '@/components/ccg/synago'

export interface SeekingGroupRow {
  id: string
  name: string
  status: string
  notes: string | null
  stream: { id: string; name: string }
  seeker_count: number
  convert_count: number
  seekers: string[]
}

/**
 * Sheep seeking groups: a stream's converts, split into groups, each looked
 * after by the Sheep Seekers assigned to it. The stream's Sheep Seeking
 * Overseer creates them; a Sheep Seeker sees their own.
 */
export default function CcgSeekingGroupsPage() {
  const router = useRouter()
  const { me, hasGlobal } = useCcgMe()
  const { focus } = useCcgFocus()
  const role = useSeekingRole()
  const stream = focus?.type === 'stream' ? focus.id : null
  const canCreate =
    !!stream &&
    (hasGlobal('seekers.manage') ||
      !!me?.roles.some(
        (r) => (r.role.key === 'seeking_overseer' && r.unit?.id === stream) || (r.unit?.type === 'campus' && r.unit.streams?.some((s) => s.id === stream))
      ))
  const [groups, setGroups] = useState<SeekingGroupRow[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)

  const load = useCallback(async () => {
    setGroups(null)
    const r = await ccgApi.get<{ groups: SeekingGroupRow[] }>(`/seeking-groups${stream ? `?stream_id=${stream}` : ''}`)
    if (!r.ok) return setError(r.error.message)
    setError(null)
    setGroups(r.data.groups)
  }, [stream])

  useEffect(() => {
    if (focus) load()
  }, [focus, load])

  if (error) return <ErrorScreen title="Couldn’t load groups" message={error} onRetry={load} />

  return (
    <div className="pb-10">
      <StickyHeader>
        <div className="flex items-end justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs text-muted-foreground">{role === 'seeker' ? 'The groups you look after' : focus?.type === 'stream' ? focus.name : 'Sheep Seeking'}</p>
            <h1 className="text-2xl font-bold tracking-tight text-foreground">
              Sheep seeking <span className="text-members">groups</span>
            </h1>
          </div>
          {canCreate && (
            <Button className="h-10 gap-1.5" onClick={() => setCreating(true)}>
              <Plus className="size-4" />
              New group
            </Button>
          )}
        </div>
      </StickyHeader>

      {!groups ? (
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-28 rounded-xl" />
          ))}
        </div>
      ) : groups.length === 0 ? (
        <EmptyState
          orb
          icon={UsersRound}
          title="No groups yet"
          description={
            canCreate
              ? 'Create groups, put the stream’s converts in them, and assign Sheep Seekers to look after each group.'
              : role === 'seeker'
                ? 'Your Sheep Seeking Overseer assigns you to groups.'
                : 'Choose a stream to see its groups.'
          }
          className="mt-12"
        />
      ) : (
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {groups.map((g) => (
            <Link
              key={g.id}
              href={`/ccg/seeking-groups/${g.id}`}
              className="group flex flex-col gap-2 rounded-xl border border-border bg-card p-4 transition-all hover:-translate-y-0.5 hover:border-foreground/20 hover:shadow-sm"
            >
              <div className="flex items-start justify-between gap-2">
                <p className="font-semibold text-foreground">{g.name}</p>
                <ChevronRight className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" aria-hidden />
              </div>
              <p className="truncate text-xs text-muted-foreground">
                {g.seekers.length ? g.seekers.join(', ') : 'No Sheep Seekers yet'}
                {g.seeker_count > g.seekers.length ? ` +${g.seeker_count - g.seekers.length}` : ''}
              </p>
              <div className="mt-auto flex flex-wrap gap-1.5">
                <Badge variant="secondary">{g.convert_count} converts</Badge>
                <Badge variant="secondary">{g.seeker_count} Sheep Seekers</Badge>
                {!stream && <Badge variant="outline">{g.stream.name}</Badge>}
                {g.status !== 'active' && (
                  <Badge variant="outline" className="capitalize">
                    {g.status}
                  </Badge>
                )}
              </div>
            </Link>
          ))}
        </div>
      )}

      {creating && stream && (
        <NewGroupDialog
          streamId={stream}
          streamName={focus?.name ?? ''}
          onClose={() => setCreating(false)}
          onCreated={(id) => {
            setCreating(false)
            router.push(`/ccg/seeking-groups/${id}`)
          }}
        />
      )}
    </div>
  )
}

function NewGroupDialog({ streamId, streamName, onClose, onCreated }: { streamId: string; streamName: string; onClose: () => void; onCreated: (id: string) => void }) {
  const [name, setName] = useState('')
  const [notes, setNotes] = useState('')
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)
  const save = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    const r = await ccgApi.post<{ id: string }>('/seeking-groups', { stream_id: streamId, name: name.trim(), notes: notes.trim() || null })
    setSaving(false)
    if (!r.ok) {
      setErrors(fieldErrors(r.error))
      return message.error(r.error.message)
    }
    message.success(`${name.trim()} created`)
    onCreated(r.data.id)
  }
  return (
    <Dialog open onOpenChange={(o) => !o && !saving && onClose()}>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={save} className="space-y-4" noValidate>
          <DialogHeader>
            <DialogTitle>New sheep seeking group</DialogTitle>
            <DialogDescription>In {streamName}. Then put converts in it and assign Sheep Seekers to look after them.</DialogDescription>
          </DialogHeader>
          <Field label="Name *" htmlFor="sg-name" error={errors.name}>
            <Input id="sg-name" value={name} onChange={(e) => setName(e.target.value)} autoFocus />
          </Field>
          <Field label="Notes" htmlFor="sg-notes" error={errors.notes}>
            <Textarea id="sg-notes" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
          </Field>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose} disabled={saving}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving || !name.trim()}>
              {saving && <Loader2 className="size-4 animate-spin" />}
              Create group
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
