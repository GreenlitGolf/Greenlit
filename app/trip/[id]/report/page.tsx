import { redirect, notFound } from 'next/navigation'
import { createAdminSupabaseClient } from '@/lib/supabase-server'

/**
 * /trip/[id]/report — redirects the organizer to their shareable trip report.
 * Logged-in user sees their own report with the organizer edit banner.
 */
export default async function TripReportRedirect({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id }   = await params
  const supabase = createAdminSupabaseClient()

  const { data: trip } = await supabase
    .from('trips')
    .select('share_token')
    .eq('id', id)
    .single()

  if (!trip?.share_token) return notFound()

  redirect(`/share/${trip.share_token}`)
}
