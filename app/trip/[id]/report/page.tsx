import { redirect, notFound } from 'next/navigation'
import { createAdminSupabaseClient } from '@/lib/supabase-server'

/**
 * /trip/[id]/report — redirects the organizer to their shareable trip report.
 * Passes ?pdf=true through to auto-trigger print dialog.
 */
export default async function TripReportRedirect({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ pdf?: string }>
}) {
  const { id }   = await params
  const sp       = await searchParams
  const supabase = createAdminSupabaseClient()

  const { data: trip } = await supabase
    .from('trips')
    .select('share_token')
    .eq('id', id)
    .single()

  if (!trip?.share_token) return notFound()

  const suffix = sp.pdf === 'true' ? '?pdf=true' : ''
  redirect(`/share/${trip.share_token}${suffix}`)
}
