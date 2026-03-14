'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { useRouter }                         from 'next/navigation'
import { supabase }                          from '@/lib/supabase'
import { useAuth }                           from '@/context/AuthContext'

// ── Types ─────────────────────────────────────────────────────

type QueueStatus = 'pending' | 'processing' | 'complete' | 'failed' | 'private'

type QueueRecord = {
  id           : string
  name         : string
  location     : string
  country      : string | null
  status       : QueueStatus
  notes        : string | null
  created_at   : string
  processed_at : string | null
  priority     : boolean
}

type Stats = Record<QueueStatus | 'total', number>

type RunResult = {
  status?  : string
  message? : string
  course?  : string
  location?: string
  slug?    : string
  reason?  : string
  error?   : string
}

type FilterTab = 'all' | QueueStatus

// ── Status display ────────────────────────────────────────────

const STATUS_CONFIG: Record<QueueStatus, { label: string; bg: string; color: string }> = {
  pending    : { label: 'Pending',    bg: 'rgba(139,120,90,0.12)',  color: 'var(--sand)'       },
  processing : { label: 'Processing', bg: 'rgba(45,90,60,0.15)',   color: 'var(--green-light)' },
  complete   : { label: 'Complete',   bg: 'rgba(196,168,79,0.15)', color: 'var(--gold)'        },
  failed     : { label: 'Failed',     bg: 'rgba(180,50,50,0.12)',  color: '#d97070'            },
  private    : { label: 'Private',    bg: 'rgba(80,80,100,0.12)',  color: '#9b9bc0'            },
}

// ── Helpers ───────────────────────────────────────────────────

function fmt(iso: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('en-US', {
    month : 'short', day: 'numeric',
    hour  : 'numeric', minute: '2-digit',
  })
}

function StatusBadge({ status }: { status: QueueStatus }) {
  const cfg = STATUS_CONFIG[status]
  return (
    <span
      style={{
        display      : 'inline-block',
        padding      : '2px 8px',
        borderRadius : '99px',
        fontSize     : '11px',
        fontWeight   : 600,
        letterSpacing: '0.04em',
        background   : cfg.bg,
        color        : cfg.color,
      }}
    >
      {cfg.label}
    </span>
  )
}

// ── Page ─────────────────────────────────────────────────────

export default function AdminCoursesPage() {
  const { session } = useAuth()
  const router      = useRouter()

  const [records,       setRecords]       = useState<QueueRecord[]>([])
  const [stats,         setStats]         = useState<Stats>({ pending: 0, processing: 0, complete: 0, failed: 0, private: 0, total: 0 })
  const [filter,        setFilter]        = useState<FilterTab>('all')
  const [loading,       setLoading]       = useState(true)
  const [running,       setRunning]       = useState(false)
  const [multiProgress, setMultiProgress] = useState<{ current: number; total: number } | null>(null)
  const [lastResult,    setLastResult]    = useState<RunResult | null>(null)
  const stopRequested                     = useRef(false)
  const [reenriching,   setReenriching]   = useState<Set<string>>(new Set())
  const [resetLoading,  setResetLoading]  = useState(false)
  const [stuckLoading,  setStuckLoading]  = useState(false)
  const [deepResearch,  setDeepResearch]  = useState(false)

  // Initialize deep research toggle from localStorage
  useEffect(() => {
    try {
      const stored = localStorage.getItem('greenlit-deep-research')
      if (stored === 'true') setDeepResearch(true)
    } catch { /* SSR or localStorage unavailable */ }
  }, [])

  function toggleDeepResearch() {
    const next = !deepResearch
    setDeepResearch(next)
    try { localStorage.setItem('greenlit-deep-research', String(next)) } catch {}
  }

  // ── Guard: only admin ───────────────────────────────────────
  useEffect(() => {
    if (!session) return
    const adminEmail = process.env.NEXT_PUBLIC_ADMIN_EMAIL
    if (adminEmail && session.user.email !== adminEmail) {
      router.replace('/dashboard')
    }
  }, [session, router])

  // ── Load queue data ─────────────────────────────────────────
  const loadData = useCallback(async () => {
    setLoading(true)

    let query = supabase
      .from('course_queue')
      .select('id, name, location, country, status, notes, created_at, processed_at, priority')

    if (filter !== 'all') {
      query = query.eq('status', filter)
    }

    // Pending sorts by priority first, then created_at
    if (filter === 'pending') {
      query = query
        .order('priority', { ascending: false })
        .order('created_at', { ascending: true })
    } else {
      query = query.order('processed_at', { ascending: false, nullsFirst: false })
    }

    query = query.limit(50)

    const [{ data: rows }, { data: allRows }] = await Promise.all([
      query,
      supabase.from('course_queue').select('status'),
    ])

    setRecords((rows ?? []) as QueueRecord[])

    // Compute stats
    const counts = { pending: 0, processing: 0, complete: 0, failed: 0, private: 0, total: 0 }
    for (const row of allRows ?? []) {
      const s = row.status as QueueStatus
      counts[s] = (counts[s] ?? 0) + 1
      counts.total++
    }
    setStats(counts)
    setLoading(false)
  }, [filter])

  useEffect(() => { loadData() }, [loadData])

  // ── Reset helpers ────────────────────────────────────────────
  async function resetQueue(body: object): Promise<number> {
    const res = await fetch('/api/admin/reset-queue', {
      method : 'POST',
      headers: {
        'Content-Type' : 'application/json',
        Authorization  : `Bearer ${process.env.NEXT_PUBLIC_CRON_SECRET}`,
      },
      body: JSON.stringify(body),
    })
    const data = await res.json()
    return data.reset ?? 0
  }

  async function handleReenrich(record: QueueRecord) {
    setReenriching((prev) => new Set(prev).add(record.id))
    await resetQueue({ ids: [record.id] })
    await loadData()
    setReenriching((prev) => { const s = new Set(prev); s.delete(record.id); return s })
  }

  async function handleResetMissingPhotos() {
    setResetLoading(true)
    const count = await resetQueue({ missingPhotos: true })
    setLastResult({ status: 'info', message: `Reset ${count} course${count === 1 ? '' : 's'} with missing photos → pending` } as RunResult)
    await loadData()
    setResetLoading(false)
  }

  async function handleResetStuck() {
    setStuckLoading(true)
    const count = await resetQueue({ resetProcessing: true })
    setLastResult({ status: 'info', message: `Reset ${count} stuck course${count !== 1 ? 's' : ''} → pending` } as RunResult)
    await loadData()
    setStuckLoading(false)
  }

  // ── Priority toggle ──────────────────────────────────────────
  async function handleTogglePriority(record: QueueRecord) {
    const newPriority = !record.priority
    // Optimistic update
    setRecords((prev) => prev.map((r) => r.id === record.id ? { ...r, priority: newPriority } : r))

    await fetch('/api/admin/reset-queue', {
      method : 'POST',
      headers: {
        'Content-Type' : 'application/json',
        Authorization  : `Bearer ${process.env.NEXT_PUBLIC_CRON_SECRET}`,
      },
      body: JSON.stringify({ setPriority: { id: record.id, priority: newPriority } }),
    })
  }

  // ── Run one enrichment ──────────────────────────────────────
  async function runOne(): Promise<RunResult | null> {
    const res = await fetch('/api/cron/enrich-courses', {
      method : 'POST',
      headers: {
        'Content-Type' : 'application/json',
        Authorization  : `Bearer ${process.env.NEXT_PUBLIC_CRON_SECRET}`,
      },
      body: JSON.stringify({ mode: deepResearch ? 'deep' : 'standard' }),
    })
    return res.json()
  }

  async function handleRunOne() {
    setRunning(true)
    setLastResult(null)
    const result = await runOne()
    setLastResult(result)
    setRunning(false)
    await loadData()
  }

  async function handleRun10() {
    stopRequested.current = false
    setMultiProgress({ current: 0, total: 10 })
    setLastResult(null)
    let lastRes: RunResult | null = null

    for (let i = 0; i < 10; i++) {
      // Check stop flag before each call
      if (stopRequested.current) {
        lastRes = { status: 'info', message: `Stopped after ${i} of 10` } as RunResult
        break
      }

      setMultiProgress({ current: i + 1, total: 10 })

      try {
        lastRes = await runOne()
      } catch (err) {
        console.error(`Run ${i + 1} failed:`, err)
        // Continue to next rather than stopping entirely
        continue
      }

      if (lastRes?.message === 'Queue empty') break
      if (lastRes?.status === 'rate_limited') break

      // Small delay between calls to avoid hammering the API
      if (i < 9) {
        await new Promise((r) => setTimeout(r, 500))
      }
    }

    setLastResult(lastRes)
    setMultiProgress(null)
    stopRequested.current = false
    await loadData()
  }

  function handleStopBatch() {
    stopRequested.current = true
  }

  // ── Render ──────────────────────────────────────────────────
  if (!session) return null

  const TABS: FilterTab[] = ['all', 'pending', 'complete', 'failed', 'private', 'processing']

  return (
    <div style={{ minHeight: '100vh', background: 'var(--cream)', fontFamily: 'var(--font-sans)' }}>

      {/* Top bar */}
      <header style={{
        background      : 'var(--green-deep)',
        padding         : '0 48px',
        height          : '64px',
        display         : 'flex',
        alignItems      : 'center',
        justifyContent  : 'space-between',
        position        : 'sticky',
        top             : 0,
        zIndex          : 20,
      }}>
        <div style={{ fontFamily: 'var(--font-serif)', fontSize: '20px', color: 'var(--gold-light)', letterSpacing: '0.02em' }}>
          Greenlit
        </div>
        <span style={{ fontSize: '11px', color: 'rgba(245,240,232,0.4)', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
          Admin
        </span>
      </header>

      {/* Page header */}
      <div style={{ padding: '40px 48px 28px', borderBottom: '1px solid var(--cream-dark)', background: 'var(--white)' }}>
        <div style={{ fontSize: '10px', letterSpacing: '0.25em', textTransform: 'uppercase', color: 'var(--green-light)', fontWeight: 600, marginBottom: '6px' }}>
          Course Enrichment
        </div>
        <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: '28px', color: 'var(--green-deep)', fontWeight: 600, margin: 0 }}>
          Course Queue
        </h1>
        <p style={{ fontSize: '13px', color: 'var(--text-light)', marginTop: '4px', fontWeight: 300 }}>
          {stats.total.toLocaleString()} courses in queue
        </p>
      </div>

      <div style={{ padding: '32px 48px', maxWidth: '1200px' }}>

        {/* Stats row */}
        <div style={{ display: 'flex', gap: '12px', marginBottom: '32px', flexWrap: 'wrap' }}>
          {(['pending', 'processing', 'complete', 'failed', 'private'] as QueueStatus[]).map((s) => {
            const cfg = STATUS_CONFIG[s]
            return (
              <div key={s} style={{
                background   : 'var(--white)',
                border       : '1px solid var(--cream-dark)',
                borderRadius : 'var(--radius-md)',
                padding      : '16px 24px',
                minWidth     : '110px',
              }}>
                <div style={{ fontSize: '24px', fontWeight: 700, color: cfg.color, fontVariantNumeric: 'tabular-nums' }}>
                  {stats[s].toLocaleString()}
                </div>
                <div style={{ fontSize: '11px', letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-light)', marginTop: '2px', fontWeight: 600 }}>
                  {cfg.label}
                </div>
              </div>
            )
          })}
        </div>

        {/* Run buttons */}
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap' }}>
          <button
            onClick={handleRunOne}
            disabled={running || !!multiProgress}
            style={{
              padding      : '10px 20px',
              borderRadius : 'var(--radius-sm)',
              background   : running ? 'var(--green-muted)' : 'var(--green-deep)',
              color        : 'var(--gold-light)',
              border       : 'none',
              fontSize     : '13px',
              fontWeight   : 600,
              cursor       : running ? 'not-allowed' : 'pointer',
              letterSpacing: '0.05em',
              fontFamily   : 'var(--font-sans)',
              transition   : 'background 0.2s',
            }}
          >
            {running ? '⏳ Running…' : '▶ Run Next Enrichment'}
          </button>

          {multiProgress ? (
            <button
              onClick={handleStopBatch}
              style={{
                padding      : '10px 20px',
                borderRadius : 'var(--radius-sm)',
                background   : '#d97070',
                color        : '#fff',
                border       : 'none',
                fontSize     : '13px',
                fontWeight   : 600,
                cursor       : 'pointer',
                letterSpacing: '0.05em',
                fontFamily   : 'var(--font-sans)',
                transition   : 'background 0.2s',
              }}
            >
              ■ Stop ({multiProgress.current}/{multiProgress.total})
            </button>
          ) : (
            <button
              onClick={handleRun10}
              disabled={running}
              style={{
                padding      : '10px 20px',
                borderRadius : 'var(--radius-sm)',
                background   : 'var(--gold)',
                color        : 'var(--green-deep)',
                border       : 'none',
                fontSize     : '13px',
                fontWeight   : 600,
                cursor       : running ? 'not-allowed' : 'pointer',
                letterSpacing: '0.05em',
                fontFamily   : 'var(--font-sans)',
                transition   : 'background 0.2s',
              }}
            >
              ⚡ Run 10 Now
            </button>
          )}

          <button
            onClick={handleResetMissingPhotos}
            disabled={running || !!multiProgress || resetLoading}
            style={{
              padding      : '10px 20px',
              borderRadius : 'var(--radius-sm)',
              background   : 'transparent',
              color        : resetLoading ? 'var(--text-light)' : 'var(--green-deep)',
              border       : '1px solid var(--green-deep)',
              fontSize     : '13px',
              fontWeight   : 600,
              cursor       : (running || !!multiProgress || resetLoading) ? 'not-allowed' : 'pointer',
              letterSpacing: '0.04em',
              fontFamily   : 'var(--font-sans)',
              opacity      : (running || !!multiProgress) ? 0.5 : 1,
            }}
          >
            {resetLoading ? '⏳ Resetting…' : '🖼 Reset Missing Photos'}
          </button>

          <button
            onClick={handleResetStuck}
            disabled={running || !!multiProgress || stuckLoading}
            style={{
              padding      : '10px 20px',
              borderRadius : 'var(--radius-sm)',
              background   : 'transparent',
              color        : stuckLoading ? 'var(--text-light)' : '#d97070',
              border       : '1px solid #d97070',
              fontSize     : '13px',
              fontWeight   : 600,
              cursor       : (running || !!multiProgress || stuckLoading) ? 'not-allowed' : 'pointer',
              letterSpacing: '0.04em',
              fontFamily   : 'var(--font-sans)',
              opacity      : (running || !!multiProgress) ? 0.5 : 1,
            }}
          >
            {stuckLoading ? '⏳ Resetting…' : '🔄 Reset Stuck'}
          </button>

          <button
            onClick={loadData}
            disabled={loading}
            style={{
              padding      : '10px 16px',
              borderRadius : 'var(--radius-sm)',
              background   : 'transparent',
              color        : 'var(--text-light)',
              border       : '1px solid var(--cream-dark)',
              fontSize     : '12px',
              cursor       : loading ? 'not-allowed' : 'pointer',
              fontFamily   : 'var(--font-sans)',
            }}
          >
            ↺ Refresh
          </button>
        </div>

        {/* Deep Research toggle */}
        <div style={{
          display      : 'flex',
          alignItems   : 'center',
          gap          : '12px',
          marginBottom : '20px',
          padding      : '12px 16px',
          background   : deepResearch ? 'rgba(45,90,60,0.06)' : 'rgba(139,120,90,0.06)',
          borderRadius : 'var(--radius-sm)',
          border       : `1px solid ${deepResearch ? 'rgba(45,90,60,0.15)' : 'var(--cream-dark)'}`,
          transition   : 'all 0.2s',
        }}>
          <button
            onClick={toggleDeepResearch}
            style={{
              width        : '40px',
              height       : '22px',
              borderRadius : '11px',
              border       : 'none',
              cursor       : 'pointer',
              background   : deepResearch ? 'var(--green-deep)' : 'var(--cream-dark)',
              position     : 'relative',
              transition   : 'background 0.2s',
              flexShrink   : 0,
            }}
          >
            <span style={{
              position     : 'absolute',
              top           : '2px',
              left          : deepResearch ? '20px' : '2px',
              width         : '18px',
              height        : '18px',
              borderRadius  : '50%',
              background    : deepResearch ? 'var(--gold-light)' : 'var(--white)',
              transition    : 'left 0.2s',
              boxShadow     : '0 1px 3px rgba(0,0,0,0.2)',
            }} />
          </button>
          <div>
            <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--green-deep)' }}>
              Deep Research {deepResearch ? 'ON' : 'OFF'}
            </div>
            <div style={{ fontSize: '11px', color: 'var(--text-light)', fontWeight: 300, marginTop: '1px' }}>
              {deepResearch
                ? 'Two-phase: source discovery → fetch URLs → deep synthesis (~40-60s per course)'
                : 'Single-pass web search (~15-25s per course)'}
            </div>
          </div>
        </div>

        {/* Batch progress */}
        {multiProgress && (
          <div style={{
            background   : 'rgba(45,90,60,0.08)',
            border       : '1px solid rgba(45,90,60,0.15)',
            borderRadius : 'var(--radius-sm)',
            padding      : '14px 16px',
            fontSize     : '13px',
            marginBottom : '16px',
            display      : 'flex',
            alignItems   : 'center',
            gap          : '12px',
          }}>
            <span style={{
              display    : 'inline-block',
              width      : '14px',
              height     : '14px',
              border     : '2px solid var(--green-deep)',
              borderTopColor: 'transparent',
              borderRadius: '50%',
              animation  : 'spin 0.8s linear infinite',
            }} />
            <span style={{ color: 'var(--green-deep)', fontWeight: 600 }}>
              Processing {multiProgress.current} of {multiProgress.total}…
            </span>
            <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
          </div>
        )}

        {/* Last result inline */}
        {lastResult && (
          <div style={{
            background   : lastResult.status === 'complete' ? 'rgba(196,168,79,0.08)'
                         : lastResult.status === 'failed'   ? 'rgba(180,50,50,0.08)'
                         : lastResult.status === 'private'  ? 'rgba(80,80,100,0.08)'
                         : 'rgba(45,90,60,0.08)',
            border       : `1px solid ${
              lastResult.status === 'complete' ? 'rgba(196,168,79,0.3)'
            : lastResult.status === 'failed'   ? 'rgba(180,50,50,0.25)'
            : 'var(--cream-dark)'
            }`,
            borderRadius : 'var(--radius-sm)',
            padding      : '12px 16px',
            fontSize     : '13px',
            marginBottom : '24px',
          }}>
            <strong style={{ color: 'var(--green-deep)' }}>
              {lastResult.status === 'complete'     ? '✓ Enriched'
               : lastResult.status === 'private'    ? '🔒 Private club'
               : lastResult.status === 'failed'     ? '✗ Failed'
               : lastResult.message === 'Queue empty' ? '✓ Queue empty'
               : '→ Result'}
            </strong>
            {' '}
            <span style={{ color: 'var(--text-body)' }}>
              {lastResult.course ?? ''}
              {lastResult.location ? ` — ${lastResult.location}` : ''}
              {lastResult.reason  ? `: ${lastResult.reason}`  : ''}
              {lastResult.error   ? `: ${lastResult.error}`   : ''}
            </span>
          </div>
        )}

        {/* Filter tabs */}
        <div style={{ display: 'flex', gap: '4px', marginBottom: '16px', borderBottom: '1px solid var(--cream-dark)', paddingBottom: '0' }}>
          {TABS.map((tab) => (
            <button
              key={tab}
              onClick={() => setFilter(tab)}
              style={{
                padding         : '8px 14px',
                background      : 'transparent',
                border          : 'none',
                borderBottom    : filter === tab ? '2px solid var(--gold)' : '2px solid transparent',
                fontSize        : '12px',
                fontWeight      : filter === tab ? 600 : 400,
                color           : filter === tab ? 'var(--green-deep)' : 'var(--text-light)',
                cursor          : 'pointer',
                letterSpacing   : '0.04em',
                textTransform   : 'capitalize',
                fontFamily      : 'var(--font-sans)',
                transition      : 'color 0.15s',
                marginBottom    : '-1px',
              }}
            >
              {tab === 'all' ? `All (${stats.total})` : `${STATUS_CONFIG[tab as QueueStatus].label} (${stats[tab as QueueStatus]})`}
            </button>
          ))}
        </div>

        {/* Table */}
        <div style={{
          background   : 'var(--white)',
          border       : '1px solid var(--cream-dark)',
          borderRadius : 'var(--radius-lg)',
          overflow     : 'hidden',
        }}>
          {loading ? (
            <div style={{ padding: '48px', textAlign: 'center', fontSize: '13px', color: 'var(--text-light)' }}>
              Loading…
            </div>
          ) : records.length === 0 ? (
            <div style={{ padding: '48px', textAlign: 'center', fontSize: '13px', color: 'var(--text-light)' }}>
              No records for this filter.
            </div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: 'var(--cream)', borderBottom: '1px solid var(--cream-dark)' }}>
                  {['', 'Course', 'Location', 'Country', 'Status', 'Processed', 'Notes', ''].map((h, i) => (
                    <th
                      key={`${h}-${i}`}
                      style={{
                        padding      : h === '' && i === 0 ? '10px 8px 10px 16px' : '10px 16px',
                        textAlign    : 'left',
                        fontSize     : '10px',
                        letterSpacing: '0.1em',
                        textTransform: 'uppercase',
                        color        : 'var(--text-light)',
                        fontWeight   : 600,
                        width        : h === '' && i === 0 ? '32px' : undefined,
                      }}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {records.map((r, i) => (
                  <tr
                    key={r.id}
                    style={{
                      borderBottom: i < records.length - 1 ? '1px solid var(--cream-dark)' : 'none',
                      background  : 'var(--white)',
                    }}
                  >
                    {/* Priority star */}
                    <td style={{ padding: '10px 8px 10px 16px', width: '32px' }}>
                      {r.status === 'pending' ? (
                        <button
                          onClick={() => handleTogglePriority(r)}
                          title={r.priority ? 'Remove priority' : 'Mark as priority'}
                          style={{
                            background : 'none',
                            border     : 'none',
                            cursor     : 'pointer',
                            fontSize   : '16px',
                            padding    : 0,
                            lineHeight : 1,
                            opacity    : r.priority ? 1 : 0.25,
                            transition : 'opacity 0.15s',
                          }}
                        >
                          ⭐
                        </button>
                      ) : (
                        <span style={{ display: 'inline-block', width: '16px' }} />
                      )}
                    </td>
                    <td style={{ padding: '10px 16px', fontSize: '13px', color: 'var(--green-deep)', fontWeight: 500, maxWidth: '200px' }}>
                      {r.name}
                    </td>
                    <td style={{ padding: '10px 16px', fontSize: '12px', color: 'var(--text-body)' }}>
                      {r.location}
                    </td>
                    <td style={{ padding: '10px 16px', fontSize: '12px', color: 'var(--text-light)' }}>
                      {r.country ?? '—'}
                    </td>
                    <td style={{ padding: '10px 16px' }}>
                      <StatusBadge status={r.status} />
                    </td>
                    <td style={{ padding: '10px 16px', fontSize: '11px', color: 'var(--text-light)', whiteSpace: 'nowrap' }}>
                      {fmt(r.processed_at)}
                    </td>
                    <td style={{ padding: '10px 16px', fontSize: '11px', color: 'var(--text-light)', maxWidth: '220px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {r.notes ? r.notes.slice(0, 80) + (r.notes.length > 80 ? '…' : '') : '—'}
                    </td>
                    <td style={{ padding: '10px 12px', whiteSpace: 'nowrap' }}>
                      <button
                        onClick={() => handleReenrich(r)}
                        disabled={reenriching.has(r.id) || !!multiProgress}
                        title="Reset to pending so it will be re-enriched"
                        style={{
                          padding      : '4px 10px',
                          borderRadius : 'var(--radius-sm)',
                          background   : 'transparent',
                          color        : reenriching.has(r.id) ? 'var(--text-light)' : 'var(--green-deep)',
                          border       : '1px solid currentColor',
                          fontSize     : '11px',
                          fontWeight   : 600,
                          cursor       : (reenriching.has(r.id) || !!multiProgress) ? 'not-allowed' : 'pointer',
                          opacity      : !!multiProgress ? 0.4 : 1,
                          fontFamily   : 'var(--font-sans)',
                          letterSpacing: '0.03em',
                        }}
                      >
                        {reenriching.has(r.id) ? '…' : '↺ Re-enrich'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Note about Vercel plan */}
        <p style={{ marginTop: '24px', fontSize: '12px', color: 'var(--text-light)', fontWeight: 300 }}>
          Note: Vercel Hobby cron runs once daily. The 5-minute schedule activates on the Pro plan.
          Use the buttons above to trigger enrichment manually in the meantime.
        </p>

      </div>
    </div>
  )
}
