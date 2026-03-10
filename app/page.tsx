import Link from 'next/link'

export default function HomePage() {
  return (
    <main
      style={{
        minHeight:       '100vh',
        background:      'var(--green-deep)',
        display:         'flex',
        flexDirection:   'column',
        position:        'relative',
        overflow:        'hidden',
        fontFamily:      'var(--font-sans)',
      }}
    >
      {/* Grain texture overlay */}
      <div
        aria-hidden
        style={{
          position:        'absolute',
          inset:           0,
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.75' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.05'/%3E%3C/svg%3E")`,
          opacity:         0.6,
          pointerEvents:   'none',
        }}
      />

      {/* Radial glow — centre bottom */}
      <div
        aria-hidden
        style={{
          position:   'absolute',
          bottom:     '-120px',
          left:       '50%',
          transform:  'translateX(-50%)',
          width:      '800px',
          height:     '500px',
          background: 'radial-gradient(ellipse at center, rgba(74,124,74,0.25) 0%, transparent 70%)',
          pointerEvents: 'none',
        }}
      />

      {/* Top nav */}
      <header
        style={{
          position:       'relative',
          zIndex:         10,
          display:        'flex',
          alignItems:     'center',
          justifyContent: 'space-between',
          padding:        '28px 48px',
        }}
      >
        <div>
          <div
            style={{
              fontFamily:    'var(--font-serif)',
              fontSize:      '22px',
              color:         'var(--gold-light)',
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
              marginTop:     '2px',
              fontWeight:    500,
            }}
          >
            Golf Trip Planner
          </div>
        </div>
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          <Link
            href="/login"
            style={{
              fontSize:      '13px',
              color:         'rgba(245,240,232,0.65)',
              textDecoration: 'none',
              fontWeight:    400,
              letterSpacing: '0.02em',
            }}
          >
            Log in
          </Link>
          <Link
            href="/signup"
            style={{
              display:        'inline-flex',
              alignItems:     'center',
              padding:        '10px 20px',
              borderRadius:   'var(--radius-sm)',
              background:     'var(--gold)',
              color:          'var(--green-deep)',
              fontSize:       '12px',
              fontWeight:     600,
              letterSpacing:  '0.08em',
              textTransform:  'uppercase',
              textDecoration: 'none',
              transition:     'background 0.2s',
            }}
          >
            Get Started
          </Link>
        </div>
      </header>

      {/* Hero */}
      <section
        style={{
          flex:           1,
          display:        'flex',
          flexDirection:  'column',
          alignItems:     'center',
          justifyContent: 'center',
          textAlign:      'center',
          padding:        '60px 48px 100px',
          position:       'relative',
          zIndex:         5,
        }}
      >
        {/* Eyebrow */}
        <div
          style={{
            fontSize:      '11px',
            letterSpacing: '0.3em',
            textTransform: 'uppercase',
            color:         'var(--gold)',
            fontWeight:    600,
            marginBottom:  '24px',
            display:       'flex',
            alignItems:    'center',
            gap:           '12px',
          }}
        >
          <span style={{ display: 'inline-block', width: '32px', height: '1px', background: 'var(--gold)', opacity: 0.5 }} />
          Golf. Friends. Done right.
          <span style={{ display: 'inline-block', width: '32px', height: '1px', background: 'var(--gold)', opacity: 0.5 }} />
        </div>

        {/* Headline */}
        <h1
          style={{
            fontFamily:   'var(--font-serif)',
            fontSize:     'clamp(42px, 7vw, 72px)',
            color:        'var(--cream)',
            fontWeight:   600,
            lineHeight:   1.1,
            maxWidth:     '800px',
            marginBottom: '28px',
          }}
        >
          Get the golf trip{' '}
          <em style={{ color: 'var(--gold-light)', fontStyle: 'italic' }}>
            out of the group chat.
          </em>
        </h1>

        {/* Sub-headline */}
        <p
          style={{
            fontSize:     '18px',
            color:        'rgba(245,240,232,0.65)',
            fontWeight:   300,
            maxWidth:     '520px',
            lineHeight:   1.7,
            marginBottom: '48px',
          }}
        >
          Plan courses, lock tee times, track the budget, and keep the whole crew
          on the same page — all in one place.
        </p>

        {/* CTAs */}
        <div style={{ display: 'flex', gap: '14px', alignItems: 'center', flexWrap: 'wrap', justifyContent: 'center' }}>
          <Link
            href="/signup"
            style={{
              display:        'inline-flex',
              alignItems:     'center',
              gap:            '8px',
              padding:        '16px 32px',
              borderRadius:   'var(--radius-sm)',
              background:     'var(--gold)',
              color:          'var(--green-deep)',
              fontSize:       '13px',
              fontWeight:     600,
              letterSpacing:  '0.08em',
              textTransform:  'uppercase',
              textDecoration: 'none',
              boxShadow:      '0 4px 20px rgba(196,168,79,0.3)',
            }}
          >
            Plan Your Trip
          </Link>
          <Link
            href="/discover"
            style={{
              display:        'inline-flex',
              alignItems:     'center',
              gap:            '8px',
              padding:        '16px 28px',
              borderRadius:   'var(--radius-sm)',
              background:     'transparent',
              color:          'var(--gold-light)',
              fontSize:       '13px',
              fontWeight:     500,
              letterSpacing:  '0.06em',
              textTransform:  'uppercase',
              textDecoration: 'none',
              border:         '1px solid rgba(196,168,79,0.3)',
            }}
          >
            ✦ Try the Concierge
          </Link>
          <Link
            href="/login"
            style={{
              display:        'inline-flex',
              alignItems:     'center',
              padding:        '16px 28px',
              borderRadius:   'var(--radius-sm)',
              background:     'transparent',
              color:          'var(--cream)',
              fontSize:       '13px',
              fontWeight:     500,
              letterSpacing:  '0.06em',
              textTransform:  'uppercase',
              textDecoration: 'none',
              border:         '1px solid rgba(245,240,232,0.2)',
            }}
          >
            Log In
          </Link>
        </div>
      </section>

      {/* Feature strip */}
      <section
        style={{
          position:   'relative',
          zIndex:     5,
          borderTop:  '1px solid rgba(255,255,255,0.06)',
          padding:    '40px 48px',
          display:    'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
          gap:        '32px',
          maxWidth:   '1100px',
          margin:     '0 auto',
          width:      '100%',
        }}
      >
        {[
          { icon: '✦', title: 'AI Golf Concierge', desc: 'Chat with our AI to find the perfect courses for your crew', href: '/discover', gold: true },
          { icon: '📅', title: 'Trip Itinerary',   desc: 'Day-by-day schedule the whole group can see', href: null, gold: false },
          { icon: '💰', title: 'Budget Tracker',   desc: 'Split costs, send reminders, stay on budget', href: null, gold: false },
          { icon: '👥', title: 'Group Invites',    desc: 'Bring the crew in with a single link', href: null, gold: false },
        ].map((f) => {
          const inner = (
            <div key={f.title} style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <span style={{ fontSize: '24px', color: f.gold ? 'var(--gold-light)' : undefined }}>{f.icon}</span>
              <div
                style={{
                  fontFamily: 'var(--font-serif)',
                  fontSize:   '16px',
                  color:      f.gold ? 'var(--gold-light)' : 'var(--cream)',
                }}
              >
                {f.title}
              </div>
              <div
                style={{
                  fontSize:   '13px',
                  color:      f.gold ? 'rgba(226,201,126,0.65)' : 'rgba(245,240,232,0.5)',
                  fontWeight: 300,
                  lineHeight: 1.5,
                }}
              >
                {f.desc}
              </div>
              {f.gold && (
                <span style={{ fontSize: '11px', color: 'var(--gold)', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                  Try it →
                </span>
              )}
            </div>
          )
          return f.href ? (
            <Link key={f.title} href={f.href} style={{ textDecoration: 'none' }}>{inner}</Link>
          ) : inner
        })}
      </section>

      {/* Bottom tagline */}
      <footer
        style={{
          position:   'relative',
          zIndex:     5,
          textAlign:  'center',
          padding:    '28px',
          borderTop:  '1px solid rgba(255,255,255,0.06)',
          fontSize:   '11px',
          color:      'rgba(245,240,232,0.3)',
          letterSpacing: '0.05em',
        }}
      >
        Greenlit — Golf Trip Planner
      </footer>
    </main>
  )
}
