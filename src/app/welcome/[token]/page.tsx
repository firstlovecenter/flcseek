'use client'

import { use } from 'react'
import { SetPasswordPage } from '@/components/ccg/SetPasswordPage'

/** Public: a member given a role opens the emailed invitation and chooses their own password. */
export default function WelcomePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params)
  return <SetPasswordPage token={token} />
}
