import { NextRequest } from 'next/server'
import { createAdminSupabaseClient } from '@/lib/supabase-server'

// ── Auth helper ──────────────────────────────────────────────────────────────

function isAuthorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET
  if (!secret) return false
  const auth = req.headers.get('authorization')
  return auth === `Bearer ${secret}`
}

// ── GET — list / filter knowledge entries ────────────────────────────────────

export async function GET(req: NextRequest) {
  if (!isAuthorized(req)) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const supabase = createAdminSupabaseClient()
  const url      = new URL(req.url)
  const category = url.searchParams.get('category')
  const platform = url.searchParams.get('platform')
  const search   = url.searchParams.get('search')
  const active   = url.searchParams.get('active')

  let query = supabase
    .from('concierge_knowledge')
    .select('*')
    .order('created_at', { ascending: false })

  if (category) query = query.eq('category', category)
  if (platform) query = query.eq('source_platform', platform)
  if (active === 'true')  query = query.eq('is_active', true)
  if (active === 'false') query = query.eq('is_active', false)
  if (search) query = query.ilike('content', `%${search}%`)

  const { data, error } = await query

  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json({ data })
}

// ── POST — create new entry ──────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  if (!isAuthorized(req)) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const supabase = createAdminSupabaseClient()
  const body     = await req.json()

  const { data, error } = await supabase
    .from('concierge_knowledge')
    .insert({
      title:             body.title,
      content:           body.content,
      category:          body.category,
      source_url:        body.source_url || null,
      source_platform:   body.source_platform || null,
      source_author:     body.source_author || null,
      destinations:      body.destinations || [],
      courses_mentioned: body.courses_mentioned || [],
      tags:              body.tags || [],
      is_active:         body.is_active ?? true,
    })
    .select()
    .single()

  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json({ data }, { status: 201 })
}

// ── PATCH — update entry ─────────────────────────────────────────────────────

export async function PATCH(req: NextRequest) {
  if (!isAuthorized(req)) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const supabase = createAdminSupabaseClient()
  const body     = await req.json()
  const { id, ...updates } = body

  if (!id) return Response.json({ error: 'id is required' }, { status: 400 })

  const { data, error } = await supabase
    .from('concierge_knowledge')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single()

  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json({ data })
}

// ── DELETE — remove entry ────────────────────────────────────────────────────

export async function DELETE(req: NextRequest) {
  if (!isAuthorized(req)) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const supabase = createAdminSupabaseClient()
  const url      = new URL(req.url)
  const id       = url.searchParams.get('id')

  if (!id) return Response.json({ error: 'id is required' }, { status: 400 })

  const { error } = await supabase
    .from('concierge_knowledge')
    .delete()
    .eq('id', id)

  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json({ ok: true })
}
