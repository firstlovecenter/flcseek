import { redirect } from 'next/navigation'

/** Members and converts have their own pages now. */
export default function CcgPeoplePage() {
  redirect('/ccg/converts')
}
