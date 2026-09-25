import type { LucideIcon } from 'lucide-react'
import { OrbField } from './Orbs'
import { cn } from '@/lib/utils'

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
  orb,
}: {
  icon?: LucideIcon
  title: string
  description?: string
  action?: React.ReactNode
  className?: string
  /** A quiet orb glow behind the message (opt-in). */
  orb?: boolean
}) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-border bg-card/50 p-12 text-center',
        orb && 'relative isolate overflow-hidden',
        className
      )}
    >
      {orb && <OrbField colors={['members', 'primary']} intensity={0.16} className="-z-10" />}
      {Icon && (
        <div className="flex size-12 items-center justify-center rounded-lg bg-muted">
          <Icon className="size-6 text-muted-foreground" />
        </div>
      )}
      <div className="space-y-1">
        <h3 className="font-semibold tracking-tight">{title}</h3>
        {description && (
          <p className="max-w-sm text-sm text-muted-foreground">{description}</p>
        )}
      </div>
      {action}
    </div>
  )
}
