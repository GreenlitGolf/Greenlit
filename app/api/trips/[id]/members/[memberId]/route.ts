import { NextRequest, NextResponse } from 'next/server'
import { createAdminSupabaseClient } from '@/lib/supabase-server'

type Params = { params: Promise<{ id: string; memberId: string }> }

// PATCH /api/trips/[id]/members/[memberId] — update display_name, handicap, role
export async function PATCH(req: NextRequest, { params }: Params) {
  const { id: tripId, memberId } = await params
  const body = await req.json()

  const allowed = ['display_name', 'handicap', 'email', 'role', 'invite_status']
  const updates: Record<string, unknown> = {}
  for (const key of allowed) {
    if (key in body) updates[key] = body[key]
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 })
  }

  const db = createAdminSupabaseClient()

  const { data, error } = await db
    .from('trip_members')
    .update(updates)
    .eq('id', memberId)
    .eq('trip_id', tripId)
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(data)
}

// DELETE /api/trips/[id]/members/[memberId]
export async function DELETE(_req: NextRequest, { params }: Params) {
  const { id: tripId, memberId } = await params
  const db = createAdminSupabaseClient()

  const { error } = await db
    .from('trip_members')
    .delete()
    .eq('id', memberId)
    .eq('trip_id', tripId)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
