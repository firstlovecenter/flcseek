'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { KeyRound, Loader2 } from 'lucide-react'
import { ccgApi, fieldErrors } from '@/lib/ccg/client'
import { message } from '@/lib/toast'
import { useAuth } from '@/contexts/AuthContext'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { CcgPageHeader } from '@/components/ccg/PageHeader'
import { useCcgMe } from '@/components/ccg/CcgMeProvider'
import { Field } from '@/components/ccg/form-utils'

/** Your login: who you are signed in as, your roles, and changing your password. */
export default function CcgAccountPage() {
  const { me } = useCcgMe()
  const { logout } = useAuth()
  const router = useRouter()
  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const [confirm, setConfirm] = useState('')
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    const local: Record<string, string> = {}
    if (!current) local.current_password = 'Enter your current password'
    if (next.length < 8) local.new_password = 'Use at least 8 characters'
    else if (next !== confirm) local.confirm = 'The two passwords do not match'
    setErrors(local)
    if (Object.keys(local).length) return
    setSaving(true)
    const r = await ccgApi.post('/account/password', { current_password: current, new_password: next })
    setSaving(false)
    if (!r.ok) {
      setErrors(fieldErrors(r.error))
      return message.error(r.error.message)
    }
    message.success('Password changed. Sign in with your new password.')
    await logout()
    router.push('/auth')
  }

  return (
    <div className="space-y-6">
      <CcgPageHeader title="Account" description={me ? `Signed in as ${me.user.username}` : undefined} />

      {me && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{me.user.name}</CardTitle>
            <CardDescription>
              {me.is_superadmin
                ? 'Seek superadmin: full access to City Church Group.'
                : me.roles.map((r) => `${r.role.name}${r.unit ? `, ${r.unit.name}` : ''}`).join(' · ') || 'No roles'}
            </CardDescription>
          </CardHeader>
        </Card>
      )}

      <Card className="max-w-lg">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <KeyRound className="size-4 text-muted-foreground" aria-hidden />
            Change password
          </CardTitle>
          <CardDescription>You will be signed out everywhere and sign in again with the new password.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={submit} className="space-y-4" noValidate>
            <input type="text" name="username" autoComplete="username" value={me?.user.username ?? ''} readOnly hidden />
            <Field label="Current password" htmlFor="a-current" error={errors.current_password}>
              <Input id="a-current" type="password" autoComplete="current-password" value={current} onChange={(e) => setCurrent(e.target.value)} />
            </Field>
            <Field label="New password" htmlFor="a-new" error={errors.new_password} hint="At least 8 characters">
              <Input id="a-new" type="password" autoComplete="new-password" value={next} onChange={(e) => setNext(e.target.value)} />
            </Field>
            <Field label="Type it again" htmlFor="a-confirm" error={errors.confirm}>
              <Input id="a-confirm" type="password" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} />
            </Field>
            <Button type="submit" disabled={saving}>
              {saving && <Loader2 className="size-4 animate-spin" />}
              Change password
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
