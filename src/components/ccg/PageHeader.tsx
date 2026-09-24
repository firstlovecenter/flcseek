import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'

export function CcgPageHeader({
  title,
  description,
  back,
  actions,
}: {
  title: React.ReactNode
  description?: React.ReactNode
  back?: { href: string; label: string }
  actions?: React.ReactNode
}) {
  return (
    <div className="mb-6 space-y-3">
      {back && (
        <Link
          href={back.href}
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ChevronLeft className="size-4" />
          {back.label}
        </Link>
      )}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
          {description && <p className="text-sm text-muted-foreground">{description}</p>}
        </div>
        {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
      </div>
    </div>
  )
}
