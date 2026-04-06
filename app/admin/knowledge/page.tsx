'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { useRouter }                                 from 'next/navigation'
import Link                                          from 'next/link'
import { supabase }                                  from '@/lib/supabase'
import { useAuth }                                   from '@/context/AuthContext'

// ── Types ────────────────────────────────────────────────────────────────────

type Category =
  | 'trip_recommendation' | 'course_review' | 'hidden_gem'
  | 'dining' | 'activities' | 'travel_tip' | 'itinerary'
  | 'destination_guide' | 'influencer_content' | 'general'

type Platform = 'instagram' | 'tiktok' | 'youtube' | 'x' | 'article' | 'personal' | 'other'

type KnowledgeEntry = {
  id:                string
  category:          Category
  title:             string
  content:           string
  source_url:        string | null
  source_platform:   Platform | null
  source_author:     string | null
  destinations:      string[]
  courses_mentioned: string[]
  tags:              string[]
  is_active:         boolean
  created_at:        string
  updated_at:        string
}

type FormState = {
  id?:               string
  title:             string
  content:           string
  category:          Category
  source_url:        string
  source_platform:   Platform | ''
  source_author:     string
  destinations:      string[]
  courses_mentioned: string[]
  tags:              string[]
  is_active:         boolean
}

const EMPTY_FORM: FormState = {
  title: '', content: '', category: 'general',
  source_url: '', source_platform: '', source_author: '',
  destinations: [], courses_mentioned: [], tags: [], is_active: true,
}

const CATEGORIES: { value: Category; label: string }[] = [
  { value: 'trip_recommendation', label: 'Trip Recommendation' },
  { value: 'course_review',      label: 'Course Review' },
  { value: 'hidden_gem',         label: 'Hidden Gem' },
  { value: 'dining',             label: 'Dining' },
  { value: 'activities',         label: 'Activities' },
  { value: 'travel_tip',         label: 'Travel Tip' },
  { value: 'itinerary',          label: 'Itinerary' },
  { value: 'destination_guide',  label: 'Destination Guide' },
  { value: 'influencer_content', label: 'Influencer Content' },
  { value: 'general',            label: 'General' },
]

const PLATFORMS: { value: Platform; label: string }[] = [
  { value: 'instagram', label: 'Instagram' },
  { value: 'tiktok',    label: 'TikTok' },
  { value: 'youtube',   label: 'YouTube' },
  { value: 'x',         label: 'X' },
  { value: 'article',   label: 'Article' },
  { value: 'personal',  label: 'Personal' },
  { value: 'other',     label: 'Other' },
]

// ── Styles ───────────────────────────────────────────────────────────────────

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '10px 14px', borderRadius: 'var(--radius-sm)',
  border: '1px solid var(--cream-dark)', background: 'var(--cream)',
  fontSize: '14px', color: 'var(--green-deep)', fontFamily: 'var(--font-sans)',
  outline: 'none', boxSizing: 'border-box',
}

const textareaStyle: React.CSSProperties = {
  ...inputStyle, resize: 'vertical', lineHeight: 1.5,
}

const labelStyle: React.CSSProperties = {
  display: 'block', fontSize: '11px', fontWeight: 600,
  letterSpacing: '0.08em', textTransform: 'uppercase' as const,
  color: 'var(--text-light)', marginBottom: '6px',
}

const sectionStyle: React.CSSProperties = {
  background: 'var(--white)', border: '1px solid var(--cream-dark)',
  borderRadius: 'var(--radius-lg)', padding: '24px', marginBottom: '20px',
}

const sectionTitleStyle: React.CSSProperties = {
  fontSize: '10px', letterSpacing: '0.15em', textTransform: 'uppercase' as const,
  color: 'var(--green-light)', fontWeight: 600, marginBottom: '20px',
  fontFamily: 'var(--font-sans)',
}

const btnPrimary: React.CSSProperties = {
  padding: '10px 20px', borderRadius: 'var(--radius-sm)',
  background: '#2d4a2d', color: '#ffffff', border: 'none',
  fontSize: '13px', fontWeight: 600, cursor: 'pointer',
  fontFamily: 'var(--font-sans)',
}

const btnOutline: React.CSSProperties = {
  ...btnPrimary, background: 'transparent',
  border: '1px solid var(--cream-dark)', color: 'var(--green-deep)',
}

const btnSmall: React.CSSProperties = {
  padding: '4px 10px', borderRadius: 'var(--radius-sm)',
  border: '1px solid var(--cream-dark)', background: 'transparent',
  fontSize: '11px', fontWeight: 600, cursor: 'pointer',
  fontFamily: 'var(--font-sans)', color: 'var(--green-deep)',
}

const btnDanger: React.CSSProperties = {
  ...btnSmall, color: '#d97070', borderColor: '#d97070',
}

const chipStyle = (active: boolean): React.CSSProperties => ({
  display: 'inline-block', padding: '4px 10px', borderRadius: '99px',
  fontSize: '12px', fontWeight: 500, cursor: 'pointer', marginRight: '6px',
  marginBottom: '6px', border: '1px solid',
  background: active ? 'var(--green)' : 'transparent',
  color: active ? 'var(--white)' : 'var(--green-deep)',
  borderColor: active ? 'var(--green)' : 'var(--cream-dark)',
})

const CATEGORY_COLORS: Record<Category, { bg: string; color: string }> = {
  trip_recommendation: { bg: 'rgba(45,90,60,0.15)',   color: 'var(--green-light)' },
  course_review:       { bg: 'rgba(196,168,79,0.15)', color: 'var(--gold)' },
  hidden_gem:          { bg: 'rgba(139,120,90,0.12)', color: 'var(--sand)' },
  dining:              { bg: 'rgba(180,100,50,0.12)', color: '#b46432' },
  activities:          { bg: 'rgba(80,130,180,0.12)', color: '#5082b4' },
  travel_tip:          { bg: 'rgba(100,160,100,0.12)',color: '#64a064' },
  itinerary:           { bg: 'rgba(130,100,170,0.12)',color: '#8264aa' },
  destination_guide:   { bg: 'rgba(45,90,60,0.25)',   color: 'var(--green)' },
  influencer_content:  { bg: 'rgba(200,80,120,0.12)', color: '#c85078' },
  general:             { bg: 'rgba(80,80,100,0.12)',   color: '#9b9bc0' },
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function fmt(iso: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('en-US', {
    month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
  })
}

function CategoryBadge({ category }: { category: Category }) {
  const cfg = CATEGORY_COLORS[category]
  const label = CATEGORIES.find(c => c.value === category)?.label ?? category
  return (
    <span style={{
      display: 'inline-block', padding: '2px 8px', borderRadius: '99px',
      fontSize: '11px', fontWeight: 600, letterSpacing: '0.04em',
      background: cfg.bg, color: cfg.color,
    }}>
      {label}
    </span>
  )
}

function PlatformIcon({ platform }: { platform: Platform | null }) {
  if (!platform) return null
  const label = PLATFORMS.find(p => p.value === platform)?.label ?? platform
  return (
    <span style={{ fontSize: '11px', color: 'var(--text-light)', fontWeight: 500 }}>
      {label}
    </span>
  )
}

// ── Tag Input Component ──────────────────────────────────────────────────────

function TagInput({
  value, onChange, placeholder, suggestions,
}: {
  value: string[]
  onChange: (v: string[]) => void
  placeholder: string
  suggestions?: string[]
}) {
  const [input, setInput]         = useState('')
  const [showSugg, setShowSugg]   = useState(false)
  const ref                       = useRef<HTMLDivElement>(null)

  const filtered = suggestions?.filter(
    s => s.toLowerCase().includes(input.toLowerCase()) && !value.includes(s)
  ).slice(0, 6) ?? []

  function add(tag: string) {
    const t = tag.trim()
    if (t && !value.includes(t)) onChange([...value, t])
    setInput('')
    setShowSugg(false)
  }

  function remove(tag: string) {
    onChange(value.filter(v => v !== tag))
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault()
      if (input.trim()) add(input)
    } else if (e.key === 'Backspace' && !input && value.length) {
      remove(value[value.length - 1])
    }
  }

  // Close suggestions on outside click
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setShowSugg(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <div style={{
        ...inputStyle, display: 'flex', flexWrap: 'wrap', gap: '4px',
        padding: '6px 10px', minHeight: '42px', alignItems: 'center',
      }}>
        {value.map(tag => (
          <span key={tag} style={{
            display: 'inline-flex', alignItems: 'center', gap: '4px',
            padding: '2px 8px', borderRadius: '99px', fontSize: '12px',
            background: 'var(--green)', color: 'var(--white)', fontWeight: 500,
          }}>
            {tag}
            <span onClick={() => remove(tag)} style={{ cursor: 'pointer', opacity: 0.8 }}>x</span>
          </span>
        ))}
        <input
          value={input}
          onChange={e => { setInput(e.target.value); setShowSugg(true) }}
          onFocus={() => setShowSugg(true)}
          onKeyDown={handleKeyDown}
          placeholder={value.length === 0 ? placeholder : ''}
          style={{
            border: 'none', outline: 'none', background: 'transparent',
            fontSize: '14px', fontFamily: 'var(--font-sans)', color: 'var(--green-deep)',
            flex: 1, minWidth: '80px',
          }}
        />
      </div>
      {showSugg && filtered.length > 0 && (
        <div style={{
          position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 10,
          background: 'var(--white)', border: '1px solid var(--cream-dark)',
          borderRadius: 'var(--radius-sm)', marginTop: '4px', maxHeight: '200px',
          overflowY: 'auto', boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
        }}>
          {filtered.map(s => (
            <div
              key={s}
              onClick={() => add(s)}
              style={{
                padding: '8px 12px', cursor: 'pointer', fontSize: '13px',
                color: 'var(--green-deep)',
              }}
              onMouseEnter={e => (e.currentTarget.style.background = 'var(--cream)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
            >
              {s}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default function AdminKnowledgePage() {
  const { session } = useAuth()
  const router      = useRouter()

  const [entries,        setEntries]        = useState<KnowledgeEntry[]>([])
  const [loading,        setLoading]        = useState(true)
  const [filterCategory, setFilterCategory] = useState<Category | ''>('')
  const [filterPlatform, setFilterPlatform] = useState<Platform | ''>('')
  const [search,         setSearch]         = useState('')
  const [showForm,       setShowForm]       = useState(false)
  const [form,           setForm]           = useState<FormState>({ ...EMPTY_FORM })
  const [saving,         setSaving]         = useState(false)
  const [saveMsg,        setSaveMsg]        = useState<{ ok: boolean; text: string } | null>(null)
  const [autoTagging,    setAutoTagging]    = useState(false)
  const [courseSugg,     setCourseSugg]     = useState<string[]>([])

  // ── Admin guard ────────────────────────────────────────────
  useEffect(() => {
    if (!session) return
    const adminEmail = process.env.NEXT_PUBLIC_ADMIN_EMAIL
    if (adminEmail && session.user.email !== adminEmail) {
      router.replace('/dashboard')
    }
  }, [session, router])

  // ── Load course names for autocomplete ─────────────────────
  useEffect(() => {
    supabase.from('courses').select('name').order('name')
      .then(({ data }) => {
        if (data) setCourseSugg(data.map(c => c.name))
      })
  }, [])

  // ── Load knowledge entries ─────────────────────────────────
  const loadEntries = useCallback(async () => {
    setLoading(true)
    const params = new URLSearchParams()
    if (filterCategory) params.set('category', filterCategory)
    if (filterPlatform) params.set('platform', filterPlatform)
    if (search.trim())  params.set('search', search.trim())

    try {
      const res  = await fetch(`/api/admin/knowledge?${params}`, {
        headers: { Authorization: `Bearer ${process.env.NEXT_PUBLIC_CRON_SECRET}` },
      })
      const json = await res.json()
      setEntries(json.data ?? [])
    } catch { /* ignore */ }
    setLoading(false)
  }, [filterCategory, filterPlatform, search])

  useEffect(() => { loadEntries() }, [loadEntries])

  // ── Form helpers ───────────────────────────────────────────
  const set = (field: keyof FormState, value: any) =>
    setForm(prev => ({ ...prev, [field]: value }))

  function openNew() {
    setForm({ ...EMPTY_FORM })
    setShowForm(true)
  }

  function openEdit(entry: KnowledgeEntry) {
    setForm({
      id:                entry.id,
      title:             entry.title,
      content:           entry.content,
      category:          entry.category,
      source_url:        entry.source_url ?? '',
      source_platform:   entry.source_platform ?? '',
      source_author:     entry.source_author ?? '',
      destinations:      entry.destinations ?? [],
      courses_mentioned: entry.courses_mentioned ?? [],
      tags:              entry.tags ?? [],
      is_active:         entry.is_active,
    })
    setShowForm(true)
  }

  // ── Auto-Tag ───────────────────────────────────────────────
  async function handleAutoTag() {
    if (!form.content.trim() && !form.source_url.trim()) return
    setAutoTagging(true)
    try {
      const res  = await fetch('/api/admin/knowledge/auto-tag', {
        method:  'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization:  `Bearer ${process.env.NEXT_PUBLIC_CRON_SECRET}`,
        },
        body: JSON.stringify({ content: form.content, url: form.source_url }),
      })
      const json = await res.json()
      if (json.data) {
        const d = json.data
        if (d.category)          set('category', d.category)
        if (d.destinations)      set('destinations', d.destinations)
        if (d.courses_mentioned) set('courses_mentioned', d.courses_mentioned)
        if (d.tags)              set('tags', d.tags)
        if (d.summary_title && !form.title) set('title', d.summary_title)
        if (d.summary_content && !form.content.trim()) set('content', d.summary_content)
      }
    } catch { /* ignore */ }
    setAutoTagging(false)
  }

  // ── Save ───────────────────────────────────────────────────
  async function handleSave() {
    if (!form.title.trim() || !form.content.trim()) {
      setSaveMsg({ ok: false, text: 'Title and content are required' })
      setTimeout(() => setSaveMsg(null), 3000)
      return
    }

    setSaving(true)
    setSaveMsg(null)

    const payload: any = {
      title:             form.title,
      content:           form.content,
      category:          form.category,
      source_url:        form.source_url || null,
      source_platform:   form.source_platform || null,
      source_author:     form.source_author || null,
      destinations:      form.destinations,
      courses_mentioned: form.courses_mentioned,
      tags:              form.tags,
      is_active:         form.is_active,
    }

    try {
      const isEdit = !!form.id
      const res    = await fetch('/api/admin/knowledge', {
        method:  isEdit ? 'PATCH' : 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization:  `Bearer ${process.env.NEXT_PUBLIC_CRON_SECRET}`,
        },
        body: JSON.stringify(isEdit ? { id: form.id, ...payload } : payload),
      })
      const json = await res.json()

      if (!res.ok) {
        setSaveMsg({ ok: false, text: json.error ?? 'Save failed' })
      } else {
        setSaveMsg({ ok: true, text: isEdit ? 'Updated!' : 'Saved!' })
        setShowForm(false)
        setForm({ ...EMPTY_FORM })
        loadEntries()
      }
    } catch (err: any) {
      setSaveMsg({ ok: false, text: err.message ?? 'Network error' })
    }
    setSaving(false)
    setTimeout(() => setSaveMsg(null), 3000)
  }

  // ── Delete ─────────────────────────────────────────────────
  async function handleDelete(id: string) {
    if (!confirm('Delete this knowledge entry?')) return
    await fetch(`/api/admin/knowledge?id=${id}`, {
      method:  'DELETE',
      headers: { Authorization: `Bearer ${process.env.NEXT_PUBLIC_CRON_SECRET}` },
    })
    loadEntries()
  }

  // ── Toggle Active ──────────────────────────────────────────
  async function handleToggleActive(entry: KnowledgeEntry) {
    await fetch('/api/admin/knowledge', {
      method:  'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization:  `Bearer ${process.env.NEXT_PUBLIC_CRON_SECRET}`,
      },
      body: JSON.stringify({ id: entry.id, is_active: !entry.is_active }),
    })
    loadEntries()
  }

  // ── Guard ──────────────────────────────────────────────────
  if (!session) return null

  // ── Render ─────────────────────────────────────────────────
  return (
    <div style={{
      maxWidth: '1000px', margin: '0 auto', padding: '40px 24px',
      fontFamily: 'var(--font-sans)', color: 'var(--green-deep)',
    }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px' }}>
        <div>
          <Link href="/admin/courses" style={{ fontSize: '12px', color: 'var(--text-light)', textDecoration: 'none' }}>
            &larr; Course Queue
          </Link>
          <h1 style={{ fontSize: '24px', fontWeight: 700, margin: '8px 0 4px' }}>
            Knowledge Base
          </h1>
          <p style={{ fontSize: '13px', color: 'var(--text-light)', margin: 0 }}>
            {entries.length} entr{entries.length === 1 ? 'y' : 'ies'}
          </p>
        </div>
        <button onClick={openNew} style={btnPrimary}>+ Add Entry</button>
      </div>

      {/* ── Quick Add / Edit Form ─────────────────────────────── */}
      {showForm && (
        <div style={sectionStyle}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <span style={sectionTitleStyle}>{form.id ? 'Edit Entry' : 'New Entry'}</span>
            <button onClick={() => { setShowForm(false); setForm({ ...EMPTY_FORM }) }} style={btnSmall}>Cancel</button>
          </div>

          {/* Source URL first — paste a link and auto-tag */}
          <div style={{ marginBottom: '16px' }}>
            <label style={labelStyle}>Source URL</label>
            <div style={{ display: 'flex', gap: '8px' }}>
              <input
                value={form.source_url}
                onChange={e => set('source_url', e.target.value)}
                placeholder="Paste a link — article, Instagram, YouTube, etc."
                style={{ ...inputStyle, flex: 1 }}
              />
              <button
                onClick={handleAutoTag}
                disabled={autoTagging || (!form.content.trim() && !form.source_url.trim())}
                style={{
                  ...btnPrimary,
                  opacity: (autoTagging || (!form.content.trim() && !form.source_url.trim())) ? 0.5 : 1,
                  padding: '10px 16px', fontSize: '12px', whiteSpace: 'nowrap',
                }}
              >
                {autoTagging ? 'Tagging...' : 'Auto-Tag with AI'}
              </button>
            </div>
          </div>

          {/* Content */}
          <div style={{ marginBottom: '16px' }}>
            <label style={labelStyle}>Content</label>
            <textarea
              rows={6}
              value={form.content}
              onChange={e => set('content', e.target.value)}
              placeholder="Paste or write the knowledge here — or just paste a URL above and hit Auto-Tag"
              style={textareaStyle}
            />
          </div>

          {/* Title */}
          <div style={{ marginBottom: '16px' }}>
            <label style={labelStyle}>Title</label>
            <input
              value={form.title}
              onChange={e => set('title', e.target.value)}
              placeholder="Short label — e.g., NLU's Bandon trip recap"
              style={inputStyle}
            />
          </div>

          {/* Row: Category + Platform + Author */}
          <div style={{ display: 'flex', gap: '16px', marginBottom: '16px' }}>
            <div style={{ flex: 1 }}>
              <label style={labelStyle}>Category</label>
              <select
                value={form.category}
                onChange={e => set('category', e.target.value)}
                style={inputStyle}
              >
                {CATEGORIES.map(c => (
                  <option key={c.value} value={c.value}>{c.label}</option>
                ))}
              </select>
            </div>
            <div style={{ flex: 1 }}>
              <label style={labelStyle}>Platform</label>
              <select
                value={form.source_platform}
                onChange={e => set('source_platform', e.target.value)}
                style={inputStyle}
              >
                <option value="">—</option>
                {PLATFORMS.map(p => (
                  <option key={p.value} value={p.value}>{p.label}</option>
                ))}
              </select>
            </div>
            <div style={{ flex: 1 }}>
              <label style={labelStyle}>Source Author</label>
              <input
                value={form.source_author}
                onChange={e => set('source_author', e.target.value)}
                placeholder="e.g., No Laying Up"
                style={inputStyle}
              />
            </div>
          </div>

          {/* Destinations */}
          <div style={{ marginBottom: '16px' }}>
            <label style={labelStyle}>Destinations</label>
            <TagInput
              value={form.destinations}
              onChange={v => set('destinations', v)}
              placeholder="Type destination name and press Enter"
              suggestions={courseSugg}
            />
          </div>

          {/* Courses Mentioned */}
          <div style={{ marginBottom: '16px' }}>
            <label style={labelStyle}>Courses Mentioned</label>
            <TagInput
              value={form.courses_mentioned}
              onChange={v => set('courses_mentioned', v)}
              placeholder="Type course name and press Enter"
              suggestions={courseSugg}
            />
          </div>

          {/* Tags */}
          <div style={{ marginBottom: '16px' }}>
            <label style={labelStyle}>Tags</label>
            <TagInput
              value={form.tags}
              onChange={v => set('tags', v)}
              placeholder="e.g., buddies trip, budget, bucket list"
            />
          </div>

          {/* Active toggle */}
          <div style={{ marginBottom: '20px' }}>
            <label style={{ ...labelStyle, display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={form.is_active}
                onChange={e => set('is_active', e.target.checked)}
              />
              Active (visible to concierge)
            </label>
          </div>

          {/* Save */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <button onClick={handleSave} disabled={saving} style={{ ...btnPrimary, opacity: saving ? 0.5 : 1 }}>
              {saving ? 'Saving...' : (form.id ? 'Update' : 'Save')}
            </button>
            {saveMsg && (
              <span style={{ fontSize: '13px', color: saveMsg.ok ? 'var(--green)' : '#d97070', fontWeight: 500 }}>
                {saveMsg.text}
              </span>
            )}
          </div>
        </div>
      )}

      {/* ── Filters ───────────────────────────────────────────── */}
      <div style={{ ...sectionStyle, padding: '16px 20px' }}>
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
          <select
            value={filterCategory}
            onChange={e => setFilterCategory(e.target.value as Category | '')}
            style={{ ...inputStyle, width: 'auto', minWidth: '160px' }}
          >
            <option value="">All Categories</option>
            {CATEGORIES.map(c => (
              <option key={c.value} value={c.value}>{c.label}</option>
            ))}
          </select>
          <select
            value={filterPlatform}
            onChange={e => setFilterPlatform(e.target.value as Platform | '')}
            style={{ ...inputStyle, width: 'auto', minWidth: '140px' }}
          >
            <option value="">All Platforms</option>
            {PLATFORMS.map(p => (
              <option key={p.value} value={p.value}>{p.label}</option>
            ))}
          </select>
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search content..."
            style={{ ...inputStyle, width: 'auto', flex: 1, minWidth: '200px' }}
          />
        </div>
      </div>

      {/* ── Entry List ────────────────────────────────────────── */}
      {loading ? (
        <p style={{ textAlign: 'center', color: 'var(--text-light)', padding: '40px' }}>Loading...</p>
      ) : entries.length === 0 ? (
        <div style={{ ...sectionStyle, textAlign: 'center', padding: '60px 24px' }}>
          <p style={{ fontSize: '15px', color: 'var(--text-light)', margin: 0 }}>
            No knowledge entries yet. Click &ldquo;+ Add Entry&rdquo; to start building the knowledge base.
          </p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {entries.map(entry => (
            <div key={entry.id} style={{
              ...sectionStyle, marginBottom: 0, padding: '16px 20px',
              opacity: entry.is_active ? 1 : 0.55,
            }}>
              {/* Top row: title + badges */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                    <span style={{ fontSize: '15px', fontWeight: 600 }}>{entry.title}</span>
                    <CategoryBadge category={entry.category} />
                    <PlatformIcon platform={entry.source_platform} />
                    {!entry.is_active && (
                      <span style={{ fontSize: '11px', color: '#d97070', fontWeight: 600 }}>INACTIVE</span>
                    )}
                  </div>
                  {entry.source_author && (
                    <span style={{ fontSize: '12px', color: 'var(--text-light)' }}>
                      by {entry.source_author}
                    </span>
                  )}
                </div>
                <span style={{ fontSize: '11px', color: 'var(--text-light)', whiteSpace: 'nowrap' }}>
                  {fmt(entry.created_at)}
                </span>
              </div>

              {/* Content preview */}
              <p style={{
                fontSize: '13px', color: 'var(--green-deep)', lineHeight: 1.5,
                margin: '0 0 10px', whiteSpace: 'pre-wrap',
                maxHeight: '80px', overflow: 'hidden',
              }}>
                {entry.content}
              </p>

              {/* Tags row */}
              {(entry.destinations.length > 0 || entry.courses_mentioned.length > 0 || entry.tags.length > 0) && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginBottom: '10px' }}>
                  {entry.destinations.map(d => (
                    <span key={d} style={{
                      padding: '2px 8px', borderRadius: '99px', fontSize: '11px',
                      background: 'rgba(45,90,60,0.12)', color: 'var(--green)',
                    }}>
                      {d}
                    </span>
                  ))}
                  {entry.courses_mentioned.map(c => (
                    <span key={c} style={{
                      padding: '2px 8px', borderRadius: '99px', fontSize: '11px',
                      background: 'rgba(196,168,79,0.12)', color: 'var(--gold)',
                    }}>
                      {c}
                    </span>
                  ))}
                  {entry.tags.map(t => (
                    <span key={t} style={{
                      padding: '2px 8px', borderRadius: '99px', fontSize: '11px',
                      background: 'rgba(139,120,90,0.08)', color: 'var(--sand)',
                    }}>
                      {t}
                    </span>
                  ))}
                </div>
              )}

              {/* Actions */}
              <div style={{ display: 'flex', gap: '8px' }}>
                <button onClick={() => openEdit(entry)} style={btnSmall}>Edit</button>
                <button onClick={() => handleToggleActive(entry)} style={btnSmall}>
                  {entry.is_active ? 'Deactivate' : 'Activate'}
                </button>
                {entry.source_url && (
                  <a href={entry.source_url} target="_blank" rel="noopener noreferrer" style={{
                    ...btnSmall, textDecoration: 'none', display: 'inline-flex', alignItems: 'center',
                  }}>
                    Source
                  </a>
                )}
                <button onClick={() => handleDelete(entry.id)} style={btnDanger}>Delete</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
