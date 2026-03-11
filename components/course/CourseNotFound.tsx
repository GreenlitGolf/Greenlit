'use client'

import { useState } from 'react'
import Link         from 'next/link'
import { useRouter } from 'next/navigation'
import { supabase }  from '@/lib/supabase'

interface Props {
  slug: string
}

/** Derives a human-readable course name from a URL slug. */
function slugToName(slug: string): string {
  return slug
    .split('-')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ')
}

type ResearchState = 'idle' | 'loading' | 'done' | 'queued' | 'private' | 'error'

export default function CourseNotFound({ slug }: Props) {
  const router           = useRouter()
  const courseName       = slugToName(slug)
  const [state, setState] = useState<ResearchState>('idle')
  const [resultSlug, setResultSlug] = useState<string | null>(null)

  async function handleResearch() {
    setState('loading')
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const res = await fetch('/api/courses/enrich-on-demand', {
        method : 'POST',
        headers: {
          'Content-Type' : 'application/json',
          'Authorization': `Bearer ${session?.access_token ?? ''}`,
        },
        body: JSON.stringify({
          name    : courseName,
          location: '',      // unknown — agent will research it
          country : 'USA',
        }),
      })
      const data = await res.json()

      if (data.status === 'complete' || data.status === 'exists') {
        setResultSlug(data.slug)
        setState('done')
        // Redirect to the new course page after a brief moment
        setTimeout(() => router.push(`/course/${data.slug}`), 1500)
      } else if (data.status === 'private') {
        setState('private')
      } else if (data.status === 'queued') {
        setState('queued')
      } else {
        setState('error')
      }
    } catch {
      setState('error')
    }
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--cream)', fontFamily: 'var(--font-sans)' }}>

      {/* Header */}
      <header style={{
        background: 'var(--green-deep)', padding: '0 48px', height: '64px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        position: 'sticky', top: 0, zIndex: 20,
      }}>
        <Link href="/dashboard" style={{
          fontFamily: 'var(--font-serif)', fontSize: '20px',
          color: 'var(--gold-light)', letterSpacing: '0.02em', textDecoration: 'none',
        }}>
          Greenlit
        </Link>
        <Link href="/dashboard" style={{
          fontSize: '12px', color: 'rgba(245,240,232,0.5)',
          textDecoration: 'none', letterSpacing: '0.04em',
        }}>
          ← Dashboard
        </Link>
      </header>

      {/* Body */}
      <div style={{
        maxWidth: '560px', margin: '0 auto', padding: '96px 24px 80px',
        textAlign: 'center',
      }}>
        <div style={{ fontSize: '48px', marginBottom: '24px' }}>⛳</div>

        <div style={{
          fontSize: '10px', letterSpacing: '0.2em', textTransform: 'uppercase',
          color: 'var(--green-light)', fontWeight: 600, marginBottom: '10px',
        }}>
          Not Yet Researched
        </div>

        <h1 style={{
          fontFamily: 'var(--font-serif)', fontSize: '28px',
          color: 'var(--green-deep)', fontWeight: 600,
          marginBottom: '12px', lineHeight: 1.25,
        }}>
          {courseName}
        </h1>

        <p style={{
          fontSize: '14px', color: 'var(--text-light)', fontWeight: 300,
          lineHeight: 1.7, marginBottom: '36px',
        }}>
          {state === 'idle' && "We haven't added this course to the Greenlit database yet. Want us to research it? We'll pull green fees, course details, lodging options, and everything your group needs to plan a trip."}
          {state === 'loading' && 'Researching the course — this usually takes 20–30 seconds…'}
          {state === 'done'    && `Done! Redirecting you to ${courseName}…`}
          {state === 'queued'  && `${courseName} has been added to our research queue. Check back in a few minutes and the full details will be ready.`}
          {state === 'private' && `${courseName} appears to be a private members-only club with no published public access or green fees.`}
          {state === 'error'   && 'Something went wrong. Please try again or contact support.'}
        </p>

        {(state === 'idle' || state === 'error') && (
          <button
            onClick={handleResearch}
            style={{
              display      : 'inline-flex',
              alignItems   : 'center',
              gap          : '8px',
              padding      : '12px 28px',
              background   : 'var(--green-deep)',
              color        : 'var(--gold-light)',
              border       : 'none',
              borderRadius : 'var(--radius-sm)',
              fontSize     : '13px',
              fontWeight   : 600,
              letterSpacing: '0.06em',
              cursor       : 'pointer',
              fontFamily   : 'var(--font-sans)',
            }}
          >
            ✦ Research This Course
          </button>
        )}

        {state === 'loading' && (
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            gap: '10px', color: 'var(--text-light)', fontSize: '13px',
          }}>
            <div style={{
              width: '16px', height: '16px', border: '2px solid var(--cream-dark)',
              borderTopColor: 'var(--green-light)', borderRadius: '50%',
              animation: 'spin 0.8s linear infinite',
            }} />
            Researching…
          </div>
        )}

        {state === 'done' && resultSlug && (
          <Link href={`/course/${resultSlug}`} style={{
            display: 'inline-block', padding: '12px 28px',
            background: 'var(--gold)', color: 'var(--green-deep)',
            borderRadius: 'var(--radius-sm)', fontSize: '13px', fontWeight: 600,
            letterSpacing: '0.06em', textDecoration: 'none',
          }}>
            View Course →
          </Link>
        )}

        {(state === 'queued' || state === 'private') && (
          <Link href="/dashboard" style={{
            display: 'inline-block', padding: '12px 24px',
            background: 'transparent', color: 'var(--text-light)',
            border: '1px solid var(--cream-dark)', borderRadius: 'var(--radius-sm)',
            fontSize: '12px', textDecoration: 'none', fontFamily: 'var(--font-sans)',
          }}>
            ← Back to Dashboard
          </Link>
        )}
      </div>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  )
}
