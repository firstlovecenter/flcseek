import type { z } from 'zod'
import { success } from '@/lib/api/response'
import { isCcgOwner } from '@/lib/ccg/access'
import { userUpdateSchema } from '@/lib/ccg/schemas'
import { ensure, withCcg } from '@/lib/ccg/server/handler'
import { updateLogin } from '@/lib/ccg/server/user-admin'

export const dynamic = 'force-dynamic'

/**
 * PATCH /api/ccg/users/[id] { first_name?, last_name?, email?, phone? } (the CCG owner only) — edit
 * someone's login; a member's profile changes with it. A sign-in name that is their email follows it.
 */
export const PATCH = withCcg<z.infer<typeof userUpdateSchema>, { id: string }>({ schema: userUpdateSchema }, async ({ user, params, body }) => {
  ensure(await isCcgOwner(user.id), 'Only the CCG owner edits logins')
  return success(await updateLogin(params.id, body, user.id))
})
