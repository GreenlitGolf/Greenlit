'use client'

import { useState, useEffect, FormEvent, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/context/AuthContext'

type FormStatus = 'idle' | 'loading' | 'success' | 'already_registered' | 'error'

export default function WaitlistPage() {
  const { session, loading: authLoading } = useAuth()
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [status, setStatus] = useState<FormStatus>('idle')
  const [bgImage, setBgImage] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  // Redirect logged-in users to dashboard
  useEffect(() => {
    if (!authLoading && session) {
      router.replace('/dashboard')
    }
  }, [authLoading, session, router])

  // Fetch course photo for background
  useEffect(() => {
    fetch('/api/course-photos/ChIJOECYvBu7joARxoy0KaO7W1Q')
      .then((r) => r.json())
      .then((data) => {
        if (data.photos?.[0]) setBgImage(data.photos[0])
      })
      .catch(() => {})
  }, [])

  // Autofocus on desktop
  useEffect(() => {
    if (window.innerWidth > 768) inputRef.current?.focus()
  }, [])

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!email.trim() || status === 'loading') return

    setStatus('loading')

    try {
      const res = await fetch('/api/waitlist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim() }),
      })
      const data = await res.json()

      if (data.status === 'success') setStatus('success')
      else if (data.status === 'already_registered') setStatus('already_registered')
      else setStatus('error')
    } catch {
      setStatus('error')
    }
  }

  function renderForm(variant: 'hero' | 'footer') {
    const isHero = variant === 'hero'

    if (status === 'success') {
      return (
        <div style={{ textAlign: 'center', padding: '16px 0' }}>
          <div style={{ fontSize: '32px', color: 'var(--gold)', marginBottom: '12px' }}>&#10003;</div>
          <div style={{
            fontFamily: 'var(--font-serif)',
            fontSize: '20px',
            color: isHero ? 'var(--cream)' : 'var(--cream)',
            marginBottom: '8px',
          }}>
            You're on the list.
          </div>
          <div style={{ fontSize: '14px', color: isHero ? 'rgba(245,240,232,0.6)' : 'rgba(245,240,232,0.6)' }}>
            Check your inbox for a welcome email.
          </div>
        </div>
      )
    }

    if (status === 'already_registered') {
      return (
        <div style={{ textAlign: 'center', padding: '16px 0' }}>
          <div style={{
            fontFamily: 'var(--font-serif)',
            fontSize: '20px',
            color: isHero ? 'var(--cream)' : 'var(--cream)',
            marginBottom: '8px',
          }}>
            You're already on the list
          </div>
          <div style={{ fontSize: '14px', color: isHero ? 'rgba(245,240,232,0.6)' : 'rgba(245,240,232,0.6)' }}>
            We'll be in touch soon.
          </div>
        </div>
      )
    }

    return (
      <form onSubmit={handleSubmit} className="wl-form" style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '12px',
        width: '100%',
        maxWidth: '420px',
        margin: '0 auto',
      }}>
        <div style={{
          display: 'flex',
          gap: '10px',
          flexDirection: 'var(--form-direction, column)' as 'column',
        }}>
          <input
            ref={isHero ? inputRef : undefined}
            type="email"
            placeholder="Your email address"
            value={email}
            onChange={(e) => { setEmail(e.target.value); if (status === 'error') setStatus('idle') }}
            disabled={status === 'loading'}
            required
            style={{
              flex: 1,
              padding: '14px 18px',
              borderRadius: 'var(--radius-md)',
              border: '1px solid rgba(245,240,232,0.2)',
              background: 'rgba(245,240,232,0.1)',
              color: isHero ? 'var(--cream)' : 'var(--cream)',
              fontSize: '15px',
              fontFamily: 'var(--font-sans)',
              outline: 'none',
              backdropFilter: 'blur(8px)',
            }}
          />
          <button
            type="submit"
            disabled={status === 'loading'}
            style={{
              padding: '14px 28px',
              borderRadius: 'var(--radius-md)',
              background: 'var(--gold)',
              color: 'var(--green-deep)',
              border: 'none',
              fontSize: '14px',
              fontWeight: 600,
              fontFamily: 'var(--font-sans)',
              letterSpacing: '0.03em',
              cursor: status === 'loading' ? 'not-allowed' : 'pointer',
              opacity: status === 'loading' ? 0.7 : 1,
              transition: 'opacity 0.2s, transform 0.15s',
              whiteSpace: 'nowrap',
            }}
          >
            {status === 'loading' ? 'Adding you\u2026' : 'Join the Waitlist'}
          </button>
        </div>

        {status === 'error' && (
          <div style={{ fontSize: '13px', color: '#ef9a9a', textAlign: 'center' }}>
            Something went wrong. Try again.
          </div>
        )}

        <div style={{
          fontSize: '12px',
          color: isHero ? 'rgba(245,240,232,0.4)' : 'rgba(245,240,232,0.4)',
          textAlign: 'center',
          marginTop: '4px',
        }}>
          No spam. Just early access when we launch.
        </div>
      </form>
    )
  }

  return (
    <>
      <style>{`
        @media (min-width: 640px) {
          :root { --form-direction: row !important; }
        }
        @media (max-width: 640px) {
          .wl-hero-content { padding: 24px 20px !important; }
          .wl-form { max-width: 100% !important; }
          .wl-form button[type="submit"] { min-height: 48px !important; }
          .wl-value-grid { gap: 32px !important; }
        }
      `}</style>

      {/* ─── Hero Section ─── */}
      <section style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        position: 'relative',
        overflow: 'hidden',
      }}>
        {/* Background */}
        <div style={{
          position: 'absolute',
          inset: 0,
          zIndex: 0,
          background: bgImage
            ? `url(${bgImage}) center/cover no-repeat`
            : 'linear-gradient(135deg, #0a1a0a 0%, #1a2e1a 40%, #2d4a2d 100%)',
        }} />
        {/* Dark overlay */}
        <div style={{
          position: 'absolute',
          inset: 0,
          zIndex: 1,
          background: 'rgba(8, 22, 8, 0.6)',
        }} />

        {/* Content */}
        <div className="wl-hero-content" style={{
          position: 'relative',
          zIndex: 2,
          maxWidth: '520px',
          width: '100%',
          padding: '24px',
          textAlign: 'center',
        }}>
          {/* Wordmark */}
          <div style={{
            fontFamily: 'var(--font-serif)',
            fontSize: '22px',
            color: 'var(--gold)',
            letterSpacing: '0.02em',
            marginBottom: '32px',
          }}>
            Greenlit
          </div>

          {/* Eyebrow */}
          <div style={{
            fontSize: '10px',
            letterSpacing: '0.25em',
            textTransform: 'uppercase',
            color: 'var(--gold)',
            fontWeight: 600,
            marginBottom: '20px',
          }}>
            Coming Soon
          </div>

          {/* Headline */}
          <h1 style={{
            fontFamily: 'var(--font-serif)',
            fontStyle: 'italic',
            fontSize: 'clamp(34px, 5.5vw, 48px)',
            color: 'var(--cream)',
            fontWeight: 400,
            lineHeight: 1.15,
            marginBottom: '20px',
          }}>
            Get the Golf Trip<br />
            out of the Group Chat.
          </h1>

          {/* Subhead */}
          <p style={{
            fontFamily: 'var(--font-sans)',
            fontSize: '16px',
            color: 'rgba(245,240,232,0.7)',
            fontWeight: 300,
            lineHeight: 1.6,
            marginBottom: '36px',
            maxWidth: '400px',
            marginLeft: 'auto',
            marginRight: 'auto',
          }}>
            The planning tool your group actually needs —
            courses, tee times, budgets, and a shareable
            trip report. All in one place.
          </p>

          {renderForm('hero')}
        </div>
      </section>

      {/* ─── Value Props Section ─── */}
      <section style={{
        background: 'var(--cream)',
        padding: 'clamp(48px, 8vw, 80px) 24px',
      }}>
        <div className="wl-value-grid" style={{
          maxWidth: '960px',
          margin: '0 auto',
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
          gap: '48px',
          textAlign: 'center',
        }}>
          {[
            {
              icon: '\u26F3',
              title: 'Plan any course',
              body: 'Browse world-class courses with an AI concierge that knows them all.',
            },
            {
              icon: '\uD83D\uDC65',
              title: 'Wrangle the crew',
              body: 'Invite your group, track RSVPs, split the budget, and assign golf games.',
            },
            {
              icon: '\uD83D\uDCCB',
              title: 'Share the trip',
              body: 'Generate a beautiful brochure and share a link. No app download required.',
            },
          ].map((prop) => (
            <div key={prop.title}>
              <div style={{ fontSize: '36px', marginBottom: '16px' }}>{prop.icon}</div>
              <h3 style={{
                fontFamily: 'var(--font-serif)',
                fontSize: '20px',
                color: 'var(--green-deep)',
                fontWeight: 600,
                marginBottom: '10px',
              }}>
                {prop.title}
              </h3>
              <p style={{
                fontSize: '14px',
                color: 'var(--text-mid)',
                fontWeight: 300,
                lineHeight: 1.6,
                maxWidth: '280px',
                margin: '0 auto',
              }}>
                {prop.body}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* ─── Footer CTA Section ─── */}
      <section style={{
        background: 'var(--green-deep)',
        padding: 'clamp(48px, 8vw, 80px) 24px',
        textAlign: 'center',
      }}>
        <div style={{ maxWidth: '520px', margin: '0 auto' }}>
          <h2 style={{
            fontFamily: 'var(--font-serif)',
            fontSize: 'clamp(24px, 4vw, 28px)',
            color: 'var(--cream)',
            fontWeight: 400,
            fontStyle: 'italic',
            marginBottom: '8px',
            lineHeight: 1.3,
          }}>
            &ldquo;Get the golf trip out of the group chat.&rdquo;
          </h2>

          <div style={{
            fontSize: '10px',
            letterSpacing: '0.25em',
            textTransform: 'uppercase',
            color: 'var(--gold)',
            fontWeight: 600,
            marginBottom: '32px',
            marginTop: '24px',
          }}>
            Join the Waitlist
          </div>

          {renderForm('footer')}
        </div>
      </section>
    </>
  )
}
