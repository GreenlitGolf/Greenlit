'use client'

import { useEffect, useState, useCallback } from 'react'
import { useParams, useRouter }              from 'next/navigation'
import Link                                   from 'next/link'
import { supabase }                           from '@/lib/supabase'
import { useAuth }                            from '@/context/AuthContext'

// ── Tag list ────────────────────────────────────────────────────────────────────

const ALL_TAGS = [
  'Links', 'Links-Style', 'Links Golf', 'Parkland', 'Desert', 'Mountain',
  'Ocean Views', 'Oceanfront', 'Waterfront', 'Lake Michigan',
  'Bucket List', 'Hidden Gem', 'Off the Beaten Path', 'Best Value', 'Value Play',
  'Walking Only', 'Walking-Friendly', 'Cart Required',
  'Championship', 'Stadium Course', 'Historic',
  'Ryder Cup', 'PGA Tour', 'Major Venue', 'Island Green',
  'Multi-Course', 'Resort', 'Luxury Resort', 'Package Deals',
  'Caddies Available', 'Family Friendly',
  'Lowcountry', 'Southern Hospitality', 'Golden Isles',
  'Lighthouse Hole', 'RBC Heritage',
]

// ── Styles ──────────────────────────────────────────────────────────────────────

const inputStyle: React.CSSProperties = {
  width:        '100%',
  padding:      '10px 14px',
  borderRadius: 'var(--radius-sm)',
  border:       '1px solid var(--cream-dark)',
  background:   'var(--cream)',
  fontSize:     '14px',
  color:        'var(--green-deep)',
  fontFamily:   'var(--font-sans)',
  outline:      'none',
  boxSizing:    'border-box',
}

const textareaStyle: React.CSSProperties = {
  ...inputStyle,
  resize:     'vertical',
  lineHeight: 1.5,
}

const labelStyle: React.CSSProperties = {
  display:       'block',
  fontSize:      '11px',
  fontWeight:    600,
  letterSpacing: '0.08em',
  textTransform: 'uppercase' as const,
  color:         'var(--text-light)',
  marginBottom:  '6px',
}

const sectionStyle: React.CSSProperties = {
  background:   'var(--white)',
  border:       '1px solid var(--cream-dark)',
  borderRadius: 'var(--radius-lg)',
  padding:      '24px',
  marginBottom: '20px',
}

const sectionTitleStyle: React.CSSProperties = {
  fontSize:      '10px',
  letterSpacing: '0.15em',
  textTransform: 'uppercase' as const,
  color:         'var(--green-light)',
  fontWeight:    600,
  marginBottom:  '20px',
  fontFamily:    'var(--font-sans)',
}

// ── Helpers ─────────────────────────────────────────────────────────────────────

function fmt(iso: string | null | undefined): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
    hour: 'numeric', minute: '2-digit',
  })
}

function fieldRow(children: React.ReactNode, gap = '16px'): React.ReactNode {
  return <div style={{ display: 'flex', gap, marginBottom: '16px' }}>{children}</div>
}

// ── Page ────────────────────────────────────────────────────────────────────────

export default function AdminCourseEditorPage() {
  const { session }    = useAuth()
  const router         = useRouter()
  const params         = useParams()
  const slug           = params.slug as string

  const [course,        setCourse]        = useState<Record<string, any> | null>(null)
  const [formData,      setFormData]      = useState<Record<string, any>>({})
  const [originalJSON,  setOriginalJSON]  = useState('')
  const [loading,       setLoading]       = useState(true)
  const [saving,        setSaving]        = useState(false)
  const [saveMsg,       setSaveMsg]       = useState<{ ok: boolean; text: string } | null>(null)
  const [showReenrich,  setShowReenrich]  = useState(false)
  const [jsonErrors,    setJsonErrors]    = useState<Record<string, string | null>>({})

  // ── Admin guard ───────────────────────────────────────────
  useEffect(() => {
    if (!session) return
    const adminEmail = process.env.NEXT_PUBLIC_ADMIN_EMAIL
    if (adminEmail && session.user.email !== adminEmail) {
      router.replace('/dashboard')
    }
  }, [session, router])

  // ── Load course ───────────────────────────────────────────
  useEffect(() => {
    if (!slug) return
    supabase
      .from('courses')
      .select('*')
      .eq('slug', slug)
      .single()
      .then(({ data, error }) => {
        if (error || !data) { setLoading(false); return }
        setCourse(data)
        setFormData(data)
        setOriginalJSON(JSON.stringify(data))
        setLoading(false)
      })
  }, [slug])

  // ── Dirty tracking ────────────────────────────────────────
  const hasUnsavedChanges = JSON.stringify(formData) !== originalJSON

  // ── Field updaters ────────────────────────────────────────
  const set = useCallback((field: string, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }))
  }, [])

  // Dynamic list helpers
  function addListItem(field: string) {
    const arr = [...(formData[field] ?? [])]
    arr.push('')
    set(field, arr)
  }
  function updateListItem(field: string, index: number, value: string) {
    const arr = [...(formData[field] ?? [])]
    arr[index] = value
    set(field, arr)
  }
  function removeListItem(field: string, index: number) {
    const arr = [...(formData[field] ?? [])]
    arr.splice(index, 1)
    set(field, arr)
  }

  // Tag toggle
  function toggleTag(tag: string) {
    const tags = [...(formData.tags ?? [])]
    const idx  = tags.indexOf(tag)
    if (idx >= 0) tags.splice(idx, 1)
    else tags.push(tag)
    set('tags', tags)
  }

  // JSON field helpers
  function getJsonString(field: string): string {
    const val = formData[field]
    if (typeof val === 'string') return val
    return JSON.stringify(val, null, 2)
  }
  function setJsonField(field: string, raw: string) {
    // Store raw string; we'll parse on save
    setFormData(prev => ({ ...prev, [field]: raw }))
    setJsonErrors(prev => ({ ...prev, [field]: null }))
  }
  function validateJson(field: string) {
    try {
      const raw = formData[field]
      const str = typeof raw === 'string' ? raw : JSON.stringify(raw)
      JSON.parse(str)
      setJsonErrors(prev => ({ ...prev, [field]: null }))
      return true
    } catch (e: any) {
      setJsonErrors(prev => ({ ...prev, [field]: e.message }))
      return false
    }
  }

  // ── Save ──────────────────────────────────────────────────
  async function handleSave() {
    setSaving(true)
    setSaveMsg(null)

    // Parse any JSON string fields back to objects
    const payload = { ...formData }
    for (const field of ['courses_on_property', 'nearby_lodging', 'insider_tips', 'common_questions']) {
      if (typeof payload[field] === 'string') {
        try {
          payload[field] = JSON.parse(payload[field])
        } catch {
          setSaveMsg({ ok: false, text: `Invalid JSON in ${field}` })
          setSaving(false)
          return
        }
      }
    }

    try {
      const res = await fetch(`/api/admin/courses/${slug}`, {
        method:  'POST',
        headers: {
          'Content-Type':  'application/json',
          Authorization:   `Bearer ${process.env.NEXT_PUBLIC_CRON_SECRET}`,
        },
        body: JSON.stringify(payload),
      })
      const data = await res.json()

      if (!res.ok) {
        setSaveMsg({ ok: false, text: data.error ?? 'Save failed' })
      } else {
        setCourse(data.course)
        setFormData(data.course)
        setOriginalJSON(JSON.stringify(data.course))
        setSaveMsg({ ok: true, text: 'Saved!' })
        // If slug changed, redirect to new slug
        if (data.course.slug && data.course.slug !== slug) {
          router.replace(`/admin/courses/${data.course.slug}`)
        }
      }
    } catch (err: any) {
      setSaveMsg({ ok: false, text: err.message ?? 'Network error' })
    }
    setSaving(false)
    setTimeout(() => setSaveMsg(null), 4000)
  }

  // ── Re-enrich ─────────────────────────────────────────────
  async function handleReenrich() {
    if (!course) return
    // Find queue entry by course name
    const { data: queueRow } = await supabase
      .from('course_queue')
      .select('id')
      .eq('name', course.name)
      .single()

    if (queueRow) {
      await fetch('/api/admin/reset-queue', {
        method:  'POST',
        headers: {
          'Content-Type':  'application/json',
          Authorization:   `Bearer ${process.env.NEXT_PUBLIC_CRON_SECRET}`,
        },
        body: JSON.stringify({ ids: [queueRow.id] }),
      })
    }

    setShowReenrich(false)
    setSaveMsg({ ok: true, text: 'Course queued for re-enrichment' })
    setTimeout(() => setSaveMsg(null), 4000)
  }

  // ── Render ────────────────────────────────────────────────
  if (!session) return null

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', background: 'var(--cream)', fontFamily: 'var(--font-sans)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ fontSize: '14px', color: 'var(--text-light)' }}>Loading…</div>
      </div>
    )
  }

  if (!course) {
    return (
      <div style={{ minHeight: '100vh', background: 'var(--cream)', fontFamily: 'var(--font-sans)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '16px' }}>
        <div style={{ fontSize: '14px', color: 'var(--text-light)' }}>Course not found</div>
        <Link href="/admin/courses" style={{ fontSize: '13px', color: 'var(--green-mid)', textDecoration: 'none' }}>
          ← Back to Queue
        </Link>
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--cream)', fontFamily: 'var(--font-sans)', paddingBottom: '80px' }}>

      {/* ── Header ──────────────────────────────────────────── */}
      <header style={{
        background:     'var(--green-deep)',
        padding:        '0 48px',
        height:         '64px',
        display:        'flex',
        alignItems:     'center',
        justifyContent: 'space-between',
        position:       'sticky',
        top:            0,
        zIndex:         20,
      }}>
        <Link href="/admin/courses" style={{ fontFamily: 'var(--font-serif)', fontSize: '20px', color: 'var(--gold-light)', letterSpacing: '0.02em', textDecoration: 'none' }}>
          Greenlit
        </Link>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <Link href="/admin/courses" style={{ fontSize: '12px', color: 'rgba(245,240,232,0.5)', textDecoration: 'none', letterSpacing: '0.04em' }}>
            ← Queue
          </Link>
          <Link href={`/course/${slug}`} style={{ fontSize: '12px', color: 'rgba(245,240,232,0.5)', textDecoration: 'none', letterSpacing: '0.04em' }} target="_blank">
            View Live ↗
          </Link>
        </div>
      </header>

      {/* ── Page header ─────────────────────────────────────── */}
      <div style={{ padding: '40px 48px 28px', borderBottom: '1px solid var(--cream-dark)', background: 'var(--white)', display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between' }}>
        <div>
          <div style={{ fontSize: '10px', letterSpacing: '0.25em', textTransform: 'uppercase', color: 'var(--green-light)', fontWeight: 600, marginBottom: '6px' }}>
            Course Editor
          </div>
          <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: '28px', color: 'var(--green-deep)', fontWeight: 600, margin: 0 }}>
            {formData.name ?? course.name}
          </h1>
          <p style={{ fontSize: '13px', color: 'var(--text-light)', marginTop: '4px', fontWeight: 300 }}>
            {formData.location}, {formData.country}
          </p>
        </div>
        <button
          onClick={() => setShowReenrich(true)}
          style={{
            padding:       '10px 20px',
            borderRadius:  'var(--radius-sm)',
            background:    'transparent',
            color:         'var(--gold)',
            border:        '1px solid var(--gold)',
            fontSize:      '12px',
            fontWeight:    600,
            cursor:        'pointer',
            letterSpacing: '0.05em',
            fontFamily:    'var(--font-sans)',
          }}
        >
          ↺ Re-enrich with AI
        </button>
      </div>

      {/* ── Re-enrich confirmation dialog ───────────────────── */}
      {showReenrich && (
        <div style={{
          padding:      '16px 48px',
          background:   'rgba(196,168,79,0.08)',
          border:       '1px solid rgba(196,168,79,0.25)',
          display:      'flex',
          alignItems:   'center',
          gap:          '16px',
        }}>
          <span style={{ fontSize: '13px', color: 'var(--green-deep)', fontWeight: 500, flex: 1 }}>
            This will overwrite your manual edits with AI-generated content. Continue?
          </span>
          <button
            onClick={handleReenrich}
            style={{ padding: '8px 16px', borderRadius: 'var(--radius-sm)', background: 'var(--gold)', color: 'var(--green-deep)', border: 'none', fontSize: '12px', fontWeight: 700, cursor: 'pointer', letterSpacing: '0.06em', textTransform: 'uppercase', fontFamily: 'var(--font-sans)' }}
          >
            Yes, Re-enrich
          </button>
          <button
            onClick={() => setShowReenrich(false)}
            style={{ padding: '8px 16px', borderRadius: 'var(--radius-sm)', background: 'transparent', color: 'var(--text-light)', border: '1px solid var(--cream-dark)', fontSize: '12px', fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--font-sans)' }}
          >
            Cancel
          </button>
        </div>
      )}

      {/* ── Form ────────────────────────────────────────────── */}
      <div style={{ padding: '32px 48px', maxWidth: '900px' }}>

        {/* Section 1: Basic Info */}
        <div style={sectionStyle}>
          <div style={sectionTitleStyle}>Basic Information</div>

          {fieldRow(<>
            <div style={{ flex: 2 }}>
              <label style={labelStyle}>Name</label>
              <input style={inputStyle} value={formData.name ?? ''} onChange={e => set('name', e.target.value)} />
            </div>
            <div style={{ flex: 1 }}>
              <label style={labelStyle}>Emoji</label>
              <input style={{ ...inputStyle, maxWidth: '80px' }} value={formData.emoji ?? ''} onChange={e => set('emoji', e.target.value)} />
            </div>
          </>)}

          <div style={{ marginBottom: '16px' }}>
            <label style={labelStyle}>Slug</label>
            <input style={inputStyle} value={formData.slug ?? ''} onChange={e => set('slug', e.target.value)} />
            {formData.slug !== course.slug && (
              <div style={{ fontSize: '11px', color: '#d97070', marginTop: '4px', fontWeight: 500 }}>
                ⚠ Changing the slug will break existing links to this course
              </div>
            )}
          </div>

          {fieldRow(<>
            <div style={{ flex: 1 }}>
              <label style={labelStyle}>Location</label>
              <input style={inputStyle} value={formData.location ?? ''} onChange={e => set('location', e.target.value)} />
            </div>
            <div style={{ flex: 1 }}>
              <label style={labelStyle}>Country</label>
              <input style={inputStyle} value={formData.country ?? ''} onChange={e => set('country', e.target.value)} />
            </div>
          </>)}

          {fieldRow(<>
            <div style={{ flex: 1 }}>
              <label style={labelStyle}>State / Region</label>
              <input style={inputStyle} value={formData.state ?? ''} onChange={e => set('state', e.target.value)} />
            </div>
            <div style={{ flex: 1 }}>
              <label style={labelStyle}>Tagline</label>
              <input style={inputStyle} value={formData.tagline ?? ''} onChange={e => set('tagline', e.target.value)} />
            </div>
          </>)}
        </div>

        {/* Section 2: Content */}
        <div style={sectionStyle}>
          <div style={sectionTitleStyle}>Content</div>

          <div style={{ marginBottom: '16px' }}>
            <label style={labelStyle}>Description</label>
            <textarea style={{ ...textareaStyle, minHeight: '180px', fontFamily: 'monospace', fontSize: '13px' }} value={formData.description ?? ''} onChange={e => set('description', e.target.value)} />
          </div>

          {/* Why It's Great — dynamic list */}
          <div style={{ marginBottom: '16px' }}>
            <label style={labelStyle}>Why It&apos;s Great</label>
            {(formData.why_its_great ?? []).map((item: string, i: number) => (
              <div key={i} style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
                <input style={{ ...inputStyle, flex: 1 }} value={item} onChange={e => updateListItem('why_its_great', i, e.target.value)} />
                <button
                  onClick={() => removeListItem('why_its_great', i)}
                  style={{ padding: '8px 12px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--cream-dark)', background: 'transparent', color: '#d97070', fontSize: '14px', cursor: 'pointer', flexShrink: 0 }}
                >
                  ✕
                </button>
              </div>
            ))}
            <button
              onClick={() => addListItem('why_its_great')}
              style={{ padding: '6px 14px', borderRadius: 'var(--radius-sm)', border: '1px dashed var(--cream-dark)', background: 'transparent', color: 'var(--green-mid)', fontSize: '12px', fontWeight: 500, cursor: 'pointer', fontFamily: 'var(--font-sans)' }}
            >
              + Add reason
            </button>
          </div>

          {/* Insider Tips — dynamic list */}
          <div style={{ marginBottom: '16px' }}>
            <label style={labelStyle}>Insider Tips</label>
            {(Array.isArray(formData.insider_tips) ? formData.insider_tips : []).map((item: string, i: number) => (
              <div key={i} style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
                <input style={{ ...inputStyle, flex: 1 }} value={typeof item === 'string' ? item : JSON.stringify(item)} onChange={e => updateListItem('insider_tips', i, e.target.value)} />
                <button
                  onClick={() => removeListItem('insider_tips', i)}
                  style={{ padding: '8px 12px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--cream-dark)', background: 'transparent', color: '#d97070', fontSize: '14px', cursor: 'pointer', flexShrink: 0 }}
                >
                  ✕
                </button>
              </div>
            ))}
            <button
              onClick={() => addListItem('insider_tips')}
              style={{ padding: '6px 14px', borderRadius: 'var(--radius-sm)', border: '1px dashed var(--cream-dark)', background: 'transparent', color: 'var(--green-mid)', fontSize: '12px', fontWeight: 500, cursor: 'pointer', fontFamily: 'var(--font-sans)' }}
            >
              + Add tip
            </button>
          </div>

          <div style={{ marginBottom: '16px' }}>
            <label style={labelStyle}>Trip Combinations</label>
            <textarea style={{ ...textareaStyle, minHeight: '80px' }} value={formData.trip_combinations ?? ''} onChange={e => set('trip_combinations', e.target.value)} />
          </div>
        </div>

        {/* Section 3: Logistics */}
        <div style={sectionStyle}>
          <div style={sectionTitleStyle}>Logistics</div>

          {fieldRow(<>
            <div style={{ flex: 1 }}>
              <label style={labelStyle}>Price Min ($)</label>
              <input type="number" style={inputStyle} value={formData.price_min ?? ''} onChange={e => set('price_min', e.target.value ? Number(e.target.value) : null)} />
            </div>
            <div style={{ flex: 1 }}>
              <label style={labelStyle}>Price Max ($)</label>
              <input type="number" style={inputStyle} value={formData.price_max ?? ''} onChange={e => set('price_max', e.target.value ? Number(e.target.value) : null)} />
            </div>
            <div style={{ flex: 1 }}>
              <label style={labelStyle}>Rating (0–5)</label>
              <input type="number" step="0.1" min="0" max="5" style={inputStyle} value={formData.rating ?? ''} onChange={e => set('rating', e.target.value ? Number(e.target.value) : null)} />
            </div>
          </>)}

          <div style={{ marginBottom: '16px' }}>
            <label style={labelStyle}>Pricing Notes</label>
            <input style={inputStyle} value={formData.pricing_notes ?? ''} onChange={e => set('pricing_notes', e.target.value)} />
          </div>

          {/* Toggles */}
          <div style={{ display: 'flex', gap: '32px', marginBottom: '16px', flexWrap: 'wrap' }}>
            {([
              ['walking_friendly',  'Walking Friendly'],
              ['caddie_available',  'Caddies Available'],
              ['lodging_on_property', 'Lodging on Property'],
            ] as [string, string][]).map(([field, label]) => (
              <label key={field} style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '13px', color: 'var(--green-deep)', fontWeight: 500 }}>
                <input
                  type="checkbox"
                  checked={!!formData[field]}
                  onChange={e => set(field, e.target.checked)}
                  style={{ width: '18px', height: '18px', accentColor: 'var(--gold)' }}
                />
                {label}
              </label>
            ))}
          </div>

          {fieldRow(<>
            <div style={{ flex: 1 }}>
              <label style={labelStyle}>Caddie Notes</label>
              <input style={inputStyle} value={formData.caddie_notes ?? ''} onChange={e => set('caddie_notes', e.target.value)} />
            </div>
            <div style={{ flex: 1 }}>
              <label style={labelStyle}>Pace of Play</label>
              <input style={inputStyle} value={formData.pace_of_play ?? ''} onChange={e => set('pace_of_play', e.target.value)} />
            </div>
          </>)}

          <div style={{ marginBottom: '16px' }}>
            <label style={labelStyle}>Advance Booking Required</label>
            <input style={inputStyle} value={formData.advance_booking_required ?? ''} onChange={e => set('advance_booking_required', e.target.value)} />
          </div>

          <div style={{ marginBottom: '16px' }}>
            <label style={labelStyle}>Best Time to Visit</label>
            <textarea style={{ ...textareaStyle, minHeight: '60px' }} value={formData.best_time_to_visit ?? ''} onChange={e => set('best_time_to_visit', e.target.value)} />
          </div>

          {formData.lodging_on_property && (
            <div style={{ marginBottom: '16px' }}>
              <label style={labelStyle}>Lodging Description</label>
              <textarea style={{ ...textareaStyle, minHeight: '60px' }} value={formData.lodging_description ?? ''} onChange={e => set('lodging_description', e.target.value)} />
            </div>
          )}
        </div>

        {/* Section 4: Tags */}
        <div style={sectionStyle}>
          <div style={sectionTitleStyle}>Tags</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '8px' }}>
            {ALL_TAGS.map(tag => {
              const active = (formData.tags ?? []).includes(tag)
              return (
                <button
                  key={tag}
                  onClick={() => toggleTag(tag)}
                  style={{
                    padding:       '8px 14px',
                    borderRadius:  '99px',
                    border:        active ? '1px solid var(--gold)' : '1px solid var(--cream-dark)',
                    background:    active ? 'rgba(196,168,79,0.12)' : 'var(--cream)',
                    color:         active ? 'var(--gold)' : 'var(--text-light)',
                    fontSize:      '12px',
                    fontWeight:    active ? 600 : 400,
                    cursor:        'pointer',
                    fontFamily:    'var(--font-sans)',
                    textAlign:     'left',
                    transition:    'all 0.15s',
                  }}
                >
                  {active ? '✓ ' : ''}{tag}
                </button>
              )
            })}
          </div>
        </div>

        {/* Section 5: Structured Data (JSON editors) */}
        <div style={sectionStyle}>
          <div style={sectionTitleStyle}>Structured Data</div>

          {(['courses_on_property', 'nearby_lodging', 'common_questions'] as const).map(field => (
            <div key={field} style={{ marginBottom: '20px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                <label style={{ ...labelStyle, marginBottom: 0 }}>{field.replace(/_/g, ' ')}</label>
                <button
                  onClick={() => validateJson(field)}
                  style={{
                    padding:      '4px 10px',
                    borderRadius: 'var(--radius-sm)',
                    border:       `1px solid ${jsonErrors[field] === null || jsonErrors[field] === undefined ? 'var(--cream-dark)' : '#d97070'}`,
                    background:   'transparent',
                    fontSize:     '11px',
                    fontWeight:   600,
                    color:        jsonErrors[field] ? '#d97070' : 'var(--green-mid)',
                    cursor:       'pointer',
                    fontFamily:   'var(--font-sans)',
                  }}
                >
                  {jsonErrors[field] ? '✗ Invalid' : '✓ Validate JSON'}
                </button>
              </div>
              <textarea
                style={{ ...textareaStyle, minHeight: '120px', fontFamily: 'monospace', fontSize: '12px' }}
                value={getJsonString(field)}
                onChange={e => setJsonField(field, e.target.value)}
              />
              {jsonErrors[field] && (
                <div style={{ fontSize: '11px', color: '#d97070', marginTop: '4px' }}>
                  {jsonErrors[field]}
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Section 6: Media & External */}
        <div style={sectionStyle}>
          <div style={sectionTitleStyle}>Media &amp; External</div>
          {fieldRow(<>
            <div style={{ flex: 1 }}>
              <label style={labelStyle}>Google Place ID</label>
              <input style={inputStyle} value={formData.google_place_id ?? ''} onChange={e => set('google_place_id', e.target.value)} />
            </div>
            <div style={{ flex: 1 }}>
              <label style={labelStyle}>YouTube Search Query</label>
              <input style={inputStyle} value={formData.youtube_search_query ?? ''} onChange={e => set('youtube_search_query', e.target.value)} />
            </div>
          </>)}
        </div>

        {/* Section 7: Metadata (read-only) */}
        <div style={{ ...sectionStyle, background: 'var(--cream)' }}>
          <div style={sectionTitleStyle}>Metadata (Read-only)</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            {[
              ['ID', course.id],
              ['Created', fmt(course.created_at)],
              ['Updated', fmt(course.updated_at)],
              ['Google Place ID', course.google_place_id ?? '—'],
            ].map(([label, value]) => (
              <div key={label as string}>
                <div style={{ fontSize: '10px', letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-light)', fontWeight: 500, marginBottom: '4px' }}>{label}</div>
                <div style={{ fontSize: '13px', color: 'var(--green-deep)', fontWeight: 400, wordBreak: 'break-all' }}>{value}</div>
              </div>
            ))}
          </div>
        </div>

      </div>

      {/* ── Sticky Save Footer ──────────────────────────────── */}
      <div style={{
        position:       'fixed',
        bottom:         0,
        left:           0,
        right:          0,
        zIndex:         30,
        background:     'var(--green-deep)',
        padding:        '14px 48px',
        display:        'flex',
        justifyContent: 'space-between',
        alignItems:     'center',
        borderTop:      '1px solid rgba(255,255,255,0.1)',
      }}>
        {/* Unsaved indicator */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div style={{
            width:        '8px',
            height:       '8px',
            borderRadius: '50%',
            background:   hasUnsavedChanges ? 'var(--gold)' : 'var(--green-light)',
          }} />
          <span style={{ fontSize: '12px', color: hasUnsavedChanges ? 'var(--gold-light)' : 'rgba(245,240,232,0.5)', fontWeight: hasUnsavedChanges ? 500 : 300 }}>
            {hasUnsavedChanges ? 'Unsaved changes' : 'All changes saved'}
          </span>
        </div>

        {/* Save message */}
        {saveMsg && (
          <span style={{ fontSize: '12px', color: saveMsg.ok ? 'var(--gold-light)' : '#d97070', fontWeight: 500 }}>
            {saveMsg.text}
          </span>
        )}

        {/* Save button */}
        <button
          onClick={handleSave}
          disabled={saving || !hasUnsavedChanges}
          style={{
            padding:       '10px 28px',
            borderRadius:  'var(--radius-sm)',
            background:    (saving || !hasUnsavedChanges) ? 'rgba(196,168,79,0.3)' : 'var(--gold)',
            color:         (saving || !hasUnsavedChanges) ? 'rgba(26,46,26,0.5)' : 'var(--green-deep)',
            border:        'none',
            fontSize:      '12px',
            fontWeight:    700,
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
            cursor:        (saving || !hasUnsavedChanges) ? 'not-allowed' : 'pointer',
            fontFamily:    'var(--font-sans)',
            transition:    'all 0.2s',
          }}
        >
          {saving ? 'Saving…' : 'Save Changes'}
        </button>
      </div>
    </div>
  )
}
