'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowRight, Sprout, UsersRound } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { availableApps, landingPathFor, seekLandingPath } from '@/lib/app-routing'
import { LoadingScreen } from '@/components/base/LoadingScreen'
import { SynagoLogo } from '@/components/shell/SynagoLogo'

/** App picker for people who hold both a Seek role and a CCG role. */
export default function AppsPage() {
  const { user, loading } = useAuth()
  const router = useRouter()
  const apps = availableApps(user)

  useEffect(() => {
    if (loading) return
    if (!user) router.replace('/auth')
    else if (apps.length < 2) router.replace(landingPathFor(user))
  }, [loading, user, apps.length, router])

  if (loading || !user || apps.length < 2) return <LoadingScreen fullScreen />

  const firstName = user.first_name?.trim()
  const cards = [
    {
      key: 'seek',
      title: 'Seek',
      body: 'Track new converts through milestones and Sunday attendance.',
      role: user.role ? user.role.charAt(0).toUpperCase() + user.role.slice(1) : '',
      icon: Sprout,
      href: seekLandingPath(user),
    },
    {
      key: 'ccg',
      title: 'City Church Group',
      body: 'Build CCGs, match converts to the right group, and follow their integration.',
      role: '',
      icon: UsersRound,
      href: '/ccg',
    },
  ]

  return (
    <div className="mx-auto flex min-h-[80dvh] max-w-3xl flex-col justify-center gap-8 py-8">
      <div className="space-y-2">
        <SynagoLogo size={40} surface="auto" />
        <h1 className="text-2xl font-semibold tracking-tight">
          {firstName ? `Welcome back, ${firstName}` : 'Welcome back'}
        </h1>
        <p className="text-muted-foreground">Choose where you want to work. You can switch from your account menu.</p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        {cards.map(({ key, title, body, role, icon: Icon, href }) => (
          <button
            key={key}
            type="button"
            onClick={() => router.push(href)}
            className="group flex flex-col items-start gap-4 rounded-xl border bg-card p-6 text-left transition-colors hover:border-primary/50 focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none"
          >
            <span className="flex size-11 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Icon className="size-5" />
            </span>
            <span className="space-y-1">
              <span className="block text-lg font-semibold">{title}</span>
              <span className="block text-sm text-muted-foreground">{body}</span>
            </span>
            <span className="mt-auto flex w-full items-center justify-between text-sm">
              <span className="rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium text-muted-foreground">{role}</span>
              <ArrowRight className="size-4 text-primary transition-transform group-hover:translate-x-0.5" />
            </span>
          </button>
        ))}
      </div>
    </div>
  )
}
