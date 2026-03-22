import { NextRequest, NextResponse } from 'next/server'
import { Resend } from 'resend'
import { createClient } from '@supabase/supabase-js'
import WaitlistWelcomeEmail from '@/emails/WaitlistWelcome'

const resend = new Resend(process.env.RESEND_API_KEY)

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false, autoRefreshToken: false } }
)

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export async function POST(req: NextRequest) {
  try {
    const { email } = await req.json()

    if (!email || typeof email !== 'string' || !EMAIL_RE.test(email.trim())) {
      return NextResponse.json(
        { status: 'error', message: 'Please enter a valid email address.' },
        { status: 400 }
      )
    }

    const cleanEmail = email.trim().toLowerCase()

    // Check if already exists
    const { data: existing } = await supabase
      .from('waitlist')
      .select('id')
      .eq('email', cleanEmail)
      .single()

    if (existing) {
      return NextResponse.json({
        status: 'already_registered',
        message: "You're already on the list!",
      })
    }

    // Insert new entry
    const { error: insertError } = await supabase
      .from('waitlist')
      .insert({ email: cleanEmail, source: 'waitlist_page' })

    if (insertError) {
      // Handle race condition where email was inserted between check and insert
      if (insertError.code === '23505') {
        return NextResponse.json({
          status: 'already_registered',
          message: "You're already on the list!",
        })
      }
      console.error('Waitlist insert error:', insertError)
      return NextResponse.json(
        { status: 'error', message: 'Something went wrong. Try again.' },
        { status: 500 }
      )
    }

    // Send welcome email via React Email component
    await resend.emails.send({
      // TODO: Switch to 'Michael at Greenlit <hello@greenlit.golf>' once domain is verified in Resend
      from: 'Michael at Greenlit <onboarding@resend.dev>',
      to: cleanEmail,
      subject: "You're on the list — Greenlit",
      react: WaitlistWelcomeEmail({ email: cleanEmail }),
    })

    return NextResponse.json({
      status: 'success',
      message: "You're on the list!",
    })
  } catch (err) {
    console.error('Waitlist error:', err)
    return NextResponse.json(
      { status: 'error', message: 'Something went wrong. Try again.' },
      { status: 500 }
    )
  }
}
