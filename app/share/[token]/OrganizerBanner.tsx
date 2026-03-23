'use client'

import React, { useRef, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/context/AuthContext'

// ─── Types ─────────────────────────────────────────────────────────────────────

type ReportSettings = {
  organizer_note?:       string
  accommodation_name?:   string
  accommodation_url?:    string
  accommodation_address?: string
  show_itinerary?:   boolean
  show_tee_sheet?:   boolean
  show_budget?:      boolean
  show_cup?:         boolean
  show_accommodation?: boolean
  show_courses?:     boolean
  show_organizer_note?: boolean
}

interface OrganizerBannerProps {
  tripId:           string
  tripName:         string
  createdBy:        string
  shareToken:       string
  startDate:        string | null
  endDate:          string | null
  initialTagline:   string | null
  initialDayNotes:  Record<string, string>
  initialCoverUrl:  string | null
  initialSettings:  ReportSettings
  dayCount:         number
  currentView:      'quickview' | 'brochure'
  organizerName?:   string
}

// ─── Toggle Component ──────────────────────────────────────────────────────────

function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 0', cursor: 'pointer' }}>
      <span style={{ fontSize: '13px', color: 'var(--text-dark)', fontWeight: 400 }}>{label}</span>
      <div
        onClick={(e) => { e.preventDefault(); onChange(!checked) }}
        style={{
          width: '36px', height: '20px', borderRadius: '10px',
          background: checked ? 'var(--gold)' : '#d1d5db',
          position: 'relative', transition: 'background 0.2s', cursor: 'pointer', flexShrink: 0,
        }}
      >
        <div style={{
          width: '16px', height: '16px', borderRadius: '50%', background: '#fff',
          position: 'absolute', top: '2px',
          left: checked ? '18px' : '2px',
          transition: 'left 0.2s', boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
        }} />
      </div>
    </label>
  )
}

// ─── Section Label ─────────────────────────────────────────────────────────────

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      fontSize: '11px', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase',
      color: 'var(--text-mid)', marginBottom: '8px',
    }}>
      {children}
    </div>
  )
}

// ─── Main Component ────────────────────────────────────────────────────────────

export default function OrganizerBanner({
  tripId, tripName, createdBy, shareToken,
  startDate, endDate,
  initialTagline, initialDayNotes, initialCoverUrl,
  initialSettings, dayCount, currentView, organizerName,
}: OrganizerBannerProps) {
  const { session, loading } = useAuth()
  const isOrganizer = !loading && session?.user?.id === createdBy

  const [customizeOpen, setCustomizeOpen] = useState(false)
  const [shareOpen,     setShareOpen]     = useState(false)

  // Core fields
  const [tagline,       setTagline]       = useState(initialTagline ?? '')
  const [dayNotes,      setDayNotes]      = useState<Record<string, string>>(initialDayNotes)
  const [coverUrl,      setCoverUrl]      = useState(initialCoverUrl ?? '')

  // Extended settings (stored in custom_sections JSONB)
  const [organizerNote,    setOrganizerNote]    = useState(initialSettings.organizer_note ?? '')
  const [accommName,       setAccommName]       = useState(initialSettings.accommodation_name ?? '')
  const [accommUrl,        setAccommUrl]        = useState(initialSettings.accommodation_url ?? '')
  const [accommAddress,    setAccommAddress]    = useState(initialSettings.accommodation_address ?? '')

  // Visibility toggles
  const [showItinerary,    setShowItinerary]    = useState(initialSettings.show_itinerary !== false)
  const [showTeeSheet,     setShowTeeSheet]     = useState(initialSettings.show_tee_sheet !== false)
  const [showBudget,       setShowBudget]       = useState(initialSettings.show_budget !== false)
  const [showCup,          setShowCup]          = useState(initialSettings.show_cup !== false)
  const [showAccomm,       setShowAccomm]       = useState(initialSettings.show_accommodation !== false)
  const [showCourses,      setShowCourses]      = useState(initialSettings.show_courses !== false)
  const [showOrgNote,      setShowOrgNote]      = useState(initialSettings.show_organizer_note !== false)

  // UI state
  const [saving,     setSaving]    = useState(false)
  const [saved,      setSaved]     = useState(false)
  const [saveError,  setSaveError] = useState<string | null>(null)
  const [uploading,  setUploading] = useState(false)
  const [copied,     setCopied]    = useState<string | null>(null)

  const fileInputRef = useRef<HTMLInputElement>(null)

  const appUrl   = typeof window !== 'undefined' ? window.location.origin : 'https://greenlit.golf'
  const quickUrl = `${appUrl}/share/${shareToken}`
  const brochUrl = `${appUrl}/share/${shareToken}/brochure`

  const days = Array.from({ length: dayCount }, (_, i) => i + 1)

  if (loading || !isOrganizer) return null

  // ─── Save ──────────────────────────────────────────────────────────────────

  async function handleSave() {
    setSaving(true)
    setSaveError(null)

    // Build the settings object that goes into custom_sections
    const settings: ReportSettings = {
      organizer_note:       organizerNote.trim() || undefined,
      accommodation_name:   accommName.trim() || undefined,
      accommodation_url:    accommUrl.trim() || undefined,
      accommodation_address: accommAddress.trim() || undefined,
      show_itinerary:    showItinerary,
      show_tee_sheet:    showTeeSheet,
      show_budget:       showBudget,
      show_cup:          showCup,
      show_accommodation: showAccomm,
      show_courses:      showCourses,
      show_organizer_note: showOrgNote,
    }

    const { error } = await supabase.from('trip_report_customizations').upsert({
      trip_id:         tripId,
      tagline:         tagline.trim() || null,
      day_notes:       dayNotes,
      cover_photo_url: coverUrl || null,
      custom_sections: settings,
      updated_at:      new Date().toISOString(),
    }, { onConflict: 'trip_id' })

    setSaving(false)

    if (error) {
      console.error('Save failed:', error)
      setSaveError('Save failed. Please try again.')
      return
    }

    setSaved(true)
    setTimeout(() => {
      setSaved(false)
      // Reload to reflect changes in the server-rendered report
      window.location.reload()
    }, 1200)
  }

  // ─── Photo Upload ──────────────────────────────────────────────────────────

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    const ext  = file.name.split('.').pop() ?? 'jpg'
    const path = `${tripId}/cover.${ext}`
    const { data, error } = await supabase.storage
      .from('trip-photos').upload(path, file, { upsert: true })
    if (!error && data) {
      const { data: urlData } = supabase.storage.from('trip-photos').getPublicUrl(path)
      setCoverUrl(urlData.publicUrl)
    }
    setUploading(false)
  }

  async function copyLink(text: string, key: string) {
    await navigator.clipboard.writeText(text)
    setCopied(key)
    setTimeout(() => setCopied(null), 2000)
  }

  // ─── Styles ────────────────────────────────────────────────────────────────

  const btnBase: React.CSSProperties = {
    padding: '6px 14px', borderRadius: '6px', fontSize: '12px',
    fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--font-sans)',
    letterSpacing: '0.04em', border: 'none', transition: 'all 0.15s',
  }

  const inputStyle: React.CSSProperties = {
    padding: '10px 12px', borderRadius: '8px', border: '1px solid var(--cream-dark)',
    background: 'var(--cream)', fontSize: '13px', color: 'var(--text-dark)',
    fontFamily: 'var(--font-sans)', fontWeight: 300, outline: 'none',
    width: '100%', boxSizing: 'border-box' as const,
  }

  return (
    <>
      {/* ── Banner ── */}
      <div className="organizer-banner" style={{
        background: 'var(--cream)', borderBottom: '1px solid var(--cream-dark)',
        padding: '10px 40px', display: 'flex', alignItems: 'center',
        justifyContent: 'space-between', gap: '16px', flexShrink: 0, flexWrap: 'wrap',
      }}>
        <div className="organizer-banner-text" style={{ fontSize: '12px', color: 'var(--text-mid)', fontWeight: 300 }}>
          <span style={{ color: 'var(--gold)', marginRight: '6px' }}>✦</span>
          You&apos;re viewing your shareable trip report
        </div>
        <div className="organizer-banner-buttons" style={{ display: 'flex', gap: '8px' }}>
          <button
            onClick={() => { setCustomizeOpen(true); setShareOpen(false) }}
            style={{ ...btnBase, background: 'var(--green-deep)', color: 'var(--gold-light)' }}
          >
            Customize
          </button>
          <button
            onClick={() => { setShareOpen(true); setCustomizeOpen(false) }}
            style={{ ...btnBase, background: 'transparent', border: '1px solid var(--cream-dark)', color: 'var(--text-mid)' }}
          >
            Share
          </button>
        </div>
      </div>

      {/* ── Customize drawer backdrop ── */}
      {customizeOpen && (
        <div
          onClick={() => setCustomizeOpen(false)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.3)', zIndex: 100 }}
        />
      )}

      {/* ── Customize drawer ── */}
      {customizeOpen && (
        <div className="customize-drawer" style={{
          position: 'fixed', top: 0, right: 0, bottom: 0, width: '420px', maxWidth: '100vw',
          background: 'var(--white)', zIndex: 101, display: 'flex', flexDirection: 'column',
          boxShadow: '-4px 0 32px rgba(0,0,0,0.15)',
          animation: 'slideInRight 0.22s ease',
        }}>
          {/* Header */}
          <div style={{
            padding: '24px 28px 18px', borderBottom: '1px solid var(--cream-dark)',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0,
          }}>
            <div style={{ fontFamily: 'var(--font-serif)', fontSize: '20px', color: 'var(--green-deep)', fontWeight: 600 }}>
              Customize Report
            </div>
            <button onClick={() => setCustomizeOpen(false)} style={{ background: 'none', border: 'none', fontSize: '22px', cursor: 'pointer', color: 'var(--text-light)', lineHeight: 1 }}>×</button>
          </div>

          {/* Body */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '24px 28px', display: 'flex', flexDirection: 'column', gap: '26px' }}>

            {/* ── Trip Tagline ── */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <SectionLabel>Trip Tagline</SectionLabel>
              <input
                type="text"
                value={tagline}
                maxLength={100}
                onChange={(e) => setTagline(e.target.value)}
                placeholder="Five guys. Four courses. One unforgettable week."
                style={{ ...inputStyle, fontSize: '14px' }}
              />
              <div style={{ fontSize: '11px', color: 'var(--text-light)', textAlign: 'right' }}>{tagline.length}/100</div>
            </div>

            {/* ── From the Organizer ── */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <SectionLabel>From the Organizer</SectionLabel>
              <p style={{ fontSize: '12px', color: 'var(--text-light)', fontWeight: 300, margin: 0 }}>
                A personal message to the group. Appears as a premium callout near the top of the report.
              </p>
              <textarea
                rows={4}
                value={organizerNote}
                maxLength={500}
                onChange={(e) => setOrganizerNote(e.target.value)}
                placeholder="Welcome to the trip of a lifetime! Here's everything you need to know..."
                style={{ ...inputStyle, resize: 'vertical' }}
              />
              <div style={{ fontSize: '11px', color: 'var(--text-light)', textAlign: 'right' }}>{organizerNote.length}/500</div>
              {/* Preview */}
              {organizerNote.trim() && (
                <div style={{
                  padding: '12px 16px', borderLeft: '3px solid var(--gold)',
                  background: 'var(--cream)', borderRadius: '0 8px 8px 0',
                  fontFamily: 'var(--font-serif)', fontStyle: 'italic',
                  fontSize: '13px', color: 'var(--green-deep)', lineHeight: 1.7,
                }}>
                  &ldquo;{organizerNote.trim()}&rdquo;
                  {organizerName && (
                    <div style={{ fontSize: '11px', color: 'var(--text-light)', fontStyle: 'normal', marginTop: '6px', fontFamily: 'var(--font-sans)' }}>
                      — {organizerName}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* ── Accommodation ── */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <SectionLabel>Accommodation Details</SectionLabel>
              <input
                type="text" value={accommName}
                onChange={(e) => setAccommName(e.target.value)}
                placeholder="Accommodation name"
                style={inputStyle}
              />
              <input
                type="text" value={accommAddress}
                onChange={(e) => setAccommAddress(e.target.value)}
                placeholder="Address"
                style={inputStyle}
              />
              <input
                type="url" value={accommUrl}
                onChange={(e) => setAccommUrl(e.target.value)}
                placeholder="Booking link (Airbnb, VRBO, hotel...)"
                style={inputStyle}
              />
            </div>

            {/* ── Group Photo ── */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <SectionLabel>Group Photo</SectionLabel>
              <p style={{ fontSize: '12px', color: 'var(--text-light)', fontWeight: 300, margin: 0 }}>
                Appears as a circular inset on the brochure cover.
              </p>
              {coverUrl ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <img src={coverUrl} alt="Cover" style={{ width: '60px', height: '60px', borderRadius: '50%', objectFit: 'cover' }} />
                  <button onClick={() => setCoverUrl('')} style={{ ...btnBase, background: 'transparent', border: '1px solid rgba(192,57,43,0.3)', color: '#c0392b' }}>Remove</button>
                </div>
              ) : (
                <button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading}
                  style={{
                    border: '2px dashed var(--cream-dark)', borderRadius: '10px',
                    padding: '20px', background: 'var(--cream)', cursor: uploading ? 'wait' : 'pointer',
                    color: 'var(--text-light)', fontSize: '13px', fontFamily: 'var(--font-sans)',
                    fontWeight: 400, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px',
                  }}
                >
                  <span style={{ fontSize: '22px' }}>📷</span>
                  {uploading ? 'Uploading...' : '+ Add group photo'}
                </button>
              )}
              <input ref={fileInputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleFileChange} />
            </div>

            {/* Separator */}
            <div style={{ borderTop: '1px solid var(--cream-dark)' }} />

            {/* ── Section Visibility ── */}
            <div>
              <SectionLabel>Section Visibility</SectionLabel>
              <p style={{ fontSize: '12px', color: 'var(--text-light)', fontWeight: 300, margin: '0 0 8px' }}>
                Toggle sections on or off to control what the group sees.
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                <Toggle checked={showItinerary} onChange={setShowItinerary} label="Itinerary" />
                <Toggle checked={showCourses} onChange={setShowCourses} label="Course Details" />
                <Toggle checked={showTeeSheet} onChange={setShowTeeSheet} label="Tee Sheet" />
                <Toggle checked={showAccomm} onChange={setShowAccomm} label="Accommodation" />
                <Toggle checked={showBudget} onChange={setShowBudget} label="Budget" />
                <Toggle checked={showCup} onChange={setShowCup} label="The Cup" />
                <Toggle checked={showOrgNote} onChange={setShowOrgNote} label="From the Organizer" />
              </div>
            </div>
          </div>

          {/* Footer */}
          <div style={{ padding: '16px 28px', borderTop: '1px solid var(--cream-dark)', flexShrink: 0 }}>
            {saveError && (
              <div style={{ fontSize: '12px', color: '#c0392b', marginBottom: '8px', textAlign: 'center' }}>
                {saveError}
              </div>
            )}
            <button
              onClick={handleSave}
              disabled={saving}
              style={{
                width: '100%', padding: '13px', borderRadius: '8px', border: 'none',
                background: saved ? 'var(--green-light)' : 'var(--green-deep)',
                color: 'var(--gold-light)', fontSize: '14px', fontWeight: 600,
                cursor: saving ? 'wait' : 'pointer', fontFamily: 'var(--font-sans)',
                letterSpacing: '0.04em', transition: 'all 0.2s',
              }}
            >
              {saving ? 'Saving...' : saved ? '✓ Saved!' : 'Save Changes'}
            </button>
          </div>
        </div>
      )}

      {/* ── Share popover backdrop ── */}
      {shareOpen && (
        <div onClick={() => setShareOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 100 }} />
      )}

      {/* ── Share popover ── */}
      {shareOpen && (
        <div className="share-popover" style={{
          position: 'fixed', top: '52px', right: '24px',
          background: 'var(--white)', border: '1px solid var(--cream-dark)',
          borderRadius: '12px', boxShadow: '0 8px 32px rgba(0,0,0,0.14)',
          padding: '20px', width: '320px', maxWidth: 'calc(100vw - 32px)', zIndex: 101,
          animation: 'fadeInDown 0.15s ease',
        }}>
          <div style={{ fontFamily: 'var(--font-serif)', fontSize: '16px', color: 'var(--green-deep)', fontWeight: 600, marginBottom: '16px' }}>
            Share {tripName}
          </div>

          {[
            { label: 'Quick View', url: quickUrl, key: 'quick' },
            { label: 'Brochure', url: brochUrl, key: 'brochure' },
          ].map(({ label, url, key }) => (
            <div key={key} style={{ marginBottom: '12px' }}>
              <div style={{ fontSize: '11px', color: 'var(--text-light)', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: '5px' }}>{label}</div>
              <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                <input
                  readOnly value={url}
                  style={{
                    flex: 1, padding: '8px 10px', borderRadius: '6px',
                    border: '1px solid var(--cream-dark)', background: 'var(--cream)',
                    fontSize: '12px', color: 'var(--text-mid)', fontFamily: 'var(--font-sans)',
                    outline: 'none', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  }}
                  onClick={(e) => (e.target as HTMLInputElement).select()}
                />
                <button
                  onClick={() => copyLink(url, key)}
                  style={{ ...btnBase, background: copied === key ? 'var(--green-light)' : 'var(--green-deep)', color: 'var(--gold-light)', padding: '8px 12px', flexShrink: 0 }}
                >
                  {copied === key ? '✓' : 'Copy'}
                </button>
              </div>
            </div>
          ))}

          <div style={{ borderTop: '1px solid var(--cream-dark)', paddingTop: '12px', marginTop: '4px' }}>
            <button
              onClick={() => { setShareOpen(false); window.print() }}
              style={{ ...btnBase, width: '100%', padding: '10px', background: 'var(--cream)', border: '1px solid var(--cream-dark)', color: 'var(--text-mid)', textAlign: 'center' }}
            >
              ⎙ Download PDF
            </button>
          </div>
        </div>
      )}

      <style>{`
        @keyframes slideInRight { from { transform: translateX(100%) } to { transform: translateX(0) } }
        @keyframes fadeInDown { from { opacity: 0; transform: translateY(-6px) } to { opacity: 1; transform: translateY(0) } }
        @media (max-width: 640px) {
          .organizer-banner { padding: 10px 16px !important; flex-direction: column !important; align-items: stretch !important; gap: 8px !important; }
          .organizer-banner-text { display: none !important; }
          .organizer-banner-buttons { display: flex !important; gap: 8px !important; }
          .organizer-banner-buttons button { flex: 1 !important; min-height: 44px !important; font-size: 13px !important; }
          .customize-drawer { width: 100vw !important; }
          .share-popover { right: 16px !important; left: 16px !important; width: auto !important; }
        }
      `}</style>
    </>
  )
}
