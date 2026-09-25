'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Loader2, Plus, Search, ShieldCheck, UserCog, X } from 'lucide-react'
import { ccgApi } from '@/lib/ccg/client'
import { message } from '@/lib/toast'
import { useConfirm } from '@/hooks/use-confirm'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { EmptyState } from '@/components/base/EmptyState'
import { ErrorScreen } from '@/components/base/ErrorScreen'
import { useCcgMe } from '@/components/ccg/CcgMeProvider'
import { Field, NullableSelect, SearchSelect } from '@/components/ccg/form-utils'
import { Initials, StickyHeader } from '@/components/ccg/synago'

/**
 * The CCG owner's view of every user, Seek's included: their Seek role and
 * their CCG roles. Give anyone a CCG role (a Seek user keeps their one login;
 * no CCG profile is needed) or end one.
 */

interface UserRow {
  id: string
  username: string
  name: string
  email: string | null
  seek_role: string | null
  is_superadmin: boolean
  assignments: Array<{ id: string; role: { key: string; name: string }; unit: string | null }>
  member: { id: string; full_name: string } | null
}
interface RoleOption {
  key: string
  name: string
  scope_level: 'global' | 'campus' | 'stream' | 'council' | 'ccg' | 'ccf'
  active: boolean
}

const SEEK_ROLE: Record<string, string> = { superadmin: 'Seek superadmin', leadpastor: 'Lead Pastor', overseer: 'Seek overseer', admin: 'Seek admin', leader: 'Seek leader' }
const LEVEL: Record<RoleOption['scope_level'], string> = { global: 'Everywhere', campus: 'Campus', stream: 'Stream', council: 'Council', ccg: 'CCG', ccf: 'CCF' }
const UNITS: Record<Exclude<RoleOption['scope_level'], 'global'>, { path: string; key: string }> = {
  campus: { path: '/campuses', key: 'campuses' },
  stream: { path: '/streams', key: 'streams' },
  council: { path: '/councils', key: 'councils' },
  ccg: { path: '/ccgs', key: 'ccgs' },
  ccf: { path: '/ccfs', key: 'ccfs' },
}

export default function CcgUsersPage() {
  const { me, loading: meLoading } = useCcgMe()
  const isOwner = !!me?.is_superadmin
  const { confirm, ConfirmDialog } = useConfirm()
  const [users, setUsers] = useState<UserRow[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [only, setOnly] = useState<'all' | 'ccg' | 'none'>('all')
  const [giving, setGiving] = useState<UserRow | null>(null)

  const load = useCallback(async () => {
    const r = await ccgApi.get<{ users: UserRow[] }>('/users?all=1')
    if (!r.ok) return setError(r.error.message)
    setError(null)
    setUsers(r.data.users)
  }, [])

  useEffect(() => {
    if (isOwner) load()
  }, [isOwner, load])

  const shown = useMemo(() => {
    const q = search.trim().toLowerCase()
    return (users ?? []).filter(
      (u) =>
        (only === 'all' || (only === 'ccg' ? u.assignments.length > 0 || u.is_superadmin : u.assignments.length === 0 && !u.is_superadmin)) &&
        (!q || [u.name, u.username, u.email ?? ''].some((x) => x.toLowerCase().includes(q)))
    )
  }, [users, search, only])

  const end = async (u: UserRow, a: UserRow['assignments'][number]) => {
    const ok = await confirm({
      title: `End ${u.name}’s role?`,
      description: `${a.role.name}${a.unit ? `, ${a.unit}` : ''} ends today. Their login and any other roles stay.`,
      confirmLabel: 'End role',
      destructive: true,
    })
    if (!ok) return
    const r = await ccgApi.del(`/assignments/${a.id}`)
    if (!r.ok) return message.error(r.error.message)
    message.success('Role ended')
    load()
  }

  if (!meLoading && !isOwner) {
    return <EmptyState icon={UserCog} title="Users & roles" description="Only the CCG owner manages every user." className="mt-12" />
  }
  if (error) return <ErrorScreen title="Couldn’t load users" message={error} onRetry={load} />

  return (
    <div className="pb-10">
      <StickyHeader className="space-y-3">
        <div>
          <p className="text-xs text-muted-foreground">Everyone with a login, Seek’s included</p>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            Users & <span className="text-members">roles</span>
          </h1>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
            <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by name, username or email" className="h-10 pl-9" aria-label="Search users" />
          </div>
          <div className="inline-flex rounded-lg border border-border p-1" role="group" aria-label="Show">
            {(
              [
                ['all', 'All'],
                ['ccg', 'With CCG roles'],
                ['none', 'No CCG role'],
              ] as const
            ).map(([k, label]) => (
              <button
                key={k}
                type="button"
                aria-pressed={only === k}
                onClick={() => setOnly(k)}
                className={`min-h-8 rounded-md px-3 text-sm font-medium transition-colors ${only === k ? 'bg-accent text-accent-foreground' : 'text-muted-foreground hover:text-foreground'}`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      </StickyHeader>

      {!users ? (
        <div className="mt-4 space-y-2">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-16 rounded-xl" />
          ))}
        </div>
      ) : shown.length === 0 ? (
        <EmptyState icon={UserCog} title="No one matches" description="Try another name or filter." className="mt-12" />
      ) : (
        <ul className="mt-4 space-y-2">
          {shown.map((u) => (
            <li key={u.id}>
              <Card className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
                <div className="flex min-w-0 flex-1 items-center gap-3">
                  <Initials name={u.name} className="size-10 text-sm" />
                  <div className="min-w-0">
                    <p className="truncate font-semibold text-foreground">
                      {u.name} <span className="text-sm font-normal text-muted-foreground">@{u.username}</span>
                    </p>
                    <div className="mt-1 flex flex-wrap gap-1.5">
                      {u.is_superadmin && (
                        <Badge className="gap-1">
                          <ShieldCheck className="size-3" aria-hidden />
                          CCG owner
                        </Badge>
                      )}
                      {u.seek_role && <Badge variant="secondary">{SEEK_ROLE[u.seek_role] ?? u.seek_role}</Badge>}
                      {u.assignments.map((a) => (
                        <Badge key={a.id} variant="outline" className="gap-1 pr-1">
                          {a.role.name}
                          {a.unit ? ` · ${a.unit}` : ''}
                          <button
                            type="button"
                            onClick={() => end(u, a)}
                            className="rounded p-0.5 hover:bg-accent"
                            aria-label={`End ${a.role.name}${a.unit ? `, ${a.unit}` : ''}`}
                          >
                            <X className="size-3" />
                          </button>
                        </Badge>
                      ))}
                      {!u.is_superadmin && u.assignments.length === 0 && <span className="text-xs text-muted-foreground">No CCG role</span>}
                    </div>
                  </div>
                </div>
                {!u.is_superadmin && (
                  <Button variant="outline" size="sm" className="h-9 shrink-0 gap-1.5" onClick={() => setGiving(u)}>
                    <Plus className="size-4" />
                    Give CCG role
                  </Button>
                )}
              </Card>
            </li>
          ))}
        </ul>
      )}

      {giving && (
        <GiveRoleDialog
          user={giving}
          onClose={() => setGiving(null)}
          onDone={() => {
            setGiving(null)
            load()
          }}
        />
      )}
      {ConfirmDialog}
    </div>
  )
}

function GiveRoleDialog({ user, onClose, onDone }: { user: UserRow; onClose: () => void; onDone: () => void }) {
  const [roles, setRoles] = useState<RoleOption[]>([])
  const [roleKey, setRoleKey] = useState<string | null>(null)
  const [units, setUnits] = useState<Array<{ value: string; label: string }>>([])
  const [unitId, setUnitId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const role = roles.find((r) => r.key === roleKey)
  const level = role?.scope_level

  useEffect(() => {
    ccgApi.get<{ roles: RoleOption[] }>('/roles').then((r) => r.ok && setRoles(r.data.roles.filter((x) => x.active)))
  }, [])
  useEffect(() => {
    setUnitId(null)
    setUnits([])
    if (!level || level === 'global') return
    const u = UNITS[level]
    ccgApi.get<Record<string, Array<{ id: string; name: string }>>>(u.path).then((r) => {
      if (r.ok) setUnits((r.data[u.key] ?? []).map((x) => ({ value: x.id, label: x.name })))
    })
  }, [level])

  const save = async () => {
    if (!role) return
    setSaving(true)
    const r = await ccgApi.post('/assignments', { user_id: user.id, role_key: role.key, ...(level && level !== 'global' ? { [`${level}_id`]: unitId } : {}) })
    setSaving(false)
    if (!r.ok) return message.error(r.error.message)
    message.success(`${user.name} is now ${role.name}${unitId ? `, ${units.find((x) => x.value === unitId)?.label}` : ''}`)
    onDone()
  }

  return (
    <Dialog open onOpenChange={(o) => !o && !saving && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Give {user.name} a CCG role</DialogTitle>
          <DialogDescription>
            They use their existing login{user.seek_role ? ' (the same as for Seek)' : ''}. No CCG profile is needed; the next time they sign in, the City Church Group app is
            there for them.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <Field label="Role" htmlFor="g-role">
            <NullableSelect
              id="g-role"
              value={roleKey}
              onChange={setRoleKey}
              options={roles.map((r) => ({ value: r.key, label: `${r.name} (${LEVEL[r.scope_level]})` }))}
              noneLabel="Choose a role"
              placeholder="Choose a role"
            />
          </Field>
          {level && level !== 'global' && (
            <Field label={LEVEL[level]} htmlFor="g-unit">
              <SearchSelect id="g-unit" value={unitId} onChange={setUnitId} options={units} placeholder={`Choose a ${LEVEL[level].toLowerCase()}`} />
            </Field>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={save} disabled={saving || !role || (level !== 'global' && !unitId)}>
            {saving && <Loader2 className="size-4 animate-spin" />}
            Give role
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
