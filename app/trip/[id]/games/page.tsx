'use client'

import React, { useEffect, useState, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/context/AuthContext'
import ProtectedRoute from '@/components/ProtectedRoute'
import Sidebar from '@/components/ui/Sidebar'
import type { NavItem } from '@/components/ui/Sidebar'
import {
  GAMES_LIBRARY,
  GAME_CATEGORIES,
  gamesByCategory,
  difficultyColor,
  type GameDef,
  type GameCategory,
} from '@/lib/gamesLibrary'
import TheCup from './TheCup'

// ─── Types ────────────────────────────────────────────────────────────────────

type Trip = {
  id:          string
  name:        string
  destination: string | null
  start_date:  string | null
  end_date:    string | null
  created_by:  string
}

type Member = {
  id:            number
  user_id:       string | null
  display_name:  string | null
  email:         string | null
  handicap:      number | null
  trip_handicap?: number | null
  role:          string
  member_type:   string
}

type TeeTime = {
  id:          string
  course_name: string
  course_id:   string | null
  tee_date:    string
}

type Game = {
  id:              string
  trip_id:         string
  round_number:    number
  course_id:       string | null
  game_type:       string
  game_config:     Record<string, unknown>
  stakes_per_unit: number
  status:          string
  created_by:      string | null
  created_at:      string
  game_pairings:   Pairing[]
}

type Pairing = {
  id:          string
  game_id:     string
  team_number: number
  team_name:   string | null
  player_ids:  string[]
}

type Score = {
  id:          string
  game_id:     string
  player_id:   string
  hole_number: number | null
  gross_score: number | null
  net_score:   number | null
  points:      number | null
  notes:       string | null
}

type Payout = {
  id:             string
  trip_id:        string
  game_id:        string | null
  from_player_id: string
  to_player_id:   string
  amount:         number
  description:    string | null
  status:         string
}

type AISuggestion = {
  round:           string
  game:            string
  reason:          string
  suggestedStakes: string
  config:          Record<string, unknown>
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function memberName(m: Member): string {
  return m.display_name ?? m.email ?? 'Member'
}

function memberHandicap(m: Member): number | null {
  return m.trip_handicap ?? m.handicap ?? null
}

function fmt(n: number): string {
  return n.toLocaleString('en-US', {
    style: 'currency', currency: 'USD',
    minimumFractionDigits: 0, maximumFractionDigits: 0,
  })
}

function fmtAmount(n: number): string {
  return n.toLocaleString('en-US', {
    style: 'currency', currency: 'USD',
    minimumFractionDigits: 2, maximumFractionDigits: 2,
  })
}

function buildTripMeta(start: string | null, end: string | null, count: number): string {
  const parts: string[] = []
  if (start) {
    const s = new Date(start + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    const e = end ? new Date(end + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : ''
    parts.push(e ? `${s} – ${e}` : `From ${s}`)
  }
  if (count > 0) parts.push(`${count} golfer${count !== 1 ? 's' : ''}`)
  return parts.join(' · ')
}

function buildNavItems(memberCount: number): NavItem[] {
  return [
    { id: 'concierge', icon: '✦',  label: 'Golf Concierge',  href: '' },
    { id: 'itinerary', icon: '📅', label: 'Trip Itinerary',  href: '' },
    { id: 'games',     icon: '🎲', label: 'Golf Games',      href: '' },
    { id: 'teetimes',  icon: '🕐', label: 'Tee Times',       href: '' },
    { id: 'hotels',    icon: '🏨', label: 'Accommodations',  href: '' },
    { id: 'group',     icon: '👥', label: 'Group & Members', href: '', badge: memberCount > 0 ? memberCount : undefined },
    { id: 'budget',    icon: '💰', label: 'Budget Tracker',  href: '' },
  ]
}

function formatTeeDate(d: string) {
  return new Date(d + 'T12:00:00').toLocaleDateString('en-US', {
    month: 'short', day: 'numeric',
  })
}

// ─── Styles (shared) ──────────────────────────────────────────────────────────

const CARD: React.CSSProperties = {
  background: '#fff',
  borderRadius: 12,
  border: '1px solid #e5e7eb',
  overflow: 'hidden',
}

const CARD_HEADER: React.CSSProperties = {
  padding: '18px 24px',
  borderBottom: '1px solid #f3f4f6',
  fontWeight: 700,
  fontSize: '15px',
  color: '#111827',
}

const BTN_GOLD: React.CSSProperties = {
  background: 'var(--gold)',
  color: '#fff',
  border: 'none',
  borderRadius: 8,
  padding: '10px 20px',
  fontWeight: 600,
  fontSize: '13px',
  cursor: 'pointer',
  fontFamily: 'var(--font-sans)',
  letterSpacing: '0.02em',
}

const BTN_OUTLINE: React.CSSProperties = {
  background: 'transparent',
  color: 'var(--gold)',
  border: '1.5px solid var(--gold)',
  borderRadius: 8,
  padding: '9px 18px',
  fontWeight: 600,
  fontSize: '13px',
  cursor: 'pointer',
  fontFamily: 'var(--font-sans)',
}

const INPUT_STYLE: React.CSSProperties = {
  width: '100%',
  padding: '8px 12px',
  border: '1px solid #d1d5db',
  borderRadius: 8,
  fontSize: '13px',
  fontFamily: 'var(--font-sans)',
  outline: 'none',
}

// ─── Game Card (for picker) ───────────────────────────────────────────────────

function GamePickerCard({
  gameKey, game, selected, onClick,
}: {
  gameKey: string; game: GameDef; selected: boolean; onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      style={{
        ...CARD,
        padding: '16px',
        cursor: 'pointer',
        textAlign: 'left',
        border: selected ? '2px solid var(--gold)' : '1px solid #e5e7eb',
        background: selected ? 'rgba(196,168,79,0.06)' : '#fff',
        transition: 'border-color 0.15s, background 0.15s',
        width: '100%',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
        <div style={{ fontWeight: 600, fontSize: '14px', color: '#111827' }}>
          {game.name}
        </div>
        <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
          <span style={{
            fontSize: '10px', fontWeight: 600, padding: '2px 6px', borderRadius: 20,
            background: difficultyColor(game.difficulty) + '22',
            color: difficultyColor(game.difficulty),
          }}>
            {game.difficulty}
          </span>
          <span style={{
            fontSize: '10px', fontWeight: 500, padding: '2px 6px', borderRadius: 20,
            background: '#f3f4f6', color: '#6b7280',
          }}>
            {game.minPlayers === game.maxPlayers
              ? `${game.minPlayers}p`
              : game.maxPlayers >= 999
                ? `${game.minPlayers}+`
                : `${game.minPlayers}-${game.maxPlayers}p`}
          </span>
        </div>
      </div>
      <div style={{ fontSize: '12px', color: '#6b7280', marginTop: 6, lineHeight: 1.5 }}>
        {game.description.slice(0, 120)}{game.description.length > 120 ? '…' : ''}
      </div>
    </button>
  )
}

// ─── Score Entry Table ────────────────────────────────────────────────────────

function ScoreEntryTable({
  game, members, scores, onSave,
}: {
  game:    Game
  members: Member[]
  scores:  Score[]
  onSave:  (scores: { player_id: string; gross_score: number; net_score: number }[]) => void
}) {
  // Map player_id -> existing score
  const scoreMap: Record<string, Score> = {}
  scores.forEach(s => { scoreMap[s.player_id] = s })

  // Only show members who are in the game
  const allPlayerIds = game.game_pairings.length > 0
    ? game.game_pairings.flatMap(p => p.player_ids)
    : members.filter(m => m.user_id).map(m => m.user_id!)

  const playerIds = [...new Set(allPlayerIds)]

  const [localScores, setLocalScores] = useState<Record<string, string>>(() => {
    const init: Record<string, string> = {}
    playerIds.forEach(pid => {
      init[pid] = scoreMap[pid]?.gross_score?.toString() ?? ''
    })
    return init
  })

  const [saving, setSaving] = useState(false)

  const handleSave = async () => {
    setSaving(true)
    const entries = playerIds
      .filter(pid => localScores[pid] && localScores[pid].trim() !== '')
      .map(pid => {
        const gross = parseInt(localScores[pid], 10)
        const member = members.find(m => m.user_id === pid)
        const hcp = member ? memberHandicap(member) ?? 0 : 0
        return {
          player_id: pid,
          gross_score: gross,
          net_score: gross - hcp,
        }
      })
    await onSave(entries)
    setSaving(false)
  }

  return (
    <div>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr style={{ borderBottom: '2px solid #e5e7eb' }}>
            <th style={{ textAlign: 'left', padding: '8px 12px', fontSize: '12px', fontWeight: 600, color: '#6b7280' }}>Player</th>
            <th style={{ textAlign: 'center', padding: '8px 12px', fontSize: '12px', fontWeight: 600, color: '#6b7280', width: 60 }}>HCP</th>
            <th style={{ textAlign: 'center', padding: '8px 12px', fontSize: '12px', fontWeight: 600, color: '#6b7280', width: 100 }}>Gross Score</th>
            <th style={{ textAlign: 'center', padding: '8px 12px', fontSize: '12px', fontWeight: 600, color: '#6b7280', width: 100 }}>Net Score</th>
          </tr>
        </thead>
        <tbody>
          {playerIds.map(pid => {
            const member = members.find(m => m.user_id === pid)
            const name = member ? memberName(member) : 'Unknown'
            const hcp = member ? memberHandicap(member) ?? 0 : 0
            const gross = localScores[pid] ? parseInt(localScores[pid], 10) : null
            const net = gross !== null && !isNaN(gross) ? gross - hcp : null
            return (
              <tr key={pid} style={{ borderBottom: '1px solid #f3f4f6' }}>
                <td style={{ padding: '10px 12px', fontSize: '14px', fontWeight: 500, color: '#111827' }}>{name}</td>
                <td style={{ padding: '10px 12px', fontSize: '13px', color: '#9ca3af', textAlign: 'center' }}>{hcp}</td>
                <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                  <input
                    type="number"
                    value={localScores[pid] ?? ''}
                    onChange={e => setLocalScores(prev => ({ ...prev, [pid]: e.target.value }))}
                    style={{ ...INPUT_STYLE, width: 70, textAlign: 'center' }}
                    placeholder="—"
                  />
                </td>
                <td style={{ padding: '10px 12px', textAlign: 'center', fontSize: '14px', fontWeight: 600, color: net !== null ? '#111827' : '#d1d5db' }}>
                  {net !== null ? net : '—'}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
      <div style={{ padding: '16px 12px', display: 'flex', justifyContent: 'flex-end' }}>
        <button onClick={handleSave} disabled={saving} style={BTN_GOLD}>
          {saving ? 'Saving…' : 'Save Scores'}
        </button>
      </div>
    </div>
  )
}

// ─── Results Card ─────────────────────────────────────────────────────────────

function ResultsCard({
  game, members, scores, onCalculate,
}: {
  game:        Game
  members:     Member[]
  scores:      Score[]
  onCalculate: (payouts: { from_player_id: string; to_player_id: string; amount: number; description: string }[]) => void
}) {
  const gameDef = GAMES_LIBRARY[game.game_type]
  const stakes = game.stakes_per_unit || 0
  if (scores.length === 0) return null

  // Sort scores by net (lower = better for stroke play)
  const sorted = [...scores]
    .filter(s => s.gross_score !== null)
    .sort((a, b) => (a.net_score ?? 999) - (b.net_score ?? 999))

  const getName = (pid: string) => {
    const m = members.find(m => m.user_id === pid)
    return m ? memberName(m) : 'Unknown'
  }

  // Simple stroke play results
  return (
    <div style={CARD}>
      <div style={CARD_HEADER}>Results — {gameDef?.name ?? game.game_type}</div>
      <div style={{ padding: '16px 24px' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ borderBottom: '2px solid #e5e7eb' }}>
              <th style={{ textAlign: 'left', padding: '6px 8px', fontSize: '11px', fontWeight: 600, color: '#9ca3af' }}>Pos</th>
              <th style={{ textAlign: 'left', padding: '6px 8px', fontSize: '11px', fontWeight: 600, color: '#9ca3af' }}>Player</th>
              <th style={{ textAlign: 'center', padding: '6px 8px', fontSize: '11px', fontWeight: 600, color: '#9ca3af' }}>Gross</th>
              <th style={{ textAlign: 'center', padding: '6px 8px', fontSize: '11px', fontWeight: 600, color: '#9ca3af' }}>Net</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((s, i) => (
              <tr key={s.player_id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                <td style={{ padding: '8px', fontSize: '14px', fontWeight: i === 0 ? 700 : 400, color: i === 0 ? 'var(--gold)' : '#6b7280' }}>
                  {i + 1}
                </td>
                <td style={{ padding: '8px', fontSize: '14px', fontWeight: 500, color: '#111827' }}>
                  {getName(s.player_id)}
                  {i === 0 && <span style={{ marginLeft: 6, fontSize: '12px' }}>🏆</span>}
                </td>
                <td style={{ padding: '8px', fontSize: '14px', textAlign: 'center', color: '#6b7280' }}>{s.gross_score}</td>
                <td style={{ padding: '8px', fontSize: '14px', fontWeight: 600, textAlign: 'center', color: '#111827' }}>{s.net_score}</td>
              </tr>
            ))}
          </tbody>
        </table>

        {stakes > 0 && sorted.length >= 2 && (
          <div style={{ marginTop: 16 }}>
            <button
              onClick={() => {
                // Simple payout: everyone pays the winner the difference in net strokes * stakes
                const winner = sorted[0]
                const payouts = sorted.slice(1).map(loser => ({
                  from_player_id: loser.player_id,
                  to_player_id: winner.player_id,
                  amount: ((loser.net_score ?? 0) - (winner.net_score ?? 0)) * stakes,
                  description: `${gameDef?.name ?? game.game_type} — ${getName(loser.player_id)} to ${getName(winner.player_id)}`,
                })).filter(p => p.amount > 0)
                onCalculate(payouts)
              }}
              style={BTN_GOLD}
            >
              Calculate Payouts
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Payout Summary ───────────────────────────────────────────────────────────

function PayoutSummary({
  payouts, members, onSettle,
}: {
  payouts:    Payout[]
  members:    Member[]
  onSettle:   (payoutId: string) => void
}) {
  if (payouts.length === 0) return null

  const getName = (pid: string) => {
    const m = members.find(m => m.user_id === pid)
    return m ? memberName(m) : 'Unknown'
  }

  return (
    <div style={CARD}>
      <div style={CARD_HEADER}>Settle Up</div>
      <div style={{ padding: '12px 24px' }}>
        {payouts.map(p => (
          <div key={p.id} style={{
            display: 'flex', alignItems: 'center', gap: 12,
            padding: '10px 0', borderBottom: '1px solid #f3f4f6',
          }}>
            <div style={{ flex: 1, fontSize: '14px', color: '#111827' }}>
              <span style={{ fontWeight: 600 }}>{getName(p.from_player_id)}</span>
              <span style={{ color: '#9ca3af' }}> owes </span>
              <span style={{ fontWeight: 600 }}>{getName(p.to_player_id)}</span>
              <span style={{ fontWeight: 700, color: 'var(--gold)', marginLeft: 8 }}>{fmtAmount(p.amount)}</span>
            </div>
            {p.status === 'settled' ? (
              <span style={{
                fontSize: '11px', fontWeight: 600, color: '#059669', background: '#d1fae5',
                padding: '3px 10px', borderRadius: 20,
              }}>
                Settled
              </span>
            ) : (
              <button
                onClick={() => onSettle(p.id)}
                style={{
                  fontSize: '12px', fontWeight: 600, color: '#059669', background: '#ecfdf5',
                  border: '1px solid #a7f3d0', borderRadius: 8, padding: '5px 12px', cursor: 'pointer',
                }}
              >
                Mark Settled
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Add Game Drawer ──────────────────────────────────────────────────────────

function AddGameDrawer({
  teeTimes, members, tripId, onClose, onCreated,
}: {
  teeTimes:  TeeTime[]
  members:   Member[]
  tripId:    string
  onClose:   () => void
  onCreated: () => void
}) {
  const [step, setStep] = useState(1)
  const [roundNumber, setRoundNumber] = useState(1)
  const [selectedRoundLabel, setSelectedRoundLabel] = useState('')
  const [selectedGame, setSelectedGame] = useState<string | null>(null)
  const [grossOrNet, setGrossOrNet] = useState<'gross' | 'net'>('net')
  const [stakes, setStakes] = useState('')
  const [carryovers, setCarryovers] = useState(true)
  const [presses, setPresses] = useState(false)
  const [saving, setSaving] = useState(false)

  // Step 1 round options
  const roundOptions = [
    ...teeTimes.map((t, i) => ({
      value: i + 1,
      label: `Round ${i + 1} — ${t.course_name} (${formatTeeDate(t.tee_date)})`,
    })),
    ...(teeTimes.length === 0
      ? [{ value: 1, label: 'Round 1' }]
      : []),
    { value: 0, label: 'Whole Trip (Trip-Wide Format)' },
  ]

  const gameDef = selectedGame ? GAMES_LIBRARY[selectedGame] : null

  // Step 2 category rows
  const categoryRows: { cat: GameCategory; label: string; games: [string, GameDef][] }[] =
    GAME_CATEGORIES.map(c => ({
      cat: c.key,
      label: c.label,
      games: gamesByCategory(c.key),
    })).filter(r => {
      // Show trip_format only when "Whole Trip" is selected
      if (roundNumber === 0 && r.cat === 'trip_format') return true
      if (roundNumber !== 0 && r.cat === 'trip_format') return false
      return r.games.length > 0
    })

  async function handleCreate() {
    if (!selectedGame) return
    setSaving(true)
    const config: Record<string, unknown> = { grossOrNet }
    if (gameDef?.configFields.includes('carryovers')) config.carryovers = carryovers
    if (gameDef?.configFields.includes('presses')) config.presses = presses

    await fetch(`/api/trips/${tripId}/games`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        round_number: roundNumber,
        game_type: selectedGame,
        game_config: config,
        stakes_per_unit: parseFloat(stakes) || 0,
      }),
    })
    setSaving(false)
    onCreated()
    onClose()
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 100,
      display: 'flex', justifyContent: 'flex-end',
    }}>
      {/* Backdrop */}
      <div onClick={onClose} style={{
        position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.3)',
      }} />
      {/* Drawer panel */}
      <div style={{
        position: 'relative', width: 520, maxWidth: '90vw',
        background: '#fff', height: '100vh', overflowY: 'auto',
        boxShadow: '-8px 0 30px rgba(0,0,0,0.08)',
        display: 'flex', flexDirection: 'column',
      }}>
        {/* Header */}
        <div style={{
          padding: '20px 28px', borderBottom: '1px solid #e5e7eb',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <h3 style={{ margin: 0, fontSize: '17px', fontWeight: 700, color: '#111827' }}>
            Add Game — Step {step} of 3
          </h3>
          <button onClick={onClose} style={{
            background: 'none', border: 'none', fontSize: '22px', color: '#9ca3af',
            cursor: 'pointer', lineHeight: 1,
          }}>
            ×
          </button>
        </div>

        <div style={{ flex: 1, padding: '24px 28px', overflowY: 'auto' }}>
          {/* Step 1 — Pick round */}
          {step === 1 && (
            <div>
              <div style={{ fontSize: '14px', fontWeight: 600, color: '#374151', marginBottom: 12 }}>
                Which round is this game for?
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {roundOptions.map(opt => (
                  <button
                    key={opt.value}
                    onClick={() => {
                      setRoundNumber(opt.value)
                      setSelectedRoundLabel(opt.label)
                      setStep(2)
                    }}
                    style={{
                      ...CARD,
                      padding: '14px 18px',
                      cursor: 'pointer',
                      textAlign: 'left',
                      fontSize: '14px',
                      fontWeight: 500,
                      color: '#111827',
                      border: '1px solid #e5e7eb',
                      transition: 'border-color 0.15s',
                    }}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Step 2 — Choose game */}
          {step === 2 && (
            <div>
              <button
                onClick={() => { setStep(1); setSelectedGame(null) }}
                style={{ background: 'none', border: 'none', color: 'var(--gold)', fontSize: '13px', cursor: 'pointer', marginBottom: 16, fontWeight: 600 }}
              >
                ← Back to round selection
              </button>
              <div style={{ fontSize: '12px', color: '#9ca3af', marginBottom: 16 }}>
                {selectedRoundLabel}
              </div>
              {categoryRows.map(row => (
                <div key={row.cat} style={{ marginBottom: 20 }}>
                  <div style={{
                    fontSize: '11px', fontWeight: 700, color: '#9ca3af', letterSpacing: '0.08em',
                    textTransform: 'uppercase', marginBottom: 8,
                  }}>
                    {row.label}
                  </div>
                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(2, 1fr)',
                    gap: 10,
                  }}>
                    {row.games.map(([key, game]) => (
                      <GamePickerCard
                        key={key}
                        gameKey={key}
                        game={game}
                        selected={selectedGame === key}
                        onClick={() => {
                          setSelectedGame(key)
                          setStep(3)
                        }}
                      />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Step 3 — Configure */}
          {step === 3 && gameDef && selectedGame && (
            <div>
              <button
                onClick={() => setStep(2)}
                style={{ background: 'none', border: 'none', color: 'var(--gold)', fontSize: '13px', cursor: 'pointer', marginBottom: 16, fontWeight: 600 }}
              >
                ← Back to game selection
              </button>
              <div style={{
                padding: '16px', borderRadius: 10, background: '#f9fafb',
                border: '1px solid #f3f4f6', marginBottom: 20,
              }}>
                <div style={{ fontWeight: 700, fontSize: '16px', color: '#111827', marginBottom: 4 }}>
                  {gameDef.name}
                </div>
                <div style={{ fontSize: '13px', color: '#6b7280', lineHeight: 1.6 }}>
                  {gameDef.description}
                </div>
                <div style={{ fontSize: '12px', color: '#9ca3af', marginTop: 8, fontStyle: 'italic' }}>
                  Ideal for: {gameDef.idealFor}
                </div>
              </div>

              {/* Config fields */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                {/* Gross or Net */}
                {gameDef.configFields.includes('grossOrNet') && (
                  <div>
                    <label style={{ fontSize: '13px', fontWeight: 600, color: '#374151', display: 'block', marginBottom: 6 }}>
                      Scoring Type
                    </label>
                    <div style={{ display: 'flex', gap: 8 }}>
                      {(['net', 'gross'] as const).map(opt => (
                        <button
                          key={opt}
                          onClick={() => setGrossOrNet(opt)}
                          style={{
                            padding: '8px 18px', borderRadius: 8, fontSize: '13px', fontWeight: 500,
                            cursor: 'pointer', fontFamily: 'var(--font-sans)',
                            border: grossOrNet === opt ? '2px solid var(--gold)' : '1px solid #d1d5db',
                            background: grossOrNet === opt ? 'rgba(196,168,79,0.08)' : '#fff',
                            color: grossOrNet === opt ? 'var(--gold)' : '#6b7280',
                          }}
                        >
                          {opt === 'net' ? 'Net (Handicap Adjusted)' : 'Gross'}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Stakes */}
                <div>
                  <label style={{ fontSize: '13px', fontWeight: 600, color: '#374151', display: 'block', marginBottom: 6 }}>
                    Stakes per unit ($)
                  </label>
                  <input
                    type="number"
                    value={stakes}
                    onChange={e => setStakes(e.target.value)}
                    placeholder="0"
                    style={{ ...INPUT_STYLE, width: 120 }}
                  />
                  <div style={{ fontSize: '11px', color: '#9ca3af', marginTop: 4 }}>
                    Leave at 0 for friendly play
                  </div>
                </div>

                {/* Carryovers for Skins */}
                {gameDef.configFields.includes('carryovers') && (
                  <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '13px', color: '#374151', cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={carryovers}
                      onChange={e => setCarryovers(e.target.checked)}
                      style={{ width: 16, height: 16 }}
                    />
                    <span style={{ fontWeight: 500 }}>Carryovers on ties</span>
                    <span style={{ color: '#9ca3af', fontSize: '12px' }}>— Tied holes carry the skin to the next hole</span>
                  </label>
                )}

                {/* Presses for Nassau */}
                {gameDef.configFields.includes('presses') && (
                  <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '13px', color: '#374151', cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={presses}
                      onChange={e => setPresses(e.target.checked)}
                      style={{ width: 16, height: 16 }}
                    />
                    <span style={{ fontWeight: 500 }}>Auto-press when down 2</span>
                    <span style={{ color: '#9ca3af', fontSize: '12px' }}>— New bet starts when trailing by 2 holes</span>
                  </label>
                )}

                {/* Player list */}
                <div>
                  <div style={{ fontSize: '13px', fontWeight: 600, color: '#374151', marginBottom: 8 }}>
                    Players ({members.length})
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    {members.map(m => (
                      <div key={m.id} style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                        padding: '8px 12px', borderRadius: 8, background: '#f9fafb',
                      }}>
                        <span style={{ fontSize: '14px', fontWeight: 500, color: '#111827' }}>{memberName(m)}</span>
                        <span style={{ fontSize: '12px', color: '#9ca3af' }}>
                          HCP {memberHandicap(m) ?? '—'}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        {step === 3 && (
          <div style={{
            padding: '16px 28px', borderTop: '1px solid #e5e7eb',
            display: 'flex', justifyContent: 'flex-end', gap: 10,
          }}>
            <button onClick={onClose} style={BTN_OUTLINE}>Cancel</button>
            <button onClick={handleCreate} disabled={saving || !selectedGame} style={{
              ...BTN_GOLD,
              opacity: saving || !selectedGame ? 0.5 : 1,
            }}>
              {saving ? 'Creating…' : 'Create Game'}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── AI Suggestion Card ───────────────────────────────────────────────────────

function SuggestionCard({
  suggestion, onAccept,
}: {
  suggestion: AISuggestion
  onAccept:   (s: AISuggestion) => void
}) {
  const gameDef = GAMES_LIBRARY[suggestion.game]
  if (!gameDef) return null
  return (
    <div style={{
      ...CARD,
      padding: '18px 20px',
      border: '1.5px solid rgba(196,168,79,0.3)',
      background: 'rgba(196,168,79,0.03)',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <div style={{ fontWeight: 700, fontSize: '15px', color: '#111827' }}>
            {gameDef.name}
          </div>
          <div style={{ fontSize: '12px', color: 'var(--gold)', fontWeight: 500, marginTop: 2 }}>
            {suggestion.round} · {suggestion.suggestedStakes}
          </div>
        </div>
        <span style={{
          fontSize: '10px', fontWeight: 600, padding: '2px 8px', borderRadius: 20,
          background: difficultyColor(gameDef.difficulty) + '22',
          color: difficultyColor(gameDef.difficulty),
        }}>
          {gameDef.difficulty}
        </span>
      </div>
      <div style={{ fontSize: '13px', color: '#6b7280', marginTop: 8, lineHeight: 1.5 }}>
        {suggestion.reason}
      </div>
      <div style={{ marginTop: 12, display: 'flex', gap: 8 }}>
        <button onClick={() => onAccept(suggestion)} style={{ ...BTN_GOLD, padding: '7px 14px', fontSize: '12px' }}>
          Add This Game
        </button>
      </div>
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function GamesPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const { session } = useAuth()

  const [loading, setLoading]       = useState(true)
  const [trip, setTrip]             = useState<Trip | null>(null)
  const [members, setMembers]       = useState<Member[]>([])
  const [teeTimes, setTeeTimes]     = useState<TeeTime[]>([])
  const [games, setGames]           = useState<Game[]>([])
  const [scores, setScores]         = useState<Record<string, Score[]>>({})
  const [payouts, setPayouts]       = useState<Payout[]>([])
  const [showDrawer, setShowDrawer] = useState(false)
  const [activeTab, setActiveTab]   = useState('overview')
  const [mainTab, setMainTab]       = useState<'games' | 'ai' | 'cup'>('games')

  // AI suggestions
  const [suggestions, setSuggestions]       = useState<AISuggestion[]>([])
  const [suggestLoading, setSuggestLoading] = useState(false)

  // Delete confirmation
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const isOrganizer = trip?.created_by === session?.user?.id

  // ─── Fetch data ───────────────────────────────────────────────────────────

  const fetchData = useCallback(async () => {
    const [tripRes, membersRes, teeRes, gamesRes, payoutsRes] = await Promise.all([
      supabase.from('trips').select('*').eq('id', id).single(),
      supabase.from('trip_members').select('id, user_id, display_name, email, handicap, role, member_type').eq('trip_id', id),
      supabase.from('tee_times').select('id, course_name, course_id, tee_date').eq('trip_id', id).order('tee_date'),
      supabase.from('trip_games').select('*, game_pairings(*)').eq('trip_id', id).order('round_number'),
      supabase.from('game_payouts').select('*').eq('trip_id', id).order('created_at'),
    ])

    setTrip(tripRes.data)
    setMembers(membersRes.data ?? [])
    setTeeTimes(teeRes.data ?? [])
    setGames(gamesRes.error ? [] : gamesRes.data ?? [])
    setPayouts(payoutsRes.error ? [] : payoutsRes.data ?? [])

    // Fetch scores for each game
    const gameList = gamesRes.error ? [] : gamesRes.data ?? []
    const gameIds = gameList.map((g: Game) => g.id)
    if (gameIds.length > 0) {
      const scoresRes = await supabase
        .from('game_scores')
        .select('*')
        .in('game_id', gameIds)
      const grouped: Record<string, Score[]> = {}
      ;(scoresRes.data ?? []).forEach((s: Score) => {
        if (!grouped[s.game_id]) grouped[s.game_id] = []
        grouped[s.game_id].push(s)
      })
      setScores(grouped)
    }

    setLoading(false)
  }, [id])

  useEffect(() => { fetchData() }, [fetchData])

  // ─── AI Suggest ───────────────────────────────────────────────────────────

  async function handleSuggestGames() {
    setSuggestLoading(true)
    try {
      const res = await fetch(`/api/trips/${id}/suggest-games`, { method: 'POST' })
      const data = await res.json()
      if (Array.isArray(data)) setSuggestions(data)
    } catch { /* ignore */ }
    setSuggestLoading(false)
  }

  async function handleAcceptSuggestion(s: AISuggestion) {
    const roundNum = s.round.toLowerCase().includes('whole') ? 0
      : parseInt(s.round.replace(/\D/g, ''), 10) || 1

    await fetch(`/api/trips/${id}/games`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        round_number: roundNum,
        game_type: s.game,
        game_config: { ...s.config, grossOrNet: s.config?.grossOrNet ?? 'net' },
        stakes_per_unit: parseFloat(String(s.suggestedStakes).replace(/[^0-9.]/g, '')) || 0,
      }),
    })
    setSuggestions(prev => prev.filter(x => x !== s))
    fetchData()
  }

  // ─── Scores ───────────────────────────────────────────────────────────────

  async function handleSaveScores(gameId: string, entries: { player_id: string; gross_score: number; net_score: number }[]) {
    await fetch(`/api/trips/${id}/games/${gameId}/scores`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ scores: entries }),
    })
    fetchData()
  }

  // ─── Payouts ──────────────────────────────────────────────────────────────

  async function handleCalculatePayouts(gameId: string, entries: { from_player_id: string; to_player_id: string; amount: number; description: string }[]) {
    await fetch(`/api/trips/${id}/games/${gameId}/payouts`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ payouts: entries }),
    })
    fetchData()
  }

  async function handleSettle(payoutId: string, gameId: string) {
    await fetch(`/api/trips/${id}/games/${gameId}/payouts`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ payout_id: payoutId }),
    })
    fetchData()
  }

  // ─── Delete game ──────────────────────────────────────────────────────────

  async function handleDeleteGame(gameId: string) {
    await fetch(`/api/trips/${id}/games?game_id=${gameId}`, { method: 'DELETE' })
    setDeletingId(null)
    fetchData()
  }

  // ─── Navigation ───────────────────────────────────────────────────────────

  function handleNav(navId: string) {
    if (navId === 'games')    return
    if (navId === 'budget')   { router.push(`/trip/${id}/budget`);          return }
    if (navId === 'report')   { router.push(`/trip/${id}/report`);          return }
    if (navId === 'teetimes') { router.push(`/trip/${id}/tee-times`);       return }
    if (navId === 'hotels')   { router.push(`/trip/${id}/accommodations`);  return }
    if (navId === 'itinerary' || navId === 'group' || navId === 'concierge') {
      router.push(`/trip/${id}?tab=${navId}`)
      return
    }
    router.push(`/trip/${id}`)
  }

  // ─── Compute tabs ────────────────────────────────────────────────────────

  const roundNumbers = [...new Set(games.map(g => g.round_number))].sort((a, b) => a - b)

  const tabs: { id: string; label: string }[] = [
    { id: 'overview', label: 'Overview' },
    ...roundNumbers.filter(r => r > 0).map(r => {
      const teeTime = teeTimes[r - 1]
      return {
        id: `round-${r}`,
        label: teeTime ? `Round ${r} — ${teeTime.course_name}` : `Round ${r}`,
      }
    }),
  ]

  // ─── Running totals for overview ──────────────────────────────────────────

  const playerTotals: Record<string, number> = {}
  payouts.forEach(p => {
    if (!playerTotals[p.from_player_id]) playerTotals[p.from_player_id] = 0
    if (!playerTotals[p.to_player_id]) playerTotals[p.to_player_id] = 0
    playerTotals[p.from_player_id] -= p.amount
    playerTotals[p.to_player_id] += p.amount
  })

  // ─── Render ─────────────────────────────────────────────────────────────

  const hasGames = games.length > 0

  return (
    <ProtectedRoute>
      <div style={{
        display: 'flex', height: '100vh', overflow: 'hidden',
        fontFamily: 'var(--font-sans)',
      }}>
        {/* Sidebar */}
        {trip && (
          <Sidebar
            navItems={buildNavItems(members.length)}
            activeId="games"
            onItemClick={handleNav}
            tripName={trip.name}
            tripMeta={buildTripMeta(trip.start_date, trip.end_date, members.length)}
            groupName="The Crew"
          />
        )}

        {/* Main content */}
        <div style={{
          flex: 1, display: 'flex', flexDirection: 'column',
          overflow: 'hidden', background: '#f9fafb',
        }}>
          {loading ? (
            <div style={{
              flex: 1, display: 'flex', alignItems: 'center',
              justifyContent: 'center', color: '#9ca3af', fontSize: '14px',
            }}>
              Loading games…
            </div>
          ) : !trip ? (
            <div style={{
              flex: 1, display: 'flex', alignItems: 'center',
              justifyContent: 'center', color: '#9ca3af', fontSize: '14px',
            }}>
              Trip not found.
            </div>
          ) : (
            <>
              {/* Page header */}
              <div style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '22px 48px 0', flexShrink: 0,
              }}>
                <h2 style={{ fontSize: '20px', fontWeight: 700, color: '#111827', margin: 0 }}>
                  Golf Games
                </h2>
                {mainTab === 'games' && hasGames && (
                  <button onClick={() => setShowDrawer(true)} style={BTN_GOLD}>
                    + Add Game
                  </button>
                )}
              </div>

              {/* Main tab row — always visible */}
              <div style={{
                display: 'flex', gap: 0, padding: '16px 48px 0',
                borderBottom: '1px solid #e5e7eb', flexShrink: 0,
              }}>
                {([
                  { id: 'games' as const, icon: '🎲', label: 'Games' },
                  { id: 'ai'    as const, icon: '✦',  label: 'AI Suggest' },
                  { id: 'cup'   as const, icon: '🏆', label: 'The Cup' },
                ]).map(tab => (
                  <button
                    key={tab.id}
                    onClick={() => setMainTab(tab.id)}
                    style={{
                      padding: '10px 20px', fontSize: '13px', fontWeight: 500,
                      border: 'none', borderBottom: mainTab === tab.id ? '2px solid var(--gold)' : '2px solid transparent',
                      background: 'transparent', cursor: 'pointer',
                      color: mainTab === tab.id ? 'var(--gold)' : '#6b7280',
                      fontFamily: 'var(--font-sans)',
                      transition: 'color 0.15s, border-color 0.15s',
                      display: 'flex', alignItems: 'center', gap: 6,
                    }}
                  >
                    <span style={{ fontSize: '14px' }}>{tab.icon}</span> {tab.label}
                  </button>
                ))}
              </div>

              {/* Content area */}
              <div style={{ flex: 1, overflowY: 'auto', padding: '24px 48px 48px' }}>

                {/* ═══ GAMES TAB ═══ */}
                {mainTab === 'games' && (
                  <>
                    {/* Empty state */}
                    {!hasGames && suggestions.length === 0 && (
                      <div style={{ textAlign: 'center', padding: '48px 32px', maxWidth: 480, margin: '0 auto' }}>
                        <div style={{ fontSize: '48px', marginBottom: 12 }}>🎲</div>
                        <div style={{ fontWeight: 700, fontSize: '17px', color: '#111827', marginBottom: 6 }}>
                          Set Up Your Games
                        </div>
                        <div style={{ fontSize: '13px', color: '#9ca3af', lineHeight: 1.6, marginBottom: 20 }}>
                          Choose from skins, Nassau, scrambles, and more.
                          Configure stakes, pairings, and track scores all in one place.
                        </div>
                        <button onClick={() => setShowDrawer(true)} style={BTN_GOLD}>
                          + Add Game
                        </button>
                      </div>
                    )}

                    {/* Sub-tab row for rounds */}
                    {hasGames && tabs.length > 1 && (
                      <div style={{
                        display: 'flex', gap: 0, marginBottom: 20,
                        borderBottom: '1px solid #f3f4f6',
                      }}>
                        {tabs.map(tab => (
                          <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id)}
                            style={{
                              padding: '8px 16px', fontSize: '12px', fontWeight: 500,
                              border: 'none', borderBottom: activeTab === tab.id ? '2px solid var(--green-deep, #1a2e1a)' : '2px solid transparent',
                              background: 'transparent', cursor: 'pointer',
                              color: activeTab === tab.id ? '#111827' : '#9ca3af',
                              fontFamily: 'var(--font-sans)',
                            }}
                          >
                            {tab.label}
                          </button>
                        ))}
                      </div>
                    )}

                {/* Overview tab */}
                {hasGames && activeTab === 'overview' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
                    {/* Running totals */}
                    {Object.keys(playerTotals).length > 0 && (
                      <div style={CARD}>
                        <div style={CARD_HEADER}>Running Totals</div>
                        <div style={{ padding: '16px 24px' }}>
                          {members.filter(m => m.user_id && playerTotals[m.user_id] !== undefined).map(m => {
                            const total = playerTotals[m.user_id!] ?? 0
                            return (
                              <div key={m.id} style={{
                                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                                padding: '8px 0', borderBottom: '1px solid #f3f4f6',
                              }}>
                                <span style={{ fontSize: '14px', fontWeight: 500, color: '#111827' }}>
                                  {memberName(m)}
                                </span>
                                <span style={{
                                  fontSize: '15px', fontWeight: 700,
                                  color: total > 0 ? '#059669' : total < 0 ? '#dc2626' : '#6b7280',
                                }}>
                                  {total > 0 ? '+' : ''}{fmtAmount(total)}
                                </span>
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    )}

                    {/* Settle up */}
                    {payouts.filter(p => p.status === 'pending').length > 0 && (
                      <PayoutSummary
                        payouts={payouts.filter(p => p.status === 'pending')}
                        members={members}
                        onSettle={(payoutId) => {
                          const p = payouts.find(x => x.id === payoutId)
                          if (p) handleSettle(payoutId, p.game_id ?? '')
                        }}
                      />
                    )}

                    {/* All games list */}
                    <div style={CARD}>
                      <div style={CARD_HEADER}>All Games</div>
                      <div style={{ padding: '12px 24px' }}>
                        {games.map(g => {
                          const gameDef = GAMES_LIBRARY[g.game_type]
                          const teeTime = teeTimes[g.round_number - 1]
                          const isConfirming = deletingId === g.id
                          return (
                            <div key={g.id} style={{
                              display: 'flex', alignItems: 'center', gap: 12,
                              padding: '12px 0', borderBottom: '1px solid #f3f4f6',
                            }}>
                              <div style={{ flex: 1 }}>
                                <div style={{ fontWeight: 600, fontSize: '14px', color: '#111827' }}>
                                  {gameDef?.name ?? g.game_type}
                                </div>
                                <div style={{ fontSize: '12px', color: '#9ca3af', marginTop: 2 }}>
                                  {g.round_number === 0
                                    ? 'Trip-Wide'
                                    : teeTime
                                      ? `Round ${g.round_number} — ${teeTime.course_name}`
                                      : `Round ${g.round_number}`}
                                  {g.stakes_per_unit > 0 && ` · ${fmt(g.stakes_per_unit)}/unit`}
                                </div>
                              </div>
                              <span style={{
                                fontSize: '11px', fontWeight: 600, padding: '3px 10px', borderRadius: 20,
                                background: g.status === 'complete' ? '#d1fae5' : g.status === 'active' ? '#fef3c7' : '#f3f4f6',
                                color: g.status === 'complete' ? '#059669' : g.status === 'active' ? '#d97706' : '#6b7280',
                              }}>
                                {g.status}
                              </span>
                              {isOrganizer && (
                                <div style={{ flexShrink: 0 }}>
                                  {isConfirming ? (
                                    <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                                      <span style={{ fontSize: '12px', color: '#6b7280' }}>Remove?</span>
                                      <button
                                        onClick={() => handleDeleteGame(g.id)}
                                        style={{ fontSize: '12px', color: '#dc2626', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 700 }}
                                      >
                                        Yes
                                      </button>
                                      <button
                                        onClick={() => setDeletingId(null)}
                                        style={{ fontSize: '12px', color: '#9ca3af', background: 'none', border: 'none', cursor: 'pointer' }}
                                      >
                                        No
                                      </button>
                                    </div>
                                  ) : (
                                    <button
                                      onClick={() => setDeletingId(g.id)}
                                      title="Remove game"
                                      style={{
                                        fontSize: '18px', color: '#d1d5db', background: 'none', border: 'none',
                                        cursor: 'pointer', lineHeight: 1, padding: '0 4px',
                                      }}
                                    >
                                      ×
                                    </button>
                                  )}
                                </div>
                              )}
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  </div>
                )}

                {/* Per-round tab */}
                {hasGames && activeTab.startsWith('round-') && (() => {
                  const roundNum = parseInt(activeTab.replace('round-', ''), 10)
                  const roundGames = games.filter(g => g.round_number === roundNum)
                  const teeTime = teeTimes[roundNum - 1]

                  return (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
                      {/* Round header */}
                      {teeTime && (
                        <div style={{ fontSize: '14px', color: '#6b7280' }}>
                          {teeTime.course_name} · {formatTeeDate(teeTime.tee_date)}
                        </div>
                      )}

                      {roundGames.length === 0 ? (
                        <div style={{
                          textAlign: 'center', padding: '48px 0', color: '#9ca3af',
                        }}>
                          <div style={{ fontSize: '14px', marginBottom: 12 }}>No games set up for this round yet.</div>
                          <button onClick={() => setShowDrawer(true)} style={BTN_GOLD}>
                            + Add Game
                          </button>
                        </div>
                      ) : (
                        roundGames.map(game => {
                          const gameDef = GAMES_LIBRARY[game.game_type]
                          const gameScores = scores[game.id] ?? []
                          const gamePayouts = payouts.filter(p => p.game_id === game.id)

                          return (
                            <div key={game.id} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                              {/* Game info */}
                              <div style={CARD}>
                                <div style={{
                                  ...CARD_HEADER,
                                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                                }}>
                                  <span>{gameDef?.name ?? game.game_type}</span>
                                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                                    {game.stakes_per_unit > 0 && (
                                      <span style={{ fontSize: '12px', fontWeight: 500, color: 'var(--gold)' }}>
                                        {fmt(game.stakes_per_unit)}/unit
                                      </span>
                                    )}
                                    <span style={{
                                      fontSize: '10px', fontWeight: 600, padding: '2px 8px', borderRadius: 20,
                                      background: (game.game_config as Record<string, unknown>)?.grossOrNet === 'gross' ? '#e0e7ff' : '#ecfdf5',
                                      color: (game.game_config as Record<string, unknown>)?.grossOrNet === 'gross' ? '#4338ca' : '#059669',
                                    }}>
                                      {(game.game_config as Record<string, unknown>)?.grossOrNet === 'gross' ? 'Gross' : 'Net'}
                                    </span>
                                  </div>
                                </div>

                                {/* Pairings */}
                                {game.game_pairings.length > 0 && (
                                  <div style={{ padding: '16px 24px', borderBottom: '1px solid #f3f4f6' }}>
                                    <div style={{ fontSize: '11px', fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 10 }}>
                                      Teams / Pairings
                                    </div>
                                    <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
                                      {game.game_pairings.map(p => (
                                        <div key={p.id} style={{
                                          padding: '10px 14px', borderRadius: 8, background: '#f9fafb',
                                          border: '1px solid #f3f4f6', minWidth: 140,
                                        }}>
                                          <div style={{ fontSize: '12px', fontWeight: 700, color: '#6b7280', marginBottom: 6 }}>
                                            {p.team_name ?? `Team ${p.team_number}`}
                                          </div>
                                          {p.player_ids.map(pid => {
                                            const m = members.find(m => m.user_id === pid)
                                            return (
                                              <div key={pid} style={{ fontSize: '13px', color: '#111827', padding: '2px 0' }}>
                                                {m ? memberName(m) : pid.slice(0, 8)}
                                              </div>
                                            )
                                          })}
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                )}

                                {/* Score entry */}
                                <div style={{ padding: '16px 24px' }}>
                                  <div style={{ fontSize: '11px', fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 10 }}>
                                    Score Entry
                                  </div>
                                  <ScoreEntryTable
                                    game={game}
                                    members={members}
                                    scores={gameScores}
                                    onSave={(entries) => handleSaveScores(game.id, entries)}
                                  />
                                </div>
                              </div>

                              {/* Results */}
                              {gameScores.length > 0 && (
                                <ResultsCard
                                  game={game}
                                  members={members}
                                  scores={gameScores}
                                  onCalculate={(entries) => handleCalculatePayouts(game.id, entries)}
                                />
                              )}

                              {/* Payouts for this game */}
                              {gamePayouts.length > 0 && (
                                <PayoutSummary
                                  payouts={gamePayouts}
                                  members={members}
                                  onSettle={(payoutId) => handleSettle(payoutId, game.id)}
                                />
                              )}
                            </div>
                          )
                        })
                      )}
                    </div>
                  )
                })()}
                  </>
                )}

                {/* ═══ AI SUGGEST TAB ═══ */}
                {mainTab === 'ai' && (
                  <div>
                    {suggestions.length === 0 ? (
                      <div style={{ textAlign: 'center', padding: '48px 32px', maxWidth: 480, margin: '0 auto' }}>
                        <div style={{ fontSize: '48px', marginBottom: 12 }}>✦</div>
                        <div style={{ fontWeight: 700, fontSize: '17px', color: '#111827', marginBottom: 6 }}>
                          AI Game Suggestions
                        </div>
                        <div style={{ fontSize: '13px', color: '#9ca3af', lineHeight: 1.6, marginBottom: 20 }}>
                          Based on your group size, handicaps, and trip schedule,
                          we&apos;ll recommend the perfect game combination.
                        </div>
                        <button
                          onClick={handleSuggestGames}
                          disabled={suggestLoading}
                          style={{
                            ...BTN_GOLD,
                            opacity: suggestLoading ? 0.6 : 1,
                          }}
                        >
                          {suggestLoading ? 'Thinking…' : '✦ Suggest Games for Our Group'}
                        </button>
                      </div>
                    ) : (
                      <div>
                        <div style={{
                          fontSize: '14px', fontWeight: 700, color: '#111827', marginBottom: 12,
                          display: 'flex', alignItems: 'center', gap: 8,
                        }}>
                          <span style={{ color: 'var(--gold)' }}>✦</span> AI Suggestions
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 12 }}>
                          {suggestions.map((s, i) => (
                            <SuggestionCard key={i} suggestion={s} onAccept={handleAcceptSuggestion} />
                          ))}
                        </div>
                        <div style={{ marginTop: 16 }}>
                          <button
                            onClick={handleSuggestGames}
                            disabled={suggestLoading}
                            style={{ ...BTN_OUTLINE, fontSize: '12px', padding: '7px 14px' }}
                          >
                            {suggestLoading ? 'Thinking…' : 'Refresh Suggestions'}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* ═══ THE CUP TAB ═══ */}
                {mainTab === 'cup' && trip && (
                  <TheCup
                    tripId={id}
                    tripName={trip.name}
                    members={members}
                    teeTimes={teeTimes}
                    isOrganizer={isOrganizer}
                  />
                )}

              </div>
            </>
          )}
        </div>

        {/* Add Game Drawer */}
        {showDrawer && (
          <AddGameDrawer
            teeTimes={teeTimes}
            members={members}
            tripId={id}
            onClose={() => setShowDrawer(false)}
            onCreated={() => fetchData()}
          />
        )}
      </div>
    </ProtectedRoute>
  )
}
