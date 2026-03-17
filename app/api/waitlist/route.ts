import { NextRequest, NextResponse } from 'next/server'
import { Resend } from 'resend'
import { createClient } from '@supabase/supabase-js'

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

    // Send welcome email
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://greenlit.golf'

    await resend.emails.send({
      from: 'Greenlit <onboarding@resend.dev>',
      to: cleanEmail,
      subject: "You're on the list. \u{1F3CC}\u{FE0F}",
      html: `
        <div style="margin:0;padding:0;background:#f5f0e8;font-family:'Jost',Helvetica,Arial,sans-serif;">
          <!-- Header -->
          <div style="background:#1a2e1a;padding:32px 24px;text-align:center;">
            <span style="font-family:'Playfair Display',Georgia,serif;font-size:22px;color:#e2c97e;letter-spacing:0.02em;">
              Greenlit
            </span>
          </div>

          <!-- Body -->
          <div style="max-width:480px;margin:0 auto;padding:40px 24px;">
            <h1 style="font-family:'Playfair Display',Georgia,serif;font-size:28px;color:#1a2e1a;margin:0 0 16px;">
              You're on the waitlist.
            </h1>
            <p style="font-size:15px;color:#4a4a4a;line-height:1.6;margin:0 0 28px;">
              Thanks for signing up — you'll be among the first to get access when Greenlit launches.
            </p>

            <p style="font-size:14px;color:#1a2e1a;font-weight:600;margin:0 0 12px;">
              Here's what's coming:
            </p>
            <div style="font-size:14px;color:#4a4a4a;line-height:2;">
              &#10003;&nbsp; AI-powered golf concierge to find your perfect courses<br/>
              &#10003;&nbsp; Group coordination — members, RSVPs, handicaps<br/>
              &#10003;&nbsp; Tee time tracking and budget splitting<br/>
              &#10003;&nbsp; A beautiful shareable trip report your crew will love
            </div>

            <div style="margin:32px 0;">
              <a href="${baseUrl}/courses"
                style="display:inline-block;background:#c4a84f;color:#1a2e1a;padding:14px 28px;border-radius:8px;text-decoration:none;font-weight:600;font-size:14px;letter-spacing:0.03em;">
                Browse Our Course Directory
              </a>
            </div>
          </div>

          <!-- Footer -->
          <div style="text-align:center;padding:24px;font-size:12px;color:#8a8a8a;border-top:1px solid #ede5d4;">
            Planned with Greenlit &middot;
            <a href="${baseUrl}" style="color:#8a8a8a;">greenlit.golf</a> &middot;
            <a href="#" style="color:#8a8a8a;">Unsubscribe</a>
          </div>
        </div>
      `,
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
