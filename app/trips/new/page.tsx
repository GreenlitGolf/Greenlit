import Link from 'next/link'
import ProtectedRoute from '@/components/ProtectedRoute'
import CreateTripForm from '@/components/CreateTripForm'

export default function NewTripPage() {
  return (
    <ProtectedRoute>
      <div
        style={{
          minHeight:  '100vh',
          background: 'var(--cream)',
          fontFamily: 'var(--font-sans)',
          display:    'flex',
          flexDirection: 'column',
        }}
      >
        {/* Top bar */}
        <header
          style={{
            background:     'var(--green-deep)',
            padding:        '0 48px',
            height:         '64px',
            display:        'flex',
            alignItems:     'center',
            justifyContent: 'space-between',
            flexShrink:     0,
          }}
        >
          <div
            style={{
              fontFamily:    'var(--font-serif)',
              fontSize:      '20px',
              color:         'var(--gold-light)',
              letterSpacing: '0.02em',
            }}
          >
            Greenlit
          </div>

          <Link
            href="/dashboard"
            style={{
              fontSize:      '12px',
              color:         'rgba(245,240,232,0.5)',
              textDecoration: 'none',
              fontWeight:    400,
              letterSpacing: '0.04em',
              display:       'flex',
              alignItems:    'center',
              gap:           '6px',
            }}
          >
            ← Dashboard
          </Link>
        </header>

        {/* Page body — vertically centred */}
        <div
          style={{
            flex:           1,
            display:        'flex',
            alignItems:     'center',
            justifyContent: 'center',
            padding:        '60px 24px',
          }}
        >
          <div style={{ width: '100%', maxWidth: '480px' }}>

            {/* Page heading — sits above the card */}
            <div style={{ marginBottom: '36px', textAlign: 'center' }}>
              <div
                style={{
                  fontSize:      '10px',
                  letterSpacing: '0.3em',
                  textTransform: 'uppercase',
                  color:         'var(--green-light)',
                  fontWeight:    600,
                  marginBottom:  '10px',
                  display:       'flex',
                  alignItems:    'center',
                  justifyContent:'center',
                  gap:           '12px',
                }}
              >
                <span style={{ display: 'inline-block', width: '24px', height: '1px', background: 'var(--green-muted)', opacity: 0.5 }} />
                Plan
                <span style={{ display: 'inline-block', width: '24px', height: '1px', background: 'var(--green-muted)', opacity: 0.5 }} />
              </div>
              <h1
                style={{
                  fontFamily:   'var(--font-serif)',
                  fontSize:     '36px',
                  fontWeight:   600,
                  color:        'var(--green-deep)',
                  lineHeight:   1.15,
                  marginBottom: '10px',
                }}
              >
                Start a New Trip
              </h1>
              <p
                style={{
                  fontSize:   '14px',
                  color:      'var(--text-light)',
                  fontWeight: 300,
                  lineHeight: 1.6,
                }}
              >
                Get the golf trip out of the group chat.
              </p>
            </div>

            {/* Form card */}
            <div
              style={{
                background:   'var(--white)',
                borderRadius: 'var(--radius-lg)',
                border:       '1px solid var(--cream-dark)',
                boxShadow:    'var(--shadow-card)',
                padding:      '40px 44px',
              }}
            >
              <CreateTripForm />
            </div>

            {/* Footer hint */}
            <p
              style={{
                textAlign:  'center',
                marginTop:  '20px',
                fontSize:   '12px',
                color:      'var(--text-light)',
                fontWeight: 300,
              }}
            >
              Only the trip name is required — fill in the rest later.
            </p>

          </div>
        </div>
      </div>
    </ProtectedRoute>
  )
}
