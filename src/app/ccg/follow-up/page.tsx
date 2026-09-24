import { redirect } from 'next/navigation'

/** Follow-up is now the converts page's default (milestones) view. */
export default async function CcgFollowUpPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = new URLSearchParams()
  for (const [k, v] of Object.entries(await searchParams)) if (typeof v === 'string') params.set(k, v)
  redirect(`/ccg/converts${params.size ? `?${params}` : ''}`)
}
