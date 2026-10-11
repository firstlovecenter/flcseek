'use client'

import { useCallback, useEffect, useState } from 'react'
import { Plus, X } from 'lucide-react'
import { ccgApi } from '@/lib/ccg/client'
import { message } from '@/lib/toast'
import { useConfirm } from '@/hooks/use-confirm'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { useInviteNotice } from './InviteNotice'
import { AppointDialog, HolderCard, type Appointed, type SeekerHolder } from './StreamSeekers'
import { SectionLabel } from './synago'

export type AdminUnitType = 'stream' | 'council' | 'ccg'

export const ADMIN_TITLE: Record<AdminUnitType, string> = { stream: 'Stream Admins', council: 'Council Admins', ccg: 'City Church Admins' }
const ONE: Record<AdminUnitType, string> = { stream: 'Stream Admin', council: 'Council Admin', ccg: 'City Church Admin' }
const ABOUT: Record<AdminUnitType, (where: string) => string> = {
  stream: (w) => `Stream Admins help the Stream Leader run ${w}: its CCGs and CCFs, members and converts.`,
  council: (w) => `Council Admins help the Council Leader run ${w}: its CCGs and CCFs, members and converts.`,
  ccg: (w) => `City Church Admins help the Overseer run ${w}: its CCFs, members, converts and activities.`,
}

/**
 * A stream's, council's or CCG's admins (any number). Its leader, those above
 * it and the central team add and stand them down; everyone who can see the
 * unit sees them.
 */
export function UnitAdmins({ type, id, name, onChanged }: { type: AdminUnitType; id: string; name: string; onChanged?: () => void }) {
  const [data, setData] = useState<{ admins: SeekerHolder[]; can_appoint: boolean } | null>(null)
  const [open, setOpen] = useState(false)
  const { confirm, ConfirmDialog } = useConfirm()
  const { show, notice } = useInviteNotice()
  const path = `/groups/${type}/${id}/admins`

  const load = useCallback(() => {
    ccgApi.get<{ admins: SeekerHolder[]; can_appoint: boolean }>(path).then((r) => setData(r.ok ? r.data : { admins: [], can_appoint: false }))
  }, [path])
  useEffect(() => {
    load()
  }, [load])
  const changed = () => {
    load()
    onChanged?.()
  }

  const standDown = async (h: SeekerHolder) => {
    const ok = await confirm({ title: `Stand ${h.name} down?`, description: `They stop being a ${ONE[type]} of ${name}.`, confirmLabel: 'Stand down', destructive: true })
    if (!ok) return
    const r = await ccgApi.del(`${path}/${h.assignment_id}`)
    if (!r.ok) return message.error(r.error.message)
    message.success(`${h.name} stood down`)
    changed()
  }

  return (
    <section>
      <SectionLabel
        action={
          data?.can_appoint ? (
            <Button variant="ghost" size="sm" className="h-8 gap-1" onClick={() => setOpen(true)}>
              <Plus className="size-4" /> Add admin
            </Button>
          ) : null
        }
      >
        {ADMIN_TITLE[type]}
      </SectionLabel>
      {!data ? (
        <Skeleton className="h-16 rounded-xl sm:max-w-sm" />
      ) : data.admins.length ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {data.admins.map((h) => (
            <HolderCard
              key={h.assignment_id}
              h={h}
              action={
                data.can_appoint && (
                  <Button variant="ghost" size="icon" className="size-9 shrink-0" onClick={() => standDown(h)} aria-label={`Stand ${h.name} down`}>
                    <X className="size-4" />
                  </Button>
                )
              }
            />
          ))}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">No admins yet. {ABOUT[type](name)}</p>
      )}
      <AppointDialog
        open={open}
        title={`Add a ${ONE[type]}`}
        description={ABOUT[type](name)}
        submitLabel="Add admin"
        onClose={() => setOpen(false)}
        submit={async (payload, who) => {
          const r = await ccgApi.post<Appointed>(path, payload)
          if (!r.ok) message.error(r.error.message)
          else {
            message.success(r.data.reused ? `${who} is already in the app: now a ${ONE[type]} of ${name}` : `${who} is now a ${ONE[type]} of ${name}`)
            show(who, r.data.invite, changed)
          }
          return r
        }}
      />
      {ConfirmDialog}
      {notice}
    </section>
  )
}
