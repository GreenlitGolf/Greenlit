import { NextRequest, NextResponse } from 'next/server'
import { createAdminSupabaseClient } from '@/lib/supabase-server'

// POST /api/trips/[id]/members — add a ghost member
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const { id: tripId } = params
  const { display_name, email, handicap } = await req.json()

  if (!display_name?.trim()) {
    return NextResponse.json({ error: 'display_name is required' }, { status: 400 })
  }

  const db = createAdminSupabaseClient()

  const { data, error } = await db
    .from('trip_members')
    .insert({
      trip_id:     tripId,
      user_id:     null,
      member_type: 'ghost',
      role:        'member',
      display_name: display_name.trim(),
      email:       email?.trim() || null,
      handicap:    handicap != null ? Number(handicap) : null,
      status:      'accepted',
      invite_status: email?.trim() ? 'pending' : 'accepted',
    })
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(data, { status: 201 })
}

// GET /api/trips/[id]/members — list all members
export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const { id: tripId } = params
  const db = createAdminSupabaseClient()

  const { data, error } = await db
    .from('trip_members')
    .select('id, user_id, display_name, email, handicap, role, member_type, invite_status, status, created_at, profiles(display_name, avatar_url)')
    .eq('trip_id', tripId)
    .order('created_at', { ascending: true })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(data)
}
