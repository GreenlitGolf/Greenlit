import { NextRequest, NextResponse } from 'next/server'
import { Resend } from 'resend'
import { createAdminSupabaseClient } from '@/lib/supabase-server'

const resend = new Resend(process.env.RESEND_API_KEY)

type Params = { params: Promise<{ id: string; memberId: string }> }

export async function POST(req: NextRequest, { params }: Params) {
  const { id: tripId, memberId } = await params
  const db = createAdminSupabaseClient()

  // Fetch member + trip in parallel
  const [memberRes, tripRes] = await Promise.all([
    db
      .from('trip_members')
      .select('email, display_name, invite_token, invite_status')
      .eq('id', memberId)
      .eq('trip_id', tripId)
      .single(),
    db
      .from('trips')
      .select('name, destination, start_date, end_date, user_id')
      .eq('id', tripId)
      .single(),
  ])

  if (memberRes.error || !memberRes.data) {
    return NextResponse.json({ error: 'Member not found' }, { status: 404 })
  }
  if (tripRes.error || !tripRes.data) {
    return NextResponse.json({ error: 'Trip not found' }, { status: 404 })
  }

  const member = memberRes.data
  const trip   = tripRes.data

  if (!member.email) {
    return NextResponse.json({ error: 'Member has no email address' }, { status: 400 })
  }

  // Fetch organizer display name
  const { data: organizerData } = await db
    .from('users')
    .select('full_name')
    .eq('id', trip.user_id)
    .single()

  const baseUrl   = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
  const inviteUrl = `${baseUrl}/join/${member.invite_token}`
  const organizer = organizerData?.full_name || 'Your trip organizer'

  // Format date range
  let dateStr = ''
  if (trip.start_date) {
    const s = new Date(trip.start_date + 'T12:00:00')
    const mo = (d: Date) => d.toLocaleDateString('en-US', { month: 'long', day: 'numeric' })
    if (trip.end_date) {
      const e = new Date(trip.end_date + 'T12:00:00')
      dateStr = `${mo(s)} – ${mo(e)}, ${s.getFullYear()}`
    } else {
      dateStr = s.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
    }
  }

  const tripLabel = [trip.name, trip.destination, dateStr].filter(Boolean).join(' · ')

  const { error: sendError } = await resend.emails.send({
    from: 'Greenlit <onboarding@resend.dev>',
    to:   member.email,
    subject: `${organizer} added you to ${trip.name}`,
    html: `
      <div style="font-family: sans-serif; max-width: 520px; margin: 0 auto; padding: 40px 32px; background: #fff;">
        <div style="font-size: 11px; letter-spacing: 0.2em; text-transform: uppercase; color: #b59a3c; font-weight: 600; margin-bottom: 20px;">
          ⛳ Golf Trip Invite
        </div>
        <h1 style="color: #14532d; font-size: 26px; margin: 0 0 8px; font-weight: 700;">
          You're on the crew for ${trip.name}
        </h1>
        <p style="color: #71717a; font-size: 14px; margin: 0 0 28px;">
          ${tripLabel}
        </p>
        <p style="color: #3f3f46; font-size: 15px; line-height: 1.6; margin: 0 0 28px;">
          ${organizer} added you to a golf trip on Greenlit. Click below to view the trip details and confirm you're in.
        </p>
        <a href="${inviteUrl}"
          style="display: inline-block; background: #15803d; color: white; padding: 14px 28px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 15px;">
          View my trip →
        </a>
        <p style="color: #a1a1aa; font-size: 12px; margin-top: 28px; line-height: 1.5;">
          Or copy this link: <span style="color: #52525b;">${inviteUrl}</span>
        </p>
      </div>
    `,
  })

  if (sendError) {
    return NextResponse.json({ error: sendError.message }, { status: 500 })
  }

  // Mark invite as pending
  await db
    .from('trip_members')
    .update({ invite_status: 'pending' })
    .eq('id', memberId)

  return NextResponse.json({ success: true })
}
