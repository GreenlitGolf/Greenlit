/**
 * POST /api/admin/reset-queue
 * Resets one or more course_queue entries back to pending so they can be re-enriched.
 * Accepts { ids: string[] } to reset specific rows, or { missingPhotos: true }
 * to reset all complete rows whose corresponding course has no google_place_id.
 * Auth: CRON_SECRET header (re-uses existing admin secret).
 */

import { NextRequest, NextResponse }    from 'next/server'
import { createAdminSupabaseClient }    from '@/lib/supabase-server'

export async function POST(req: NextRequest) {
  const secret = req.headers.get('authorization')?.replace('Bearer ', '')
  if (!secret || secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await req.json().catch(() => ({}))
  const db   = createAdminSupabaseClient()

  // ── Mode 1: reset specific queue IDs ──────────────────────────────────────
  if (Array.isArray(body.ids) && body.ids.length > 0) {
    const { error, count } = await db
      .from('course_queue')
      .update({ status: 'pending', processed_at: null, notes: null })
      .in('id', body.ids)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ reset: count ?? body.ids.length })
  }

  // ── Mode 2: reset all complete courses with no google_place_id ────────────
  if (body.missingPhotos === true) {
    // Find course names that are complete in queue but have no Place ID in courses table
    const { data: missingRows, error: fetchErr } = await db
      .from('course_queue')
      .select('id, name')
      .eq('status', 'complete')

    if (fetchErr) return NextResponse.json({ error: fetchErr.message }, { status: 500 })
    if (!missingRows?.length) return NextResponse.json({ reset: 0 })

    // Cross-reference with courses table
    const names = missingRows.map((r) => r.name)
    const { data: coursesWithPhotos } = await db
      .from('courses')
      .select('name')
      .in('name', names)
      .not('google_place_id', 'is', null)

    const withPhotosSet = new Set((coursesWithPhotos ?? []).map((c) => c.name.toLowerCase()))
    const toReset       = missingRows.filter((r) => !withPhotosSet.has(r.name.toLowerCase()))

    if (toReset.length === 0) return NextResponse.json({ reset: 0 })

    const { error: updateErr, count } = await db
      .from('course_queue')
      .update({ status: 'pending', processed_at: null, notes: null })
      .in('id', toReset.map((r) => r.id))

    if (updateErr) return NextResponse.json({ error: updateErr.message }, { status: 500 })
    return NextResponse.json({ reset: count ?? toReset.length })
  }

  return NextResponse.json({ error: 'Provide ids[] or missingPhotos:true' }, { status: 400 })
}
