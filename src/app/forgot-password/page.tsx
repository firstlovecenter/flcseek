'use client'

import { useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, Loader2, MailCheck } from 'lucide-react'
import { ccgApi } from '@/lib/ccg/client'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Field } from '@/components/ccg/form-utils'

/** Public: request a password reset link by email. */
export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [sent, setSent] = useState<string | null>(null)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email.trim()) return setError('Enter your email')
    setSaving(true)
    setError(null)
    const r = await ccgApi.post('/public/password/forgot', { email: email.trim() })
    setSaving(false)
    if (!r.ok) return setError(r.error.message)
    setSent(email.trim())
  }

  return (
    <main className="flex min-h-dvh items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md shadow-sm">
        {sent ? (
          <CardContent className="flex flex-col items-center gap-3 py-10 text-center">
            <MailCheck className="size-10 text-success" aria-hidden />
            <p className="text-lg font-semibold">Check your email</p>
            <p className="text-sm text-muted-foreground">
              If a login uses <strong className="text-foreground">{sent}</strong>, we have sent it a link to choose a new password. The link works once
              and expires in an hour.
            </p>
            <p className="text-xs text-muted-foreground">No email? Check your spam folder, or ask your admin to send you a password link.</p>
            <Button variant="outline" asChild className="mt-2">
              <Link href="/auth">
                <ArrowLeft className="size-4" />
                Back to sign in
              </Link>
            </Button>
          </CardContent>
        ) : (
          <>
            <CardHeader>
              <CardTitle className="text-xl">Forgot your password?</CardTitle>
              <CardDescription>Enter the email for your login and we will send you a link to choose a new one.</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={submit} className="space-y-4" noValidate>
                <Field label="Email" htmlFor="fp-email" error={error ?? undefined}>
                  <Input
                    id="fp-email"
                    type="email"
                    inputMode="email"
                    autoComplete="email"
                    className="min-h-11"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    aria-invalid={!!error}
                  />
                </Field>
                <Button type="submit" className="min-h-11 w-full" disabled={saving}>
                  {saving && <Loader2 className="size-4 animate-spin" />}
                  Send reset link
                </Button>
                <Button variant="ghost" asChild className="w-full">
                  <Link href="/auth">
                    <ArrowLeft className="size-4" />
                    Back to sign in
                  </Link>
                </Button>
              </form>
            </CardContent>
          </>
        )}
      </Card>
    </main>
  )
}
