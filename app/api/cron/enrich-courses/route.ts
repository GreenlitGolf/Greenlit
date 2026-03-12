import { NextRequest, NextResponse } from 'next/server'
import { createClient }              from '@supabase/supabase-js'
import { enrichCourse }              from '@/lib/enrichCourse'
import type { EnrichMode }           from '@/lib/enrichCourse'

export const maxDuration = 60

function adminSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  )
}

export async function POST(req: NextRequest) {
  // ── Auth ─────────────────────────────────────────────────
  const authHeader = req.headers.get('authorization') ?? ''
  const expected   = `Bearer ${process.env.CRON_SECRET}`
  if (!process.env.CRON_SECRET || authHeader !== expected) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // ── Parse optional mode from request body ────────────────
  let mode: EnrichMode = 'standard'
  try {
    const body = await req.json()
    if (body?.mode === 'deep') mode = 'deep'
  } catch {
    // GET requests or empty bodies — default to standard
  }

  const db = adminSupabase()

  // ── Claim the next pending course (priority first) ────────
  const { data: item } = await db
    .from('course_queue')
    .select('*')
    .eq('status', 'pending')
    .order('priority',   { ascending: false })
    .order('created_at', { ascending: true })
    .limit(1)
    .single()

  if (!item) return NextResponse.json({ message: 'Queue empty' })

  // Mark as processing immediately to prevent double-processing
  await db.from('course_queue')
    .update({ status: 'processing' })
    .eq('id', item.id)

  const result = await enrichCourse(
    item.name,
    item.location,
    item.country ?? '',
    item.id,
    db,
    mode,
  )

  if (!result.success) {
    if ('isPrivate' in result) {
      return NextResponse.json({ status: 'private',      course: item.name, reason: result.reason })
    }
    if ('isRateLimit' in result) {
      return NextResponse.json({ status: 'rate_limited', course: item.name, error: result.error }, { status: 429 })
    }
    return NextResponse.json({ status: 'failed', course: item.name, error: result.error }, { status: 500 })
  }

  return NextResponse.json({
    status  : 'complete',
    course  : result.name,
    location: result.location,
    slug    : result.slug,
    mode,
  })
}

// Vercel Cron calls GET
export const GET = POST
