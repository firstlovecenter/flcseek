'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { ChevronRight, Loader2, Plus, Search, UserCog } from 'lucide-react'
import { ccgApi, fieldErrors } from '@/lib/ccg/client'
import { message } from '@/lib/toast'
import { useConfirm } from '@/hooks/use-confirm'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { EmptyState } from '@/components/base/EmptyState'
import { ErrorScreen } from '@/components/base/ErrorScreen'
import { useCcgMe } from '@/components/ccg/CcgMeProvider'
import { useCcgFocus } from '@/components/ccg/CcgFocusProvider'
import { roleInPortal } from '@/lib/ccg/scope'
import { Field, NullableSelect, SearchSelect } from '@/components/ccg/form-utils'
import { Initials, StickyHeader } from '@/components/ccg/synago'

/**
 * The CCG owner's view of every user, Seek's included: their Seek role and
 * their CCG roles. Edit anyone's login details, give anyone a CCG role (a
 * Seek user keeps their one login; no CCG profile is needed) or end one.
 */

interface UserRow {
  id: string
  username: string
  name: string
  first_name: string | null
  last_name: string | null
  email: string | null
  phone_number: string | null
  seek_role: string | null
  is_superadmin: boolean
  assignments: Array<{ id: string; role: { key: string; name: string }; unit: string | null }>
  member: { id: string; full_name: string; middle_name: string | null } | null
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

/** One line under a name: their roles, briefly. */
function summary(u: UserRow) {
  if (u.is_superadmin) return 'CCG owner'
  const roles = u.assignments.map((a) => (a.unit ? `${a.role.name} · ${a.unit}` : a.role.name))
  if (roles.length) return roles.length > 2 ? `${roles.slice(0, 2).join(', ')} +${roles.length - 2}` : roles.join(', ')
  return u.seek_role ? `${SEEK_ROLE[u.seek_role] ?? u.seek_role}, no CCG role` : 'No CCG role'
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
  const [editing, setEditing] = useState<UserRow | null>(null)

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
    // Keep an open edit dialog in step.
    setEditing((e) => (e && e.id === u.id ? { ...e, assignments: e.assignments.filter((x) => x.id !== a.id) } : e))
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
        <>
          {/* As the FL admin portal's members list: rows on a phone, cards on a wider screen. */}
          <div className="mt-4 overflow-hidden rounded-xl border border-border bg-card md:hidden">
            {shown.map((u) => (
              <button
                key={u.id}
                type="button"
                onClick={() => setEditing(u)}
                className="flex min-h-16 w-full items-center gap-3 border-b border-border px-4 py-3 text-left transition-colors last:border-0 hover:bg-muted/50 active:bg-muted"
              >
                <Initials name={u.name} className="size-10 shrink-0 text-xs" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-foreground">{u.name}</p>
                  <p className="truncate text-xs text-muted-foreground">{summary(u)}</p>
                </div>
                <ChevronRight className="size-4 shrink-0 text-muted-foreground/50" />
              </button>
            ))}
          </div>
          <div className="mt-4 hidden grid-cols-2 gap-3 md:grid lg:grid-cols-3 xl:grid-cols-4">
            {shown.map((u) => (
              <button
                key={u.id}
                type="button"
                onClick={() => setEditing(u)}
                className="flex min-h-40 flex-col items-center gap-3 rounded-xl border border-border bg-card p-4 text-center transition-all hover:-translate-y-0.5 hover:border-members/40 hover:shadow-md active:translate-y-0"
              >
                <Initials name={u.name} className="size-14 text-base" />
                <div className="w-full min-w-0">
                  <p className="truncate text-sm font-medium text-foreground">{u.name}</p>
                  <p className="mt-0.5 truncate text-xs text-muted-foreground">{summary(u)}</p>
                </div>
              </button>
            ))}
          </div>
        </>
      )}

      {giving && (
        <GiveRoleDialog
          user={giving}
          onClose={() => setGiving(null)}
          onDone={() => {
            setGiving(null)
            setEditing(null)
            load()
          }}
        />
      )}
      {editing && (
        <EditUserDialog
          user={editing}
          onGiveRole={() => {
            setGiving(editing)
            setEditing(null)
          }}
          onEndRole={(a) => end(editing, a)}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null)
            load()
          }}
        />
      )}
      {ConfirmDialog}
    </div>
  )
}

/** Edit someone's login (and, for a member, their profile with it), and end any of their roles. */
function EditUserDialog({
  user,
  onGiveRole,
  onEndRole,
  onClose,
  onSaved,
}: {
  user: UserRow
  onGiveRole: () => void
  onEndRole: (a: UserRow['assignments'][number]) => void
  onClose: () => void
  onSaved: () => void
}) {
  // A login has no middle name: it is their member profile's.
  const initial = {
    first_name: user.first_name ?? '',
    middle_name: user.member?.middle_name ?? '',
    last_name: user.last_name ?? '',
    email: user.email ?? '',
    phone: user.phone_number ?? '',
  }
  const [form, setForm] = useState(initial)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)
  const changed = (Object.keys(form) as Array<keyof typeof form>).filter((k) => form[k].trim() !== initial[k].trim())

  const save = async () => {
    if (!changed.length) return onClose()
    setSaving(true)
    const r = await ccgApi.patch<{ username: string; signs_in_with_changed: boolean }>(`/users/${user.id}`, Object.fromEntries(changed.map((k) => [k, form[k].trim()])))
    setSaving(false)
    if (!r.ok) {
      setErrors(fieldErrors(r.error))
      return message.error(r.error.message)
    }
    message.success(r.data.signs_in_with_changed ? `Saved. ${form.first_name || user.name} now signs in with ${r.data.username}` : 'Saved')
    onSaved()
  }
  const input = (k: keyof typeof form, label: string, type = 'text') => (
    <Field label={label} htmlFor={`eu-${k}`} error={errors[k]}>
      <Input id={`eu-${k}`} type={type} value={form[k]} onChange={(e) => setForm((f) => ({ ...f, [k]: e.target.value }))} aria-invalid={!!errors[k]} />
    </Field>
  )

  return (
    <Dialog open onOpenChange={(o) => !o && !saving && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Edit {user.name}</DialogTitle>
          <DialogDescription>
            Signs in as <strong>{user.username}</strong>.{user.member ? ' Their member profile changes with these details.' : ''} Changing the email changes the sign-in name
            when it was their email. Nobody is notified.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-3 sm:grid-cols-2">
          {input('first_name', 'First name')}
          {user.member && input('middle_name', 'Middle name')}
          {input('last_name', 'Last name')}
          <div className="sm:col-span-2">{input('email', 'Email', 'email')}</div>
          <div className="sm:col-span-2">{input('phone', 'Phone', 'tel')}</div>
        </div>
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium">CCG roles</p>
            {!user.is_superadmin && (
              <Button variant="outline" size="sm" className="h-8 gap-1" onClick={onGiveRole}>
                <Plus className="size-4" /> Give CCG role
              </Button>
            )}
          </div>
          {user.assignments.length === 0 ? (
            <p className="text-sm text-muted-foreground">{user.is_superadmin ? 'The CCG owner: full access, no roles needed.' : 'No CCG role.'}</p>
          ) : (
            <ul className="divide-y divide-border rounded-lg border border-border">
              {user.assignments.map((a) => (
                <li key={a.id} className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
                  <span className="min-w-0 truncate">
                    {a.role.name}
                    {a.unit ? <span className="text-muted-foreground"> · {a.unit}</span> : <span className="text-muted-foreground"> · everywhere</span>}
                  </span>
                  <Button variant="ghost" size="sm" className="h-8 shrink-0 text-destructive hover:text-destructive" onClick={() => onEndRole(a)}>
                    End role
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={save} disabled={saving || !changed.length}>
            {saving && <Loader2 className="size-4 animate-spin" />}
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function GiveRoleDialog({ user, onClose, onDone }: { user: UserRow; onClose: () => void; onDone: () => void }) {
  const { portal } = useCcgFocus()
  const [all, setRoles] = useState<RoleOption[]>([])
  // Each portal hands out its own roles: Sheep Seeking roles only in the Sheep Seeking portal.
  const roles = all.filter((r) => roleInPortal(r, portal ?? 'ccg'))
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
