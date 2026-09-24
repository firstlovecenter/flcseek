import { redirect } from 'next/navigation'

/** The Structure page was replaced by each group's own page (Synago's churches). */
export default function CcgStructurePage() {
  redirect('/ccg/groups')
}
