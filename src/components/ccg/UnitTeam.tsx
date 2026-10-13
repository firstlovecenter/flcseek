'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Pencil, Plus } from 'lucide-react'
import { ccgApi } from '@/lib/ccg/client'
import { message } from '@/lib/toast'
import { useConfirm } from '@/hooks/use-confirm'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { useInviteNotice } from './InviteNotice'
import { AppointDialog, type Appointed } from './StreamSeekers'
import { LEADER_TITLE, type GroupType } from './GroupCard'
import { Initials } from './synago'

export type AdminUnitType = Exclude<GroupType, 'ccf'>
export const ADMIN_KEY: Record<AdminUnitType, string> = { campus: 'campus_admin', stream: 'stream_admin', council: 'council_admin', ccg: 'ccg_group_admin' }
const ONE: Record<AdminUnitType, string> = { campus: 'Campus Admin', stream: 'Stream Admin', council: 'Council Admin', ccg: 'City Church Admin' }
const ADMIN_ABOUT: Record<AdminUnitType, (where: string) => string> = {
  campus: (w) => `Campus Admins help the Campus Leader run ${w}: every stream, council, CCG and CCF in it, their members and converts.`,
  stream: (w) => `Stream Admins help the Stream Leader run ${w}: its CCGs and CCFs, members and converts.`,
  council: (w) => `Council Admins help the Council Leader run ${w}: its CCGs and CCFs, members and converts.`,
  ccg: (w) => `City Church Admins help the Overseer run ${w}: its CCFs, members, converts and activities.`,
}

export interface TeamHolder {
  assignment_id: string
  person_id: string | null
  name: string
}

const memberHref = (personId: string | null) => (personId ? `/ccg/members?person=${personId}` : undefined)

/**
 * A unit's leader and its admins, as the admin portal's church details show
 * them: the leader's avatar, and beside it the admins with one edit button
 * (Add admin / Change) for whoever appoints them. The leader is changed on the
 * unit's Edit page. A CCF has a leader only.
 */
export function UnitTeam({
  type,
  id,
  name,
  leader,
  admins,
  canAppoint,
  onChanged,
}: {
  type: GroupType
  id: string
  name: string
  leader: { person_id: string | null; name: string } | null
  admins: TeamHolder[]
  canAppoint: boolean
  onChanged: () => void
}) {
  const [dialog, setDialog] = useState<'manage' | 'add' | null>(null)
  const { confirm, ConfirmDialog } = useConfirm()
  const { show, notice } = useInviteNotice()
  const adminType = type === 'ccf' ? null : type
  const leaderHref = memberHref(leader?.person_id ?? null)

  const standDown = async (h: TeamHolder) => {
    if (!adminType) return
    setDialog(null)
    const ok = await confirm({ title: `Stand ${h.name} down?`, description: `They stop being a ${ONE[adminType]} of ${name}.`, confirmLabel: 'Stand down', destructive: true })
    if (!ok) return setDialog('manage')
    const r = await ccgApi.del(`/groups/${type}/${id}/admins/${h.assignment_id}`)
    if (!r.ok) return message.error(r.error.message)
    message.success(`${h.name} stood down`)
    onChanged()
  }

  const leaderInner = (
    <>
      <Initials name={leader?.name ?? '?'} />
      <div className="min-w-0">
        <p className="text-xs text-muted-foreground">{LEADER_TITLE[type]}</p>
        <p className="truncate text-sm font-semibold text-foreground">{leader?.name ?? 'Not assigned yet'}</p>
      </div>
    </>
  )

  return (
    <div>
      {leader && leaderHref ? (
        <Link href={leaderHref} className="flex w-fit min-w-0 items-center gap-3 py-3 transition-opacity hover:opacity-80">
          {leaderInner}
        </Link>
      ) : (
        <div className="flex min-w-0 items-center gap-3 py-3">{leaderInner}</div>
      )}

      {adminType && (admins.length > 0 || canAppoint) && (
        <div className="-mt-2 flex flex-wrap items-center gap-x-3 gap-y-1">
          <span className="shrink-0 text-xs font-medium tracking-wide text-muted-foreground uppercase">{admins.length > 1 ? 'Admins' : 'Admin'}</span>
          {admins.map((h) => {
            const href = memberHref(h.person_id)
            const inner = (
              <>
                <Initials name={h.name} className="size-6 text-[10px]" />
                <span className="truncate text-xs font-medium text-foreground">{h.name}</span>
              </>
            )
            return href ? (
              <Link key={h.assignment_id} href={href} className="flex min-h-11 min-w-0 items-center gap-2 transition-opacity hover:opacity-80">
                {inner}
              </Link>
            ) : (
              <span key={h.assignment_id} className="flex min-h-11 min-w-0 items-center gap-2">
                {inner}
              </span>
            )
          })}
          {canAppoint && (
            <Button variant="ghost" size="sm" className="h-8 gap-1 px-2 text-xs" onClick={() => setDialog(admins.length ? 'manage' : 'add')}>
              <Pencil className="size-3" />
              {admins.length ? 'Change' : 'Add admin'}
            </Button>
          )}
        </div>
      )}

      {adminType && (
        <>
          <Dialog open={dialog === 'manage'} onOpenChange={(o) => !o && setDialog(null)}>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>{ONE[adminType]}s of {name}</DialogTitle>
                <DialogDescription>{ADMIN_ABOUT[adminType](name)}</DialogDescription>
              </DialogHeader>
              <ul className="divide-y divide-border rounded-lg border border-border">
                {admins.map((h) => (
                  <li key={h.assignment_id} className="flex items-center gap-3 px-3 py-2">
                    <Initials name={h.name} className="size-8 text-xs" />
                    <span className="min-w-0 flex-1 truncate text-sm font-medium">{h.name}</span>
                    <Button variant="ghost" size="sm" className="h-8 text-destructive hover:text-destructive" onClick={() => standDown(h)}>
                      Stand down
                    </Button>
                  </li>
                ))}
              </ul>
              <DialogFooter>
                <Button variant="outline" onClick={() => setDialog(null)}>
                  Close
                </Button>
                <Button onClick={() => setDialog('add')} className="gap-1">
                  <Plus className="size-4" /> Add admin
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
          <AppointDialog
            open={dialog === 'add'}
            title={`Add a ${ONE[adminType]}`}
            description={ADMIN_ABOUT[adminType](name)}
            submitLabel="Add admin"
            searchFirst
            onClose={() => setDialog(null)}
            submit={async (payload, who) => {
              const r = await ccgApi.post<Appointed>(`/groups/${type}/${id}/admins`, payload)
              if (!r.ok) message.error(r.error.message)
              else {
                message.success(r.data.reused ? `${who} is already in the app: now a ${ONE[adminType]} of ${name}` : `${who} is now a ${ONE[adminType]} of ${name}`)
                show(who, r.data.invite, onChanged)
              }
              return r
            }}
          />
        </>
      )}
      {ConfirmDialog}
      {notice}
    </div>
  )
}
