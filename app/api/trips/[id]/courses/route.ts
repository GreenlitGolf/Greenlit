import { NextRequest }                 from 'next/server'
import { createClient }                from '@supabase/supabase-js'

const supabaseUrl     = process.env.NEXT_PUBLIC_SUPABASE_URL!
const serviceRoleKey  = process.env.SUPABASE_SERVICE_ROLE_KEY!

// ─── Auth helper ──────────────────────────────────────────────────────────────

async function getUserFromRequest(req: NextRequest): Promise<string | null> {
  const auth = req.headers.get('Authorization')
  if (!auth?.startsWith('Bearer ')) return null
  const token = auth.slice(7)

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
  const { data } = await supabase.auth.getUser(token)
  return data.user?.id ?? null
}

// ─── POST — add a course to a trip ───────────────────────────────────────────

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: tripId } = await params
  const userId = await getUserFromRequest(req)
  if (!userId) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { courseId } = await req.json() as { courseId?: string }
  if (!courseId) return Response.json({ error: 'courseId is required' }, { status: 400 })

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  // Verify user is a member of this trip
  const { data: membership } = await supabase
    .from('trip_members')
    .select('user_id')
    .eq('trip_id', tripId)
    .eq('user_id', userId)
    .single()

  if (!membership) return Response.json({ error: 'Not a member of this trip' }, { status: 403 })

  // Check if course is already in the trip
  const { data: existing } = await supabase
    .from('trip_courses')
    .select('id')
    .eq('trip_id', tripId)
    .eq('course_id', courseId)
    .single()

  if (existing) return Response.json({ already_added: true, id: existing.id }, { status: 200 })

  // Get course details for denormalized fields
  const { data: course } = await supabase
    .from('courses')
    .select('name, location')
    .eq('id', courseId)
    .single()

  // Insert into trip_courses
  const { data: inserted, error } = await supabase
    .from('trip_courses')
    .insert({
      trip_id:         tripId,
      course_id:       courseId,
      course_name:     course?.name     ?? null,
      course_location: course?.location ?? null,
      added_by:        userId,
    })
    .select()
    .single()

  if (error) return Response.json({ error: error.message }, { status: 500 })

  return Response.json(inserted, { status: 201 })
}

// ─── DELETE — remove a course from a trip ─────────────────────────────────────

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: tripId } = await params
  const userId = await getUserFromRequest(req)
  if (!userId) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { courseId } = await req.json() as { courseId?: string }
  if (!courseId) return Response.json({ error: 'courseId is required' }, { status: 400 })

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  // Verify membership
  const { data: membership } = await supabase
    .from('trip_members')
    .select('user_id')
    .eq('trip_id', tripId)
    .eq('user_id', userId)
    .single()

  if (!membership) return Response.json({ error: 'Not a member of this trip' }, { status: 403 })

  const { error } = await supabase
    .from('trip_courses')
    .delete()
    .eq('trip_id', tripId)
    .eq('course_id', courseId)

  if (error) return Response.json({ error: error.message }, { status: 500 })

  return Response.json({ deleted: true }, { status: 200 })
}

// ─── GET — check if a course is in the trip ──────────────────────────────────

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: tripId } = await params
  const userId = await getUserFromRequest(req)
  if (!userId) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const courseId = new URL(req.url).searchParams.get('courseId')
  if (!courseId) return Response.json({ error: 'courseId is required' }, { status: 400 })

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  const { data } = await supabase
    .from('trip_courses')
    .select('id')
    .eq('trip_id', tripId)
    .eq('course_id', courseId)
    .single()

  return Response.json({ added: !!data }, { status: 200 })
}
