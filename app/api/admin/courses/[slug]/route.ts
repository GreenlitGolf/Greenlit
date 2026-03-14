/**
 * POST /api/admin/courses/[slug]
 * Updates a course record in the courses table.
 * Auth: CRON_SECRET bearer token (re-uses existing admin secret).
 * Accepts a partial course object — only provided fields are updated.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createAdminSupabaseClient }  from '@/lib/supabase-server'

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  // ── Auth ────────────────────────────────────────────────────
  const authHeader = req.headers.get('authorization') ?? ''
  const expected   = `Bearer ${process.env.CRON_SECRET}`
  if (!process.env.CRON_SECRET || authHeader !== expected) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { slug } = await params
  const body     = await req.json().catch(() => ({}))

  if (!body || Object.keys(body).length === 0) {
    return NextResponse.json({ error: 'Empty body' }, { status: 400 })
  }

  const db = createAdminSupabaseClient()

  // Strip read-only fields that should never be overwritten
  const { id, created_at, updated_at, ...updateFields } = body

  // ── Update ──────────────────────────────────────────────────
  const { data, error } = await db
    .from('courses')
    .update({ ...updateFields, updated_at: new Date().toISOString() })
    .eq('slug', slug)
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  if (!data) {
    return NextResponse.json({ error: 'Course not found' }, { status: 404 })
  }

  return NextResponse.json({ course: data })
}
