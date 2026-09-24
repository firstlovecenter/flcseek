import { success } from '@/lib/api/response'
import { changePasswordSchema } from '@/lib/ccg/schemas'
import { withCcg } from '@/lib/ccg/server/handler'
import { changePassword } from '@/lib/ccg/server/member-login'

export const dynamic = 'force-dynamic'

/**
 * POST /api/ccg/account/password — change your own password. Every session,
 * this one included, is signed out: sign in again with the new password.
 */
export const POST = withCcg<{ current_password: string; new_password: string }>({ schema: changePasswordSchema }, async ({ user, body }) => {
  await changePassword(user.id, body.current_password, body.new_password)
  return success({ changed: true })
})
