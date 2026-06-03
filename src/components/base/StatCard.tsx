import type { LucideIcon } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'

const accentMap = {
  members: 'members',
  churches: 'churches',
  arrivals: 'arrivals',
  defaulters: 'defaulters',
  banking: 'banking',
  campaigns: 'campaigns',
  maps: 'maps',
  primary: 'primary',
} as const

export type StatAccent = keyof typeof accentMap

export function StatCard({
  title,
  value,
  subtitle,
  icon: Icon,
  accent = 'primary',
  delta,
  deltaPositive,
  loading,
  compact,
  className,
}: {
  title: string
  value: string | number
  subtitle?: string
  icon?: LucideIcon
  accent?: StatAccent
  delta?: string
  deltaPositive?: boolean
  loading?: boolean
  compact?: boolean
  className?: string
}) {
  const color = accentMap[accent] ?? 'primary'

  const content = (
    <Card className={cn(compact && 'md:hidden', className)}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          {title}
        </CardTitle>
        {Icon && (
          <div
            className={cn(
              'flex size-10 items-center justify-center rounded-lg',
              `bg-${color}/10`
            )}
            style={{
              backgroundColor: `hsl(var(--${color}) / 0.1)`,
            }}
          >
            <Icon
              className="size-5"
              style={{ color: `hsl(var(--${color}))` }}
            />
          </div>
        )}
      </CardHeader>
      <CardContent>
        {loading ? (
          <Skeleton className="h-8 w-24" />
        ) : (
          <div className="text-3xl font-semibold tracking-tight tabular-nums">
            {value}
          </div>
        )}
        {(subtitle || delta) && (
          <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
            {subtitle && <span>{subtitle}</span>}
            {delta && (
              <span
                className={cn(
                  'rounded-md px-1.5 py-0.5 font-medium',
                  deltaPositive
                    ? 'bg-success/15 text-success'
                    : 'bg-destructive/15 text-destructive'
                )}
              >
                {delta}
              </span>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )

  if (!compact) return content

  return (
    <>
      {content}
      <Card className={cn('hidden md:block', className)}>
        <CardContent className="flex items-center gap-4 p-4">
          {Icon && (
            <div
              className="flex size-12 shrink-0 items-center justify-center rounded-lg"
              style={{ backgroundColor: `hsl(var(--${color}) / 0.1)` }}
            >
              <Icon className="size-6" style={{ color: `hsl(var(--${color}))` }} />
            </div>
          )}
          <div className="min-w-0 flex-1">
            <p className="text-sm text-muted-foreground">{title}</p>
            {loading ? (
              <Skeleton className="mt-1 h-7 w-20" />
            ) : (
              <p className="text-2xl font-semibold tracking-tight tabular-nums">
                {value}
              </p>
            )}
          </div>
        </CardContent>
      </Card>
    </>
  )
}
