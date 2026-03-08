import { NextRequest, NextResponse } from 'next/server'
import { Resend } from 'resend'
import { createClient } from '@supabase/supabase-js'

const resend = new Resend(process.env.RESEND_API_KEY)

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export async function POST(req: NextRequest) {
  const { tripId, email } = await req.json()

  if (!tripId || !email) {
    return NextResponse.json({ error: 'Missing tripId or email' }, { status: 400 })
  }

  const { data: trip, error: tripError } = await supabase
    .from('trips')
    .select('name, invite_token')
    .eq('id', tripId)
    .single()

  if (tripError || !trip) {
    return NextResponse.json({ error: 'Trip not found' }, { status: 404 })
  }

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
  const inviteUrl = `${baseUrl}/join/${trip.invite_token}`

  const { error: sendError } = await resend.emails.send({
    from: 'Greenlit <onboarding@resend.dev>',
    to: email,
    subject: `You're invited to ${trip.name}`,
    html: `
      <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto; padding: 32px;">
        <h1 style="color: #14532d; font-size: 24px; margin-bottom: 8px;">You're invited to ${trip.name}</h1>
        <p style="color: #52525b; margin-bottom: 24px;">
          Someone added you to a golf trip on Greenlit. Click below to view the trip and accept your invite.
        </p>
        <a href="${inviteUrl}"
          style="display: inline-block; background: #15803d; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: 500;">
          View trip
        </a>
        <p style="color: #a1a1aa; font-size: 12px; margin-top: 24px;">
          Or copy this link: ${inviteUrl}
        </p>
      </div>
    `,
  })

  if (sendError) {
    return NextResponse.json({ error: sendError.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
