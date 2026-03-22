'use client'

import React, { useState, useCallback, useEffect } from 'react'

// ─── Types ──────────────────────────────────────────────────────────────────────

type Member = {
  id:             number | string
  user_id:        string | null
  display_name:   string | null
  email:          string | null
  handicap:       number | null
  trip_handicap?: number | null
  role:           string
}

type TeeTime = {
  id:          string
  course_name: string
  tee_date:    string
}

type CupMatch = {
  id:                string
  session_id:        string
  team_a_player1_id: string | null
  team_a_player2_id: string | null
  team_b_player1_id: string | null
  team_b_player2_id: string | null
  result:            string | null
  score_display:     string | null
  team_a_points:     number
  team_b_points:     number
  match_order:       number
}

type CupSession = {
  id:            string
  cup_id:        string
  tee_time_id:   string | null
  format:        string
  session_order: number
  status:        string
  matches:       CupMatch[]
}

type CupTeam = {
  id:         string
  cup_id:     string
  member_id:  string
  team:       'a' | 'b'
  is_captain: boolean
}

type Cup = {
  id:           string
  trip_id:      string
  name:         string
  team_a_name:  string
  team_b_name:  string
  team_a_color: string
  team_b_color: string
  status:       string
  teams:        CupTeam[]
  sessions:     CupSession[]
}

type TheCupProps = {
  tripId:      string
  tripName:    string
  members:     Member[]
  teeTimes:    TeeTime[]
  isOrganizer: boolean
}

// ─── Constants ──────────────────────────────────────────────────────────────────

const PRESET_COLORS = [
  { value: '#1a2e1a', label: 'Forest' },
  { value: '#c4a84f', label: 'Gold' },
  { value: '#1e3a5f', label: 'Navy' },
  { value: '#722f37', label: 'Burgundy' },
  { value: '#f5f0e8', label: 'Cream' },
  { value: '#36454f', label: 'Charcoal' },
  { value: '#4a90d9', label: 'Sky' },
  { value: '#e07a5f', label: 'Coral' },
]

const FORMAT_OPTIONS: { value: string; label: string; desc: string }[] = [
  { value: 'four_ball',  label: 'Four-Ball (Best Ball)', desc: 'Both play their own ball; best score counts' },
  { value: 'foursomes',  label: 'Foursomes (Alt Shot)',  desc: 'Partners alternate shots on one ball' },
  { value: 'singles',    label: 'Singles Match Play',     desc: '1v1 head-to-head matches' },
  { value: 'scramble',   label: 'Scramble',               desc: 'Team scramble format' },
]

const CARD: React.CSSProperties = {
  background: '#fff', borderRadius: 12, border: '1px solid #e5e7eb', overflow: 'hidden',
}

const BTN_GOLD: React.CSSProperties = {
  background: 'var(--gold)', color: '#fff', border: 'none', borderRadius: 8,
  padding: '10px 20px', fontWeight: 600, fontSize: '13px', cursor: 'pointer',
  fontFamily: 'var(--font-sans)', letterSpacing: '0.02em',
}

const BTN_OUTLINE: React.CSSProperties = {
  background: 'transparent', color: 'var(--gold)', border: '1.5px solid var(--gold)',
  borderRadius: 8, padding: '9px 18px', fontWeight: 600, fontSize: '13px',
  cursor: 'pointer', fontFamily: 'var(--font-sans)',
}

const INPUT: React.CSSProperties = {
  width: '100%', padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: 8,
  fontSize: '13px', fontFamily: 'var(--font-sans)', outline: 'none',
}

// ─── Helpers ────────────────────────────────────────────────────────────────────

function memberName(m: Member): string {
  if (m.display_name) return m.display_name
  if (m.email) return m.email.split('@')[0]
  return 'Member'
}

function memberLastName(m: Member): string {
  const name = memberName(m)
  const parts = name.split(' ')
  return parts.length > 1 ? parts[parts.length - 1] : name
}

function getHandicap(m: Member): number {
  return m.trip_handicap ?? m.handicap ?? 18
}

function formatDate(d: string) {
  return new Date(d + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function formatLabel(f: string) {
  return FORMAT_OPTIONS.find(o => o.value === f)?.label ?? f
}

function mid(m: { id: number | string }): string {
  return String(m.id)
}

function contrastText(hex: string): string {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  return (r * 299 + g * 587 + b * 114) / 1000 > 140 ? '#1a1a1a' : '#ffffff'
}

// ─── Main Component ─────────────────────────────────────────────────────────────

export default function TheCup({ tripId, tripName, members, teeTimes, isOrganizer }: TheCupProps) {
  const [cup, setCup]         = useState<Cup | null>(null)
  const [loading, setLoading] = useState(true)
  const [setupStep, setSetupStep] = useState(0) // 0 = not in setup

  // Setup state
  const [cupName, setCupName]         = useState(`${tripName} Cup`)
  const [teamAName, setTeamAName]     = useState('Team A')
  const [teamBName, setTeamBName]     = useState('Team B')
  const [teamAColor, setTeamAColor]   = useState('#1a2e1a')
  const [teamBColor, setTeamBColor]   = useState('#c4a84f')
  const [assignments, setAssignments] = useState<Record<string, 'a' | 'b' | null>>({})
  const [captains, setCaptains]       = useState<Record<string, boolean>>({})
  const [sessionFormats, setSessionFormats] = useState<Record<string, string>>({})
  const [sessionPairings, setSessionPairings] = useState<Record<string, Array<{
    team_a_player1_id: string; team_a_player2_id: string | null
    team_b_player1_id: string; team_b_player2_id: string | null
  }>>>({})
  const [saving, setSaving] = useState(false)

  // Score input state
  const [editingMatch, setEditingMatch] = useState<string | null>(null)
  const [editResult, setEditResult]     = useState<string | null>(null)
  const [editMargin, setEditMargin]     = useState('')

  // Collapsible sessions
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({})

  // ─── Fetch cup data ────────────────────────────────────────────────────────

  const fetchCup = useCallback(async () => {
    try {
      const res = await fetch(`/api/trips/${tripId}/cup`)
      const data = await res.json()
      setCup(data)
    } catch { /* ignore */ }
    setLoading(false)
  }, [tripId])

  useEffect(() => { fetchCup() }, [fetchCup])

  // ─── Setup handlers ────────────────────────────────────────────────────────

  function startSetup() {
    setCupName(`${tripName} Cup`)
    setTeamAName('Team A')
    setTeamBName('Team B')
    setTeamAColor('#1a2e1a')
    setTeamBColor('#c4a84f')
    const init: Record<string, null> = {}
    members.forEach(m => { init[mid(m)] = null })
    setAssignments(init)
    setCaptains({})
    const fmts: Record<string, string> = {}
    teeTimes.forEach(t => { fmts[t.id] = 'four_ball' })
    setSessionFormats(fmts)
    setSessionPairings({})
    setSetupStep(1)
  }

  function assignMember(memberId: string, team: 'a' | 'b') {
    setAssignments(prev => ({ ...prev, [memberId]: team }))
  }

  function unassignMember(memberId: string) {
    setAssignments(prev => ({ ...prev, [memberId]: null }))
    setCaptains(prev => { const next = { ...prev }; delete next[memberId]; return next })
  }

  function toggleCaptain(memberId: string) {
    setCaptains(prev => ({ ...prev, [memberId]: !prev[memberId] }))
  }

  async function handleAutoSplit() {
    try {
      const res = await fetch(`/api/trips/${tripId}/cup/auto-pair`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'split' }),
      })
      const data = await res.json()
      if (data.assignments) {
        const newAssign: Record<string, 'a' | 'b' | null> = {}
        const newCaptains: Record<string, boolean> = {}
        data.assignments.forEach((a: { member_id: string; team: 'a' | 'b'; is_captain: boolean }) => {
          newAssign[a.member_id] = a.team
          if (a.is_captain) newCaptains[a.member_id] = true
        })
        setAssignments(newAssign)
        setCaptains(newCaptains)
      }
    } catch { /* ignore */ }
  }

  async function handleAutoPair(teeTimeId: string) {
    const fmt = sessionFormats[teeTimeId] ?? 'four_ball'
    try {
      const res = await fetch(`/api/trips/${tripId}/cup/auto-pair`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'pair', format: fmt }),
      })
      const data = await res.json()
      if (data.pairings) {
        setSessionPairings(prev => ({ ...prev, [teeTimeId]: data.pairings }))
      }
    } catch { /* ignore */ }
  }

  async function handleCreateCup() {
    setSaving(true)
    try {
      // 1. Create the cup
      const cupRes = await fetch(`/api/trips/${tripId}/cup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: cupName,
          team_a_name: teamAName,
          team_b_name: teamBName,
          team_a_color: teamAColor,
          team_b_color: teamBColor,
        }),
      })
      if (!cupRes.ok) { setSaving(false); return }

      // 2. Save team assignments
      const teamAssign = Object.entries(assignments)
        .filter(([, team]) => team !== null)
        .map(([member_id, team]) => ({
          member_id,
          team: team as 'a' | 'b',
          is_captain: captains[member_id] ?? false,
        }))

      await fetch(`/api/trips/${tripId}/cup/teams`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ assignments: teamAssign }),
      })

      // 3. Create sessions with matches
      const sessions = teeTimes.map((t, i) => ({
        tee_time_id: t.id,
        format: sessionFormats[t.id] ?? 'four_ball',
        session_order: i + 1,
        matches: (sessionPairings[t.id] ?? []).map((p, mi) => ({
          ...p,
          match_order: mi + 1,
        })),
      }))

      if (sessions.length > 0) {
        await fetch(`/api/trips/${tripId}/cup/sessions`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sessions }),
        })
      }

      // 4. Activate the cup
      await fetch(`/api/trips/${tripId}/cup`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'active' }),
      })

      setSetupStep(0)
      await fetchCup()
    } catch { /* ignore */ }
    setSaving(false)
  }

  // ─── Score handlers ────────────────────────────────────────────────────────

  async function handleSaveResult(matchId: string) {
    if (!editResult) return
    await fetch(`/api/trips/${tripId}/cup/matches`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        match_id: matchId,
        result: editResult,
        score_display: editResult === 'halved' ? 'AS' : editMargin || (editResult === 'team_a' ? '1 UP' : '1 UP'),
      }),
    })
    setEditingMatch(null)
    setEditResult(null)
    setEditMargin('')
    fetchCup()
  }

  async function handleClearResult(matchId: string) {
    await fetch(`/api/trips/${tripId}/cup/matches`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ match_id: matchId, result: null, score_display: null }),
    })
    fetchCup()
  }

  async function handleDeleteCup() {
    await fetch(`/api/trips/${tripId}/cup`, { method: 'DELETE' })
    setCup(null)
    setSetupStep(0)
  }

  // ─── Member lookup ─────────────────────────────────────────────────────────

  const memberMap = new Map(members.map(m => [mid(m), m]))

  function getMemberName(id: string | null): string {
    if (!id) return '?'
    const m = memberMap.get(id)
    return m ? memberLastName(m) : '?'
  }

  // ─── Loading ───────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div style={{ padding: 48, textAlign: 'center', color: '#9ca3af', fontSize: '14px' }}>
        Loading…
      </div>
    )
  }

  // ─── Setup Flow ────────────────────────────────────────────────────────────

  if (setupStep > 0) {
    const teamAMembers = members.filter(m => assignments[mid(m)] === 'a')
    const teamBMembers = members.filter(m => assignments[mid(m)] === 'b')
    const unassigned   = members.filter(m => assignments[mid(m)] === null || assignments[mid(m)] === undefined)

    const totalAHcp = teamAMembers.reduce((s, m) => s + getHandicap(m), 0)
    const totalBHcp = teamBMembers.reduce((s, m) => s + getHandicap(m), 0)

    return (
      <div style={{ maxWidth: 800, margin: '0 auto' }}>
        {/* Step indicator */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 28 }}>
          {['Name', 'Teams', 'Sessions'].map((label, i) => (
            <div key={label} style={{
              flex: 1, textAlign: 'center', padding: '8px 0',
              borderBottom: `2px solid ${setupStep === i + 1 ? 'var(--gold)' : '#e5e7eb'}`,
              color: setupStep === i + 1 ? 'var(--gold)' : '#9ca3af',
              fontSize: '12px', fontWeight: 600, letterSpacing: '0.04em',
            }}>
              {label}
            </div>
          ))}
        </div>

        {/* Step 1: Name */}
        {setupStep === 1 && (
          <div style={{ ...CARD, padding: 32 }}>
            <div style={{
              fontSize: '24px', fontWeight: 700, fontFamily: 'var(--font-serif)',
              fontStyle: 'italic', color: 'var(--green-deep)', marginBottom: 8,
            }}>
              Name Your Cup
            </div>
            <div style={{ fontSize: '13px', color: '#6b7280', marginBottom: 20 }}>
              This name appears on the dashboard and in your trip brochure.
            </div>
            <input
              value={cupName}
              onChange={e => setCupName(e.target.value)}
              placeholder="e.g. Black & Gold Cup"
              style={{ ...INPUT, fontSize: '16px', fontWeight: 600, padding: '12px 16px' }}
            />
            <div style={{ marginTop: 24, display: 'flex', justifyContent: 'flex-end' }}>
              <button onClick={() => setSetupStep(2)} disabled={!cupName.trim()} style={{
                ...BTN_GOLD, opacity: cupName.trim() ? 1 : 0.5,
              }}>
                Next →
              </button>
            </div>
          </div>
        )}

        {/* Step 2: Teams */}
        {setupStep === 2 && (
          <div>
            {/* Unassigned pool */}
            {unassigned.length > 0 && (
              <div style={{ ...CARD, padding: 20, marginBottom: 20 }}>
                <div style={{
                  fontSize: '11px', fontWeight: 700, color: '#9ca3af', letterSpacing: '0.08em',
                  textTransform: 'uppercase', marginBottom: 10,
                }}>
                  Unassigned ({unassigned.length})
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  {unassigned.map(m => (
                    <div key={mid(m)} style={{
                      display: 'flex', alignItems: 'center', gap: 6,
                      padding: '6px 10px', borderRadius: 8, background: '#f9fafb',
                      border: '1px solid #e5e7eb', fontSize: '13px',
                    }}>
                      <span style={{ fontWeight: 500, color: '#111827' }}>{memberName(m)}</span>
                      <span style={{ fontSize: '11px', color: '#9ca3af' }}>({getHandicap(m)})</span>
                      <button onClick={() => assignMember(mid(m), 'a')} style={{
                        background: teamAColor, color: contrastText(teamAColor),
                        border: 'none', borderRadius: 4, padding: '2px 6px', fontSize: '10px',
                        cursor: 'pointer', fontWeight: 600,
                      }}>A</button>
                      <button onClick={() => assignMember(mid(m), 'b')} style={{
                        background: teamBColor, color: contrastText(teamBColor),
                        border: 'none', borderRadius: 4, padding: '2px 6px', fontSize: '10px',
                        cursor: 'pointer', fontWeight: 600,
                      }}>B</button>
                    </div>
                  ))}
                </div>
                <div style={{ marginTop: 12 }}>
                  <button onClick={handleAutoSplit} style={{
                    ...BTN_OUTLINE, padding: '6px 14px', fontSize: '12px',
                  }}>
                    ✦ Auto-Split by Handicap
                  </button>
                </div>
              </div>
            )}

            {/* Two team columns */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              {/* Team A */}
              <div style={{ ...CARD, padding: 20 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                  <div style={{
                    width: 16, height: 16, borderRadius: 4, background: teamAColor,
                    border: '1px solid rgba(0,0,0,0.1)',
                  }} />
                  <input
                    value={teamAName}
                    onChange={e => setTeamAName(e.target.value)}
                    style={{ ...INPUT, fontWeight: 600 }}
                  />
                </div>
                {/* Color picker */}
                <div style={{ display: 'flex', gap: 4, marginBottom: 12 }}>
                  {PRESET_COLORS.map(c => (
                    <button key={c.value} onClick={() => setTeamAColor(c.value)} title={c.label} style={{
                      width: 22, height: 22, borderRadius: '50%', background: c.value,
                      border: teamAColor === c.value ? '2px solid #111' : '1px solid rgba(0,0,0,0.15)',
                      cursor: 'pointer', padding: 0,
                    }} />
                  ))}
                </div>
                {/* Members */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  {teamAMembers.map(m => (
                    <div key={mid(m)} style={{
                      display: 'flex', alignItems: 'center', gap: 6,
                      padding: '8px 10px', borderRadius: 8,
                      background: teamAColor + '10', fontSize: '13px',
                    }}>
                      <button onClick={() => toggleCaptain(mid(m))} title="Toggle captain" style={{
                        background: 'none', border: 'none', cursor: 'pointer', fontSize: '14px', padding: 0,
                        color: captains[mid(m)] ? '#c4a84f' : '#d1d5db',
                      }}>★</button>
                      <span style={{ flex: 1, fontWeight: 500, color: '#111827' }}>{memberName(m)}</span>
                      <span style={{ fontSize: '11px', color: '#9ca3af' }}>{getHandicap(m)}</span>
                      <button onClick={() => unassignMember(mid(m))} style={{
                        background: 'none', border: 'none', color: '#d1d5db', cursor: 'pointer',
                        fontSize: '16px', lineHeight: 1, padding: 0,
                      }}>×</button>
                    </div>
                  ))}
                  {teamAMembers.length > 0 && (
                    <div style={{ fontSize: '11px', color: '#9ca3af', textAlign: 'right', marginTop: 4 }}>
                      Avg HCP: {(totalAHcp / teamAMembers.length).toFixed(1)}
                    </div>
                  )}
                </div>
              </div>

              {/* Team B */}
              <div style={{ ...CARD, padding: 20 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                  <div style={{
                    width: 16, height: 16, borderRadius: 4, background: teamBColor,
                    border: '1px solid rgba(0,0,0,0.1)',
                  }} />
                  <input
                    value={teamBName}
                    onChange={e => setTeamBName(e.target.value)}
                    style={{ ...INPUT, fontWeight: 600 }}
                  />
                </div>
                <div style={{ display: 'flex', gap: 4, marginBottom: 12 }}>
                  {PRESET_COLORS.map(c => (
                    <button key={c.value} onClick={() => setTeamBColor(c.value)} title={c.label} style={{
                      width: 22, height: 22, borderRadius: '50%', background: c.value,
                      border: teamBColor === c.value ? '2px solid #111' : '1px solid rgba(0,0,0,0.15)',
                      cursor: 'pointer', padding: 0,
                    }} />
                  ))}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  {teamBMembers.map(m => (
                    <div key={mid(m)} style={{
                      display: 'flex', alignItems: 'center', gap: 6,
                      padding: '8px 10px', borderRadius: 8,
                      background: teamBColor + '10', fontSize: '13px',
                    }}>
                      <button onClick={() => toggleCaptain(mid(m))} title="Toggle captain" style={{
                        background: 'none', border: 'none', cursor: 'pointer', fontSize: '14px', padding: 0,
                        color: captains[mid(m)] ? '#c4a84f' : '#d1d5db',
                      }}>★</button>
                      <span style={{ flex: 1, fontWeight: 500, color: '#111827' }}>{memberName(m)}</span>
                      <span style={{ fontSize: '11px', color: '#9ca3af' }}>{getHandicap(m)}</span>
                      <button onClick={() => unassignMember(mid(m))} style={{
                        background: 'none', border: 'none', color: '#d1d5db', cursor: 'pointer',
                        fontSize: '16px', lineHeight: 1, padding: 0,
                      }}>×</button>
                    </div>
                  ))}
                  {teamBMembers.length > 0 && (
                    <div style={{ fontSize: '11px', color: '#9ca3af', textAlign: 'right', marginTop: 4 }}>
                      Avg HCP: {(totalBHcp / teamBMembers.length).toFixed(1)}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Nav buttons */}
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 24 }}>
              <button onClick={() => setSetupStep(1)} style={BTN_OUTLINE}>← Back</button>
              <button
                onClick={() => setSetupStep(3)}
                disabled={teamAMembers.length === 0 || teamBMembers.length === 0}
                style={{
                  ...BTN_GOLD,
                  opacity: teamAMembers.length > 0 && teamBMembers.length > 0 ? 1 : 0.5,
                }}
              >
                Next →
              </button>
            </div>
          </div>
        )}

        {/* Step 3: Sessions */}
        {setupStep === 3 && (
          <div>
            {teeTimes.length === 0 ? (
              <div style={{ ...CARD, padding: 32, textAlign: 'center' }}>
                <div style={{ fontSize: '14px', color: '#6b7280', marginBottom: 12 }}>
                  No tee times set up yet. Add tee times first to create sessions, or create The Cup without sessions and add them later.
                </div>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {teeTimes.map((t, i) => (
                  <div key={t.id} style={{ ...CARD, padding: 20 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                      <div>
                        <div style={{ fontWeight: 600, fontSize: '14px', color: '#111827' }}>
                          Round {i + 1} — {t.course_name}
                        </div>
                        <div style={{ fontSize: '12px', color: '#9ca3af' }}>{formatDate(t.tee_date)}</div>
                      </div>
                      <select
                        value={sessionFormats[t.id] ?? 'four_ball'}
                        onChange={e => setSessionFormats(prev => ({ ...prev, [t.id]: e.target.value }))}
                        style={{
                          ...INPUT, width: 'auto', padding: '6px 10px', fontSize: '12px', fontWeight: 500,
                        }}
                      >
                        {FORMAT_OPTIONS.map(o => (
                          <option key={o.value} value={o.value}>{o.label}</option>
                        ))}
                      </select>
                    </div>

                    {/* Pairings */}
                    {sessionPairings[t.id] && sessionPairings[t.id].length > 0 && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 12 }}>
                        {sessionPairings[t.id].map((p, pi) => (
                          <div key={pi} style={{
                            display: 'flex', alignItems: 'center', gap: 8,
                            padding: '8px 12px', borderRadius: 8, background: '#f9fafb',
                            fontSize: '13px',
                          }}>
                            <span style={{ color: teamAColor, fontWeight: 600 }}>
                              {getMemberName(p.team_a_player1_id)}
                              {p.team_a_player2_id && ` & ${getMemberName(p.team_a_player2_id)}`}
                            </span>
                            <span style={{ color: '#9ca3af', fontSize: '11px' }}>vs</span>
                            <span style={{ color: teamBColor, fontWeight: 600 }}>
                              {getMemberName(p.team_b_player1_id)}
                              {p.team_b_player2_id && ` & ${getMemberName(p.team_b_player2_id)}`}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}

                    <button onClick={() => handleAutoPair(t.id)} style={{
                      ...BTN_OUTLINE, padding: '6px 14px', fontSize: '12px',
                    }}>
                      ✦ Auto-Pair
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Nav buttons */}
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 24 }}>
              <button onClick={() => setSetupStep(2)} style={BTN_OUTLINE}>← Back</button>
              <button onClick={handleCreateCup} disabled={saving} style={{
                ...BTN_GOLD, opacity: saving ? 0.5 : 1,
              }}>
                {saving ? 'Creating…' : '🏆 Create The Cup'}
              </button>
            </div>
          </div>
        )}
      </div>
    )
  }

  // ─── Empty State ───────────────────────────────────────────────────────────

  if (!cup) {
    return (
      <div style={{ textAlign: 'center', padding: '64px 32px', maxWidth: 480, margin: '0 auto' }}>
        <div style={{ fontSize: '56px', marginBottom: 16 }}>🏆</div>
        <div style={{
          fontSize: '28px', fontWeight: 700, fontFamily: 'var(--font-serif)',
          fontStyle: 'italic', color: 'var(--green-deep)', marginBottom: 10,
        }}>
          The Cup
        </div>
        <div style={{ fontSize: '14px', color: '#6b7280', lineHeight: 1.7, marginBottom: 28 }}>
          Split your group into two teams and compete across every round — match play,
          foursomes, four-ball, and singles. Just like the pros.
        </div>
        {isOrganizer && (
          <button onClick={startSetup} style={BTN_GOLD}>
            Set Up The Cup
          </button>
        )}
      </div>
    )
  }

  // ─── Scoreboard ────────────────────────────────────────────────────────────

  const totalA = cup.sessions.reduce((s, sess) =>
    s + sess.matches.reduce((ms, m) => ms + (m.team_a_points ?? 0), 0), 0)
  const totalB = cup.sessions.reduce((s, sess) =>
    s + sess.matches.reduce((ms, m) => ms + (m.team_b_points ?? 0), 0), 0)
  const totalMatches = cup.sessions.reduce((s, sess) => s + sess.matches.length, 0)
  const pointsToWin = Math.ceil(totalMatches / 2) + (totalMatches % 2 === 0 ? 0.5 : 0)

  // Build tee time lookup
  const ttMap = new Map(teeTimes.map(t => [t.id, t]))

  return (
    <div style={{ maxWidth: 800, margin: '0 auto' }}>
      {/* Header */}
      <div style={{
        ...CARD, padding: '28px 32px', marginBottom: 20, textAlign: 'center',
      }}>
        <div style={{ fontSize: '12px', color: '#9ca3af', marginBottom: 4 }}>🏆</div>
        <div style={{
          fontSize: '26px', fontWeight: 700, fontFamily: 'var(--font-serif)',
          fontStyle: 'italic', color: 'var(--green-deep)', marginBottom: 16,
        }}>
          {cup.name}
        </div>

        {/* Score display */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 20 }}>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: '13px', fontWeight: 600, color: cup.team_a_color }}>
              {cup.team_a_name}
            </div>
            <div style={{
              width: 40, height: 4, borderRadius: 2, background: cup.team_a_color,
              marginLeft: 'auto', marginTop: 4,
            }} />
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 12 }}>
            <span style={{
              fontSize: '42px', fontWeight: 700, fontFamily: 'var(--font-serif)',
              color: cup.team_a_color,
            }}>
              {totalA % 1 === 0 ? totalA : totalA.toFixed(1)}
            </span>
            <span style={{ fontSize: '20px', color: '#d1d5db', fontWeight: 300 }}>—</span>
            <span style={{
              fontSize: '42px', fontWeight: 700, fontFamily: 'var(--font-serif)',
              color: cup.team_b_color,
            }}>
              {totalB % 1 === 0 ? totalB : totalB.toFixed(1)}
            </span>
          </div>
          <div style={{ textAlign: 'left' }}>
            <div style={{ fontSize: '13px', fontWeight: 600, color: cup.team_b_color }}>
              {cup.team_b_name}
            </div>
            <div style={{
              width: 40, height: 4, borderRadius: 2, background: cup.team_b_color,
              marginTop: 4,
            }} />
          </div>
        </div>

        {totalMatches > 0 && (
          <div style={{ fontSize: '12px', color: '#9ca3af', marginTop: 12 }}>
            First to {pointsToWin % 1 === 0 ? pointsToWin : pointsToWin.toFixed(1)} points to win
          </div>
        )}

        {/* Organizer actions */}
        {isOrganizer && (
          <div style={{ marginTop: 16, display: 'flex', justifyContent: 'center', gap: 8 }}>
            <button onClick={handleDeleteCup} style={{
              background: 'none', border: 'none', color: '#d1d5db', fontSize: '12px',
              cursor: 'pointer', textDecoration: 'underline',
            }}>
              Delete Cup
            </button>
          </div>
        )}
      </div>

      {/* Sessions */}
      {cup.sessions.map((session, si) => {
        const tt = session.tee_time_id ? ttMap.get(session.tee_time_id) : null
        const isCollapsed = collapsed[session.id] ?? (session.status === 'upcoming' && si > 0)
        const sessionA = session.matches.reduce((s, m) => s + (m.team_a_points ?? 0), 0)
        const sessionB = session.matches.reduce((s, m) => s + (m.team_b_points ?? 0), 0)

        const statusColor = session.status === 'complete' ? '#059669'
          : session.status === 'in_progress' ? '#d97706' : '#9ca3af'
        const statusBg = session.status === 'complete' ? '#d1fae5'
          : session.status === 'in_progress' ? '#fef3c7' : '#f3f4f6'
        const statusLabel = session.status === 'complete' ? 'Complete'
          : session.status === 'in_progress' ? 'In Progress' : 'Upcoming'

        return (
          <div key={session.id} style={{ ...CARD, marginBottom: 12 }}>
            {/* Session header */}
            <button
              onClick={() => setCollapsed(prev => ({ ...prev, [session.id]: !isCollapsed }))}
              style={{
                width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '14px 20px', background: 'none', border: 'none', cursor: 'pointer',
                borderBottom: isCollapsed ? 'none' : '1px solid #f3f4f6',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: '12px', color: '#9ca3af', transition: 'transform 0.15s', transform: isCollapsed ? 'rotate(-90deg)' : 'rotate(0deg)' }}>
                  ▼
                </span>
                <span style={{ fontWeight: 600, fontSize: '14px', color: '#111827' }}>
                  Round {session.session_order}
                  {tt && ` — ${tt.course_name} (${formatDate(tt.tee_date)})`}
                  {' — '}
                  {formatLabel(session.format)}
                </span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                {session.status === 'complete' && (
                  <span style={{ fontSize: '12px', fontWeight: 600, color: sessionA > sessionB ? cup.team_a_color : sessionB > sessionA ? cup.team_b_color : '#9ca3af' }}>
                    {sessionA}–{sessionB}
                  </span>
                )}
                <span style={{
                  fontSize: '10px', fontWeight: 600, padding: '3px 8px', borderRadius: 20,
                  background: statusBg, color: statusColor,
                }}>
                  {statusLabel}
                </span>
              </div>
            </button>

            {/* Matches */}
            {!isCollapsed && (
              <div style={{ padding: '8px 20px 16px' }}>
                {session.matches.length === 0 ? (
                  <div style={{ fontSize: '13px', color: '#9ca3af', padding: '8px 0' }}>
                    No pairings set up for this session.
                  </div>
                ) : (
                  session.matches.map(match => {
                    const isEditing = editingMatch === match.id
                    const hasResult = match.result !== null

                    return (
                      <div key={match.id} style={{
                        display: 'flex', alignItems: 'center', gap: 8,
                        padding: '10px 0', borderBottom: '1px solid #f9fafb',
                        fontSize: '13px',
                      }}>
                        {/* Team A players */}
                        <div style={{ flex: 1, textAlign: 'right' }}>
                          <span style={{ fontWeight: 600, color: cup.team_a_color }}>
                            {getMemberName(match.team_a_player1_id)}
                            {match.team_a_player2_id && ` & ${getMemberName(match.team_a_player2_id)}`}
                          </span>
                        </div>

                        {/* Score / result area */}
                        <div style={{ width: 120, textAlign: 'center', flexShrink: 0 }}>
                          {isEditing ? (
                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                              <div style={{ display: 'flex', gap: 4 }}>
                                <button onClick={() => setEditResult('team_a')} style={{
                                  padding: '3px 8px', borderRadius: 4, fontSize: '10px', fontWeight: 600,
                                  background: editResult === 'team_a' ? cup.team_a_color : '#f3f4f6',
                                  color: editResult === 'team_a' ? contrastText(cup.team_a_color) : '#6b7280',
                                  border: 'none', cursor: 'pointer',
                                }}>A Win</button>
                                <button onClick={() => setEditResult('halved')} style={{
                                  padding: '3px 8px', borderRadius: 4, fontSize: '10px', fontWeight: 600,
                                  background: editResult === 'halved' ? '#f3f4f6' : '#f3f4f6',
                                  color: editResult === 'halved' ? '#111827' : '#6b7280',
                                  border: editResult === 'halved' ? '1px solid #9ca3af' : 'none',
                                  cursor: 'pointer',
                                }}>Halve</button>
                                <button onClick={() => setEditResult('team_b')} style={{
                                  padding: '3px 8px', borderRadius: 4, fontSize: '10px', fontWeight: 600,
                                  background: editResult === 'team_b' ? cup.team_b_color : '#f3f4f6',
                                  color: editResult === 'team_b' ? contrastText(cup.team_b_color) : '#6b7280',
                                  border: 'none', cursor: 'pointer',
                                }}>B Win</button>
                              </div>
                              {editResult && editResult !== 'halved' && (
                                <input
                                  value={editMargin}
                                  onChange={e => setEditMargin(e.target.value)}
                                  placeholder="e.g. 3&2"
                                  style={{ ...INPUT, width: 80, fontSize: '11px', textAlign: 'center', padding: '4px 6px' }}
                                />
                              )}
                              <div style={{ display: 'flex', gap: 4 }}>
                                <button onClick={() => handleSaveResult(match.id)} disabled={!editResult} style={{
                                  padding: '3px 8px', borderRadius: 4, fontSize: '10px', fontWeight: 600,
                                  background: 'var(--gold)', color: '#fff', border: 'none', cursor: 'pointer',
                                  opacity: editResult ? 1 : 0.5,
                                }}>Save</button>
                                <button onClick={() => { setEditingMatch(null); setEditResult(null); setEditMargin('') }} style={{
                                  padding: '3px 8px', borderRadius: 4, fontSize: '10px',
                                  background: 'none', border: '1px solid #d1d5db', color: '#6b7280', cursor: 'pointer',
                                }}>Cancel</button>
                              </div>
                            </div>
                          ) : hasResult ? (
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                              <span style={{
                                fontWeight: 700, fontSize: '12px',
                                color: match.result === 'team_a' ? cup.team_a_color
                                  : match.result === 'team_b' ? cup.team_b_color : '#6b7280',
                              }}>
                                {match.score_display || 'AS'}
                              </span>
                              <span style={{
                                width: 8, height: 8, borderRadius: '50%', display: 'inline-block',
                                background: match.result === 'team_a' ? cup.team_a_color
                                  : match.result === 'team_b' ? cup.team_b_color
                                  : `linear-gradient(135deg, ${cup.team_a_color} 50%, ${cup.team_b_color} 50%)`,
                              }} />
                              {isOrganizer && (
                                <button onClick={() => handleClearResult(match.id)} style={{
                                  background: 'none', border: 'none', color: '#d1d5db', cursor: 'pointer',
                                  fontSize: '12px', padding: 0,
                                }}>✕</button>
                              )}
                            </div>
                          ) : isOrganizer ? (
                            <button onClick={() => {
                              setEditingMatch(match.id)
                              setEditResult(null)
                              setEditMargin('')
                            }} style={{
                              background: 'none', border: '1px dashed #d1d5db', borderRadius: 6,
                              padding: '4px 12px', fontSize: '11px', color: '#9ca3af', cursor: 'pointer',
                            }}>
                              Record
                            </button>
                          ) : (
                            <span style={{ color: '#d1d5db', fontSize: '12px' }}>—</span>
                          )}
                        </div>

                        {/* Team B players */}
                        <div style={{ flex: 1, textAlign: 'left' }}>
                          <span style={{ fontWeight: 600, color: cup.team_b_color }}>
                            {getMemberName(match.team_b_player1_id)}
                            {match.team_b_player2_id && ` & ${getMemberName(match.team_b_player2_id)}`}
                          </span>
                        </div>
                      </div>
                    )
                  })
                )}
              </div>
            )}
          </div>
        )
      })}

      {/* Announce Pairings placeholder */}
      {isOrganizer && cup.sessions.some(s => s.status === 'upcoming') && (
        <div style={{
          marginTop: 20, textAlign: 'center', padding: '16px',
          borderRadius: 12, border: '1px dashed #e5e7eb',
        }}>
          <button disabled style={{
            ...BTN_OUTLINE, opacity: 0.5, cursor: 'not-allowed',
          }}>
            📣 Announce Pairings
          </button>
          <div style={{ fontSize: '11px', color: '#d1d5db', marginTop: 6 }}>
            Coming soon — notify your group of the day&apos;s matchups
          </div>
        </div>
      )}
    </div>
  )
}
