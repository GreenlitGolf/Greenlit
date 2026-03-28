import { NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'

/**
 * GET /api/courses/featured
 * Returns 8 random enriched courses with photos for the dashboard strip.
 * No auth required — courses table is publicly readable.
 */
export async function GET() {
  const supabase = createServerSupabaseClient()

  // Fetch featured courses first, then fill with other enriched courses
  const { data: featuredData } = await supabase
    .from('courses')
    .select('id, slug, name, location, emoji, tagline, google_place_id, tags, price_min, price_max, rating, is_featured, gd_ranking')
    .eq('is_featured', true)
    .not('description', 'is', null)
    .not('google_place_id', 'is', null)
    .order('gd_ranking', { ascending: true })
    .limit(12)

  const { data, error } = await supabase
    .from('courses')
    .select('id, slug, name, location, emoji, tagline, google_place_id, tags, price_min, price_max, rating, is_featured, gd_ranking')
    .not('description', 'is', null)
    .not('google_place_id', 'is', null)
    .order('updated_at', { ascending: false })
    .limit(20)

  if (error) {
    return NextResponse.json({ courses: [], error: error.message }, { status: 500 })
  }

  // Combine: featured first, then fill with non-featured shuffled
  const featuredIds = new Set((featuredData ?? []).map(c => c.id))
  const nonFeatured = (data ?? []).filter(c => !featuredIds.has(c.id))
  const shuffledNonFeatured = nonFeatured.sort(() => Math.random() - 0.5)
  const featured = (featuredData ?? []).sort(() => Math.random() - 0.5).slice(0, 4)
  const shuffled = [...featured, ...shuffledNonFeatured].slice(0, 8)

  return NextResponse.json(
    { courses: shuffled },
    { headers: { 'Cache-Control': 'public, s-maxage=300' } },
  )
}
