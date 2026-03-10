'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/context/AuthContext'

interface Trip {
  id:   string
  name: string
}

interface AddToTripModalProps {
  courseId:      string
  courseName:    string
  courseLocation: string
  onClose:       () => void
}

export default function AddToTripModal({ courseId, courseName, courseLocation, onClose }: AddToTripModalProps) {
  const { session } = useAuth()
  const user = session?.user ?? null
  const [trips,      setTrips]      = useState<Trip[]>([])
  const [selected,   setSelected]   = useState<string>('')
  const [loading,    setLoading]    = useState(true)
  const [saving,     setSaving]     = useState(false)
  const [saved,      setSaved]      = useState(false)
  const [error,      setError]      = useState<string | null>(null)

  // Load user's trips
  useEffect(() => {
    if (!user) return

    supabase
      .from('trip_members')
      .select('trip_id, trips(id, name)')
      .eq('user_id', user.id)
      .eq('status', 'accepted')
      .then(({ data, error: err }) => {
        if (err) { setError('Could not load your trips.'); setLoading(false); return }

        const loaded: Trip[] = (data ?? []).flatMap((row: any) => {
          const t = row.trips
          return t ? [{ id: t.id, name: t.name }] : []
        })

        setTrips(loaded)
        if (loaded.length > 0) setSelected(loaded[0].id)
        setLoading(false)
      })
  }, [user])

  async function handleAdd() {
    if (!selected || !user) return
    setSaving(true)
    setError(null)

    const { error: insertErr } = await supabase
      .from('trip_courses')
      .upsert(
        {
          trip_id:         selected,
          course_id:       courseId,
          course_name:     courseName,
          course_location: courseLocation,
          added_by:        user.id,
        },
        { onConflict: 'trip_id,course_id', ignoreDuplicates: true },
      )

    if (insertErr) {
      setError('Failed to add course. Please try again.')
      setSaving(false)
      return
    }

    setSaved(true)
    setSaving(false)
    setTimeout(onClose, 1200)
  }

  return (
    /* Backdrop */
    <div
      onClick={onClose}
      style={{
        position:        'fixed',
        inset:           0,
        background:      'rgba(0,0,0,0.55)',
        zIndex:          1000,
        display:         'flex',
        alignItems:      'center',
        justifyContent:  'center',
        padding:         '24px',
      }}
    >
      {/* Panel */}
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background:   'var(--white)',
          borderRadius: 'var(--radius-lg)',
          padding:      '32px',
          width:        '100%',
          maxWidth:     '400px',
          boxShadow:    '0 20px 60px rgba(0,0,0,0.3)',
        }}
      >
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px' }}>
          <div>
            <div
              style={{
                fontSize:      '10px',
                letterSpacing: '0.15em',
                textTransform: 'uppercase',
                color:         'var(--green-light)',
                fontWeight:    600,
                marginBottom:  '6px',
              }}
            >
              Add to Trip
            </div>
            <div
              style={{
                fontFamily: 'var(--font-serif)',
                fontSize:   '18px',
                fontWeight: 600,
                color:      'var(--green-deep)',
                lineHeight: 1.2,
              }}
            >
              {courseName}
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'transparent',
              border:     'none',
              cursor:     'pointer',
              fontSize:   '20px',
              color:      'var(--text-light)',
              lineHeight: 1,
              padding:    '0 0 0 12px',
            }}
          >
            ×
          </button>
        </div>

        {/* Content */}
        {loading ? (
          <div style={{ textAlign: 'center', padding: '20px 0', color: 'var(--text-light)', fontSize: '14px' }}>
            Loading your trips…
          </div>
        ) : trips.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '20px 0' }}>
            <div style={{ fontSize: '14px', color: 'var(--text-light)', fontWeight: 300, marginBottom: '16px' }}>
              You don't have any trips yet.
            </div>
            <a
              href="/trips/new"
              style={{
                display:       'inline-block',
                padding:       '10px 20px',
                background:    'var(--gold)',
                color:         'var(--green-deep)',
                borderRadius:  'var(--radius-sm)',
                fontSize:      '12px',
                fontWeight:    700,
                letterSpacing: '0.06em',
                textTransform: 'uppercase',
                textDecoration: 'none',
              }}
            >
              Create a Trip →
            </a>
          </div>
        ) : saved ? (
          <div style={{ textAlign: 'center', padding: '20px 0' }}>
            <div style={{ fontSize: '28px', marginBottom: '10px' }}>✓</div>
            <div style={{ fontSize: '14px', color: 'var(--green-mid)', fontWeight: 500 }}>
              Added to your trip!
            </div>
          </div>
        ) : (
          <>
            <div style={{ marginBottom: '20px' }}>
              <label
                style={{
                  display:       'block',
                  fontSize:      '11px',
                  fontWeight:    600,
                  letterSpacing: '0.08em',
                  textTransform: 'uppercase',
                  color:         'var(--text-light)',
                  marginBottom:  '8px',
                }}
              >
                Select Trip
              </label>
              <select
                value={selected}
                onChange={(e) => setSelected(e.target.value)}
                style={{
                  width:        '100%',
                  padding:      '10px 14px',
                  borderRadius: 'var(--radius-sm)',
                  border:       '1px solid var(--cream-dark)',
                  background:   'var(--cream)',
                  fontSize:     '14px',
                  color:        'var(--green-deep)',
                  fontFamily:   'var(--font-sans)',
                  outline:      'none',
                  cursor:       'pointer',
                }}
              >
                {trips.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            </div>

            {error && (
              <div
                style={{
                  padding:      '10px 14px',
                  background:   '#fef2f2',
                  border:       '1px solid #fecaca',
                  borderRadius: 'var(--radius-sm)',
                  fontSize:     '13px',
                  color:        '#dc2626',
                  marginBottom: '16px',
                }}
              >
                {error}
              </div>
            )}

            <div style={{ display: 'flex', gap: '10px' }}>
              <button
                onClick={onClose}
                style={{
                  flex:          1,
                  padding:       '11px 16px',
                  borderRadius:  'var(--radius-sm)',
                  border:        '1px solid var(--cream-dark)',
                  background:    'var(--cream)',
                  fontSize:      '12px',
                  fontWeight:    600,
                  letterSpacing: '0.05em',
                  textTransform: 'uppercase',
                  color:         'var(--text-light)',
                  cursor:        'pointer',
                  fontFamily:    'var(--font-sans)',
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleAdd}
                disabled={saving}
                style={{
                  flex:          2,
                  padding:       '11px 16px',
                  borderRadius:  'var(--radius-sm)',
                  border:        'none',
                  background:    saving ? 'var(--cream-dark)' : 'var(--gold)',
                  fontSize:      '12px',
                  fontWeight:    700,
                  letterSpacing: '0.08em',
                  textTransform: 'uppercase',
                  color:         saving ? 'var(--text-light)' : 'var(--green-deep)',
                  cursor:        saving ? 'default' : 'pointer',
                  fontFamily:    'var(--font-sans)',
                  transition:    'all 0.2s',
                }}
              >
                {saving ? 'Adding…' : 'Add to Trip →'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
