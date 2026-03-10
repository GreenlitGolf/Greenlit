'use client'

import { useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'

const inputStyle: React.CSSProperties = {
  width:        '100%',
  padding:      '12px 16px',
  border:       '1px solid var(--cream-dark)',
  borderRadius: 'var(--radius-md)',
  fontFamily:   'var(--font-sans)',
  fontSize:     '13px',
  background:   'var(--white)',
  color:        'var(--text-dark)',
  outline:      'none',
}

const labelStyle: React.CSSProperties = {
  display:       'block',
  fontSize:      '11px',
  fontWeight:    500,
  color:         'var(--text-mid)',
  letterSpacing: '0.05em',
  textTransform: 'uppercase',
  marginBottom:  '6px',
  fontFamily:    'var(--font-sans)',
}

function SignupForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const next = searchParams.get('next') ?? '/dashboard'

  const [fullName, setFullName] = useState('')
  const [email,    setEmail]    = useState('')
  const [password, setPassword] = useState('')
  const [error,    setError]    = useState('')
  const [loading,  setLoading]  = useState(false)

  async function handleSignup(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')

    const { data: authData, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { full_name: fullName } },
    })

    if (error) {
      setError(error.message)
      setLoading(false)
    } else {
      if (authData.user) {
        await supabase.from('users').insert({ id: authData.user.id, email, full_name: fullName || null })
      }
      router.push(next)
    }
  }

  return (
    <main
      style={{
        minHeight:      '100vh',
        background:     'var(--green-deep)',
        display:        'flex',
        alignItems:     'center',
        justifyContent: 'center',
        fontFamily:     'var(--font-sans)',
        position:       'relative',
        overflow:       'hidden',
      }}
    >
      {/* Grain overlay */}
      <div
        aria-hidden
        style={{
          position:        'absolute',
          inset:           0,
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.75' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.05'/%3E%3C/svg%3E")`,
          opacity:         0.5,
          pointerEvents:   'none',
        }}
      />

      <div style={{ position: 'relative', zIndex: 5, width: '100%', maxWidth: '420px', padding: '0 16px' }}>
        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          <div
            style={{
              fontFamily: 'var(--font-serif)',
              fontSize:   '26px',
              color:      'var(--gold-light)',
              letterSpacing: '0.02em',
            }}
          >
            Greenlit
          </div>
          <div
            style={{
              fontSize:      '10px',
              color:         'var(--green-muted)',
              letterSpacing: '0.25em',
              textTransform: 'uppercase',
              marginTop:     '4px',
              fontWeight:    500,
            }}
          >
            Golf Trip Planner
          </div>
        </div>

        {/* Card */}
        <div
          style={{
            background:   'var(--white)',
            borderRadius: 'var(--radius-lg)',
            border:       '1px solid var(--cream-dark)',
            padding:      '40px',
          }}
        >
          <div style={{ marginBottom: '28px' }}>
            <h1
              style={{
                fontFamily: 'var(--font-serif)',
                fontSize:   '24px',
                color:      'var(--green-deep)',
                fontWeight: 600,
              }}
            >
              Create your account
            </h1>
            <p style={{ fontSize: '13px', color: 'var(--text-light)', marginTop: '4px', fontWeight: 300 }}>
              Start planning your golf trip
            </p>
          </div>

          <form onSubmit={handleSignup} style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
            <div>
              <label style={labelStyle}>Full name</label>
              <input
                type="text"
                required
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                style={inputStyle}
              />
            </div>

            <div>
              <label style={labelStyle}>Email</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                style={inputStyle}
              />
            </div>

            <div>
              <label style={labelStyle}>Password</label>
              <input
                type="password"
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                style={inputStyle}
              />
            </div>

            {error && (
              <p style={{ fontSize: '12px', color: '#c0392b', fontWeight: 400 }}>{error}</p>
            )}

            <button
              type="submit"
              disabled={loading}
              style={{
                width:         '100%',
                padding:       '13px',
                borderRadius:  'var(--radius-sm)',
                background:    'var(--green-deep)',
                color:         'var(--gold-light)',
                fontSize:      '12px',
                fontWeight:    600,
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
                border:        'none',
                cursor:        loading ? 'not-allowed' : 'pointer',
                opacity:       loading ? 0.6 : 1,
                fontFamily:    'var(--font-sans)',
              }}
            >
              {loading ? 'Creating account…' : 'Create Account'}
            </button>
          </form>

          <p
            style={{
              textAlign:  'center',
              fontSize:   '13px',
              color:      'var(--text-light)',
              marginTop:  '24px',
              fontWeight: 300,
            }}
          >
            Already have an account?{' '}
            <Link
              href={`/login${next !== '/dashboard' ? `?next=${next}` : ''}`}
              style={{ color: 'var(--green-light)', fontWeight: 500, textDecoration: 'none' }}
            >
              Log in
            </Link>
          </p>
        </div>
      </div>
    </main>
  )
}

export default function SignupPage() {
  return (
    <Suspense>
      <SignupForm />
    </Suspense>
  )
}
