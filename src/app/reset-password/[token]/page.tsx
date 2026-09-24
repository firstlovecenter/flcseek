'use client'

import { use } from 'react'
import { SetPasswordPage } from '@/components/ccg/SetPasswordPage'

/** Public: choose a new password from a "forgot password" email. */
export default function ResetPasswordPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params)
  return <SetPasswordPage token={token} />
}
