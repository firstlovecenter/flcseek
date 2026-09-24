'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { CheckCircle2, Link2Off, Loader2 } from 'lucide-react'
import { ccgApi } from '@/lib/ccg/client'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { Field } from './form-utils'

interface LinkInfo {
  purpose: 'invite' | 'reset'
  name: string
  sign_in_name: string
}

/**
 * Public: choose a password from a one-time link. The same page serves the
 * invitation a member gets when first given a role (/welcome/…) and a
 * "forgot password" link (/reset-password/…).
 */
export function SetPasswordPage({ token }: { token: string }) {
  const [info, setInfo] = useState<LinkInfo | null>(null)
  const [gone, setGone] = useState(false)
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [done, setDone] = useState<string | null>(null)

  useEffect(() => {
    ccgApi.get<LinkInfo>(`/public/invites/${encodeURIComponent(token)}`).then((r) => {
      if (r.ok) setInfo(r.data)
      else setGone(true)
    })
  }, [token])

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (password.length < 8) return setError('Use at least 8 characters')
    if (password !== confirm) return setError('The two passwords do not match')
    setError(null)
    setSaving(true)
    const r = await ccgApi.post<{ sign_in_name: string }>(`/public/invites/${encodeURIComponent(token)}`, { password })
    setSaving(false)
    if (!r.ok) {
      if (r.status === 404) return setGone(true)
      return setError(r.error.message)
    }
    setDone(r.data.sign_in_name)
  }

  const reset = info?.purpose === 'reset'

  return (
    <main className="min-h-dvh bg-muted/30 px-4 py-8 sm:py-12">
      <div className="mx-auto w-full max-w-md space-y-6">
        <p className="text-center text-sm font-semibold tracking-wide text-primary uppercase">City Church Group</p>

        {gone ? (
          <Card>
            <CardContent className="flex flex-col items-center gap-3 py-10 text-center">
              <Link2Off className="size-8 text-muted-foreground" aria-hidden />
              <p className="font-semibold">This link is no longer valid</p>
              <p className="text-sm text-muted-foreground">It may have been used already or expired.</p>
              <Button variant="outline" asChild className="mt-2">
                <Link href="/forgot-password">Send me a new link</Link>
              </Button>
            </CardContent>
          </Card>
        ) : done !== null ? (
          <Card>
            <CardContent className="flex flex-col items-center gap-3 py-10 text-center">
              <CheckCircle2 className="size-10 text-success" aria-hidden />
              <p className="text-lg font-semibold">Your password is set</p>
              <p className="text-sm text-muted-foreground">
                Sign in with <strong className="text-foreground">{done}</strong> and your new password.
              </p>
              <Button asChild className="mt-2">
                <Link href="/auth">Sign in</Link>
              </Button>
            </CardContent>
          </Card>
        ) : !info ? (
          <Skeleton className="h-72 rounded-xl" />
        ) : (
          <Card>
            <CardHeader>
              <CardTitle className="text-xl">{reset ? 'Choose a new password' : `Welcome, ${info.name}`}</CardTitle>
              <CardDescription>
                {reset ? 'For your login ' : 'Choose a password for your City Church Group login. You will sign in with '}
                <strong>{info.sign_in_name}</strong>
                {reset ? '. Any device signed in with your old password is signed out.' : '.'}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={submit} className="space-y-4" noValidate>
                {/* Lets password managers save the sign-in name with the new password. */}
                <input type="text" name="username" autoComplete="username" value={info.sign_in_name} readOnly hidden />
                <Field label="New password" htmlFor="sp-pass" hint="At least 8 characters">
                  <Input id="sp-pass" type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} />
                </Field>
                <Field label="Type it again" htmlFor="sp-confirm">
                  <Input id="sp-confirm" type="password" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} />
                </Field>
                {error && <p className="text-sm text-destructive">{error}</p>}
                <Button type="submit" className="w-full" disabled={saving}>
                  {saving && <Loader2 className="size-4 animate-spin" />}
                  {reset ? 'Save new password' : 'Set my password'}
                </Button>
              </form>
            </CardContent>
          </Card>
        )}
      </div>
    </main>
  )
}
