'use client'

import React, { useEffect, useRef, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/context/AuthContext'

interface OrganizerBannerProps {
  tripId:          string
  tripName:        string
  createdBy:       string
  shareToken:      string
  startDate:       string | null
  endDate:         string | null
  initialTagline:  string | null
  initialDayNotes: Record<string, string>
  initialCoverUrl: string | null
  dayCount:        number
  currentView:     'quickview' | 'brochure'
}

function getTripDayCount(start: string | null, end: string | null): number {
  if (!start) return 1
  const s = new Date(start + 'T12:00:00')
  const e = end ? new Date(end + 'T12:00:00') : s
  return Math.max(1, Math.round((e.getTime() - s.getTime()) / 86400000) + 1)
}

export default function OrganizerBanner({
  tripId, tripName, createdBy, shareToken,
  startDate, endDate,
  initialTagline, initialDayNotes, initialCoverUrl,
  dayCount, currentView,
}: OrganizerBannerProps) {
  const { session, loading } = useAuth()
  const isOrganizer = !loading && session?.user?.id === createdBy

  const [customizeOpen, setCustomizeOpen] = useState(false)
  const [shareOpen,     setShareOpen]     = useState(false)
  const [tagline,       setTagline]       = useState(initialTagline ?? '')
  const [dayNotes,      setDayNotes]      = useState<Record<string, string>>(initialDayNotes)
  const [coverUrl,      setCoverUrl]      = useState(initialCoverUrl ?? '')
  const [saving,        setSaving]        = useState(false)
  const [saved,         setSaved]         = useState(false)
  const [uploading,     setUploading]     = useState(false)
  const [copied,        setCopied]        = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const appUrl     = typeof window !== 'undefined' ? window.location.origin : 'https://greenlit.golf'
  const quickUrl   = `${appUrl}/share/${shareToken}`
  const brochUrl   = `${appUrl}/share/${shareToken}/brochure`

  const days = Array.from({ length: dayCount }, (_, i) => i + 1)

  if (loading || !isOrganizer) return null

  async function handleSave() {
    setSaving(true)
    await supabase.from('trip_report_customizations').upsert({
      trip_id:         tripId,
      tagline:         tagline.trim() || null,
      day_notes:       dayNotes,
      cover_photo_url: coverUrl || null,
      updated_at:      new Date().toISOString(),
    })
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2500)
  }

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

  const btnBase: React.CSSProperties = {
    padding: '6px 14px', borderRadius: '6px', fontSize: '12px',
    fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--font-sans)',
    letterSpacing: '0.04em', border: 'none', transition: 'all 0.15s',
  }

  return (
    <>
      {/* ── Banner ── */}
      <div style={{
        background: 'var(--cream)', borderBottom: '1px solid var(--cream-dark)',
        padding: '10px 40px', display: 'flex', alignItems: 'center',
        justifyContent: 'space-between', gap: '16px', flexShrink: 0,
      }}>
        <div style={{ fontSize: '12px', color: 'var(--text-mid)', fontWeight: 300 }}>
          <span style={{ color: 'var(--gold)', marginRight: '6px' }}>✦</span>
          You&apos;re viewing your shareable trip report
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
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
        <div style={{
          position: 'fixed', top: 0, right: 0, bottom: 0, width: '420px',
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
          <div style={{ flex: 1, overflowY: 'auto', padding: '24px 28px', display: 'flex', flexDirection: 'column', gap: '22px' }}>

            {/* Tagline */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--text-mid)' }}>Trip Tagline</label>
              <input
                type="text"
                value={tagline}
                maxLength={100}
                onChange={(e) => setTagline(e.target.value)}
                placeholder="Five guys. Four courses. One unforgettable week."
                style={{
                  padding: '10px 12px', borderRadius: '8px', border: '1px solid var(--cream-dark)',
                  background: 'var(--cream)', fontSize: '14px', color: 'var(--text-dark)',
                  fontFamily: 'var(--font-sans)', fontWeight: 300, outline: 'none', width: '100%', boxSizing: 'border-box',
                }}
              />
              <div style={{ fontSize: '11px', color: 'var(--text-light)', textAlign: 'right' }}>{tagline.length}/100</div>
            </div>

            {/* Day notes */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--text-mid)' }}>Day Notes</div>
              {days.map((dayNum) => (
                <div key={dayNum} style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                  <label style={{ fontSize: '11px', color: 'var(--text-light)', fontWeight: 500 }}>Day {dayNum}</label>
                  <textarea
                    rows={2}
                    value={dayNotes[String(dayNum)] ?? ''}
                    onChange={(e) => setDayNotes((prev) => ({ ...prev, [String(dayNum)]: e.target.value }))}
                    placeholder={`Add a note for the group about Day ${dayNum}…`}
                    style={{
                      padding: '9px 12px', borderRadius: '8px', border: '1px solid var(--cream-dark)',
                      background: 'var(--cream)', fontSize: '13px', color: 'var(--text-dark)',
                      fontFamily: 'var(--font-sans)', fontWeight: 300, outline: 'none',
                      width: '100%', boxSizing: 'border-box', resize: 'vertical',
                    }}
                  />
                </div>
              ))}
            </div>

            {/* Cover photo */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <label style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--text-mid)' }}>Group Photo</label>
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
                  {uploading ? 'Uploading…' : '+ Add group photo'}
                </button>
              )}
              <input ref={fileInputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleFileChange} />
            </div>
          </div>

          {/* Footer */}
          <div style={{ padding: '16px 28px', borderTop: '1px solid var(--cream-dark)', flexShrink: 0 }}>
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
              {saving ? 'Saving…' : saved ? '✓ Saved!' : 'Save Changes'}
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
        <div style={{
          position: 'fixed', top: '52px', right: '24px',
          background: 'var(--white)', border: '1px solid var(--cream-dark)',
          borderRadius: '12px', boxShadow: '0 8px 32px rgba(0,0,0,0.14)',
          padding: '20px', width: '320px', zIndex: 101,
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
      `}</style>
    </>
  )
}
