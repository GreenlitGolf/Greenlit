import { NextRequest, NextResponse }   from 'next/server'
import { createClient }               from '@supabase/supabase-js'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { enrichCourse }               from '@/lib/enrichCourse'

export const maxDuration = 300

function adminSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  )
}

export async function POST(req: NextRequest) {
  // ── Auth: verify Supabase session token ──────────────────
  const authHeader = req.headers.get('authorization') ?? ''
  const token      = authHeader.replace('Bearer ', '').trim()
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: { user } } = await createServerSupabaseClient().auth.getUser(token)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const name     : string = body.name     ?? ''
  const location : string = body.location ?? ''
  const country  : string = body.country  ?? ''

  if (!name || !location) {
    return NextResponse.json({ error: 'name and location are required' }, { status: 400 })
  }

  const db = adminSupabase()

  // ── 1. Return immediately if already in courses table ─────
  const { data: existing } = await db
    .from('courses')
    .select('slug, name, location')
    .ilike('name', name)
    .limit(1)
    .single()

  if (existing) {
    return NextResponse.json({
      status  : 'exists',
      slug    : existing.slug,
      name    : existing.name,
      location: existing.location,
    })
  }

  // ── 2. Find or create queue entry with priority ───────────
  let queueId: string

  const { data: queueItem } = await db
    .from('course_queue')
    .select('id, status')
    .ilike('name', name)
    .limit(1)
    .single()

  if (queueItem) {
    queueId = queueItem.id

    // If already processing/complete/private, don't re-run
    if (queueItem.status !== 'pending' && queueItem.status !== 'failed') {
      return NextResponse.json({
        status : 'queued',
        message: 'Course is being researched — check back shortly',
      })
    }

    await db.from('course_queue')
      .update({ priority: true, status: 'pending', notes: null })
      .eq('id', queueId)
  } else {
    const { data: inserted, error: insertErr } = await db
      .from('course_queue')
      .insert({ name, location, country: country || null, priority: true, status: 'pending' })
      .select('id')
      .single()

    if (insertErr || !inserted) {
      return NextResponse.json({ error: 'Failed to queue course' }, { status: 500 })
    }
    queueId = inserted.id
  }

  // ── 3. Mark as processing ─────────────────────────────────
  await db.from('course_queue')
    .update({ status: 'processing' })
    .eq('id', queueId)

  // ── 4. Enrich inline with a 50-second safety timeout ──────
  // If enrichment finishes: return the result
  // If it times out: reset to pending (priority stays true) and return queued
  const TIMEOUT_MS = 50_000

  const timeoutPromise = new Promise<{ timedOut: true }>((resolve) =>
    setTimeout(() => resolve({ timedOut: true }), TIMEOUT_MS),
  )

  const result = await Promise.race([
    enrichCourse(name, location, country, queueId, db),
    timeoutPromise,
  ])

  if ('timedOut' in result) {
    // Reset so the cron job picks it up next run
    await db.from('course_queue')
      .update({ status: 'pending', priority: true })
      .eq('id', queueId)
    return NextResponse.json({
      status : 'queued',
      message: 'Course is being researched — check back shortly',
    })
  }

  if (!result.success) {
    if ('isPrivate' in result) {
      return NextResponse.json({ status: 'private', reason: result.reason })
    }
    // Rate limit or other failure — course is already reset to pending/failed by enrichCourse
    return NextResponse.json({
      status : 'queued',
      message: 'Course added to research queue',
    })
  }

  return NextResponse.json({
    status  : 'complete',
    slug    : result.slug,
    name    : result.name,
    location: result.location,
  })
}
