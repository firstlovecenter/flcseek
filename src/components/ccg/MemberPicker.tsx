'use client'

import { useEffect, useState } from 'react'
import { Loader2, Search, X } from 'lucide-react'
import { ccgApi } from '@/lib/ccg/client'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import type { PersonDTO } from './people-types'

export interface PickedMember {
  id: string
  name: string
}

/**
 * Search-as-you-type for an active member to give a role (every role is held
 * by a member). Members with no login are emailed an invitation, so one with
 * no email address cannot be picked until it is added.
 */
export function MemberPicker({
  id,
  value,
  onChange,
  invalid,
}: {
  id?: string
  value: PickedMember | null
  onChange: (m: PickedMember | null) => void
  invalid?: boolean
}) {
  const [query, setQuery] = useState('')
  const [hits, setHits] = useState<PersonDTO[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    const q = query.trim()
    if (q.length < 2) {
      setHits([])
      return
    }
    setLoading(true)
    const t = setTimeout(async () => {
      const r = await ccgApi.get<{ people: PersonDTO[] }>(`/people?kind=member&status=active&limit=10&search=${encodeURIComponent(q)}`)
      setHits(r.ok ? r.data.people : [])
      setLoading(false)
    }, 250)
    return () => clearTimeout(t)
  }, [query])

  if (value) {
    return (
      <div className="flex h-9 items-center justify-between gap-2 rounded-md border bg-muted/40 pl-3 text-sm">
        <span className="truncate">{value.name}</span>
        <Button type="button" variant="ghost" size="icon" className="size-8" aria-label="Clear" onClick={() => onChange(null)}>
          <X className="size-4" />
        </Button>
      </div>
    )
  }

  return (
    <div className="relative">
      <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
      <Input
        id={id}
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search members by name or phone…"
        className="pl-9"
        autoComplete="off"
        aria-invalid={invalid}
      />
      {loading && <Loader2 className="absolute top-1/2 right-3 size-4 -translate-y-1/2 animate-spin text-muted-foreground" />}
      {hits.length > 0 && (
        <ul role="listbox" aria-label="Matching members" className="absolute z-50 mt-1 max-h-64 w-full overflow-y-auto rounded-md border bg-popover shadow-md">
          {hits.map((h) => {
            const blocked = !h.login && !h.email
            return (
              <li key={h.id}>
                <button
                  type="button"
                  role="option"
                  aria-selected={false}
                  disabled={blocked}
                  onClick={() => {
                    onChange({ id: h.id, name: h.full_name })
                    setQuery('')
                    setHits([])
                  }}
                  className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm hover:bg-accent disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <span className="min-w-0">
                    <span className="block truncate">{h.full_name}</span>
                    <span className="block truncate text-xs text-muted-foreground">
                      {h.ccf?.name ?? ''}
                      {blocked ? ' · add an email to their profile first' : h.login ? '' : ` · invitation goes to ${h.email}`}
                    </span>
                  </span>
                  {h.login && (
                    <Badge variant="outline" className="shrink-0">
                      Has login
                    </Badge>
                  )}
                </button>
              </li>
            )
          })}
        </ul>
      )}
      {query.trim().length >= 2 && !loading && hits.length === 0 && (
        <p className="mt-1 text-xs text-muted-foreground">No active member matches. Leaders and role holders are chosen from members.</p>
      )}
    </div>
  )
}
