'use client'

import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'

// ─── Types ────────────────────────────────────────────────────────────────────

interface PollVote {
  id:         string
  member_id:  number
  rank:       number | null
  comment:    string | null
  created_at: string
}

interface PollOption {
  id:           string
  poll_id:      string
  label:        string
  description:  string | null
  course_id:    string | null
  option_order: number
  poll_votes:   PollVote[]
}

interface Poll {
  id:                        string
  trip_id:                   string
  created_by:                string
  question:                  string
  category:                  'courses' | 'dates' | 'accommodation' | 'dining' | 'activities' | 'games' | 'custom'
  vote_type:                 'pick_one' | 'pick_multiple' | 'rank'
  max_selections:            number
  show_results_before_close: boolean
  allow_comments:            boolean
  deadline:                  string | null
  status:                    'active' | 'closed'
  created_at:                string
  poll_options:              PollOption[]
}

interface TripMember {
  id:       number
  user_id:  string | null
  role?:    string
  display_name?: string | null
  users?: { full_name: string | null; email: string | null } | null
}

interface Props {
  tripId:        string
  members:       TripMember[]
  isOrganizer:   boolean
  currentUserId: string | undefined
}

// ─── Constants ────────────────────────────────────────────────────────────────

const CATEGORY_ICONS: Record<string, string> = {
  courses:       '⛳',
  dates:         '📅',
  accommodation: '🏨',
  dining:        '🍽️',
  activities:    '🎣',
  games:         '🎲',
  custom:        '🗳️',
}

const CATEGORY_LABELS: Record<string, string> = {
  courses:       'Courses',
  dates:         'Dates',
  accommodation: 'Accommodation',
  dining:        'Dining',
  activities:    'Activities',
  games:         'Game Format',
  custom:        'Custom',
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDeadline(deadline: string | null): string | null {
  if (!deadline) return null
  const d = new Date(deadline)
  const now = new Date()
  const diff = d.getTime() - now.getTime()
  if (diff < 0) return 'Closed'
  if (diff < 24 * 60 * 60 * 1000) return `Closes today at ${d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
  return `Closes ${d.toLocaleDateString([], { month: 'short', day: 'numeric' })}`
}

function getMemberName(m: TripMember): string {
  return m.users?.full_name ?? m.display_name ?? m.users?.email ?? `Member ${m.id}`
}

// ─── CreatePollModal ──────────────────────────────────────────────────────────

function CreatePollModal({
  tripId,
  currentUserId,
  onCreated,
  onClose,
}: {
  tripId:        string
  currentUserId: string | undefined
  onCreated:     (poll: Poll) => void
  onClose:       () => void
}) {
  const [question,     setQuestion]     = useState('')
  const [category,     setCategory]     = useState<Poll['category']>('custom')
  const [voteType,     setVoteType]     = useState<Poll['vote_type']>('pick_one')
  const [maxSel,       setMaxSel]       = useState(2)
  const [showEarly,    setShowEarly]    = useState(true)
  const [allowComment, setAllowComment] = useState(true)
  const [deadline,     setDeadline]     = useState('')
  const [options,      setOptions]      = useState(['', ''])
  const [saving,       setSaving]       = useState(false)
  const [err,          setErr]          = useState('')

  function addOption() {
    if (options.length < 6) setOptions([...options, ''])
  }
  function removeOption(i: number) {
    if (options.length > 2) setOptions(options.filter((_, idx) => idx !== i))
  }
  function setOption(i: number, val: string) {
    setOptions(options.map((o, idx) => idx === i ? val : o))
  }

  async function handleSubmit() {
    setErr('')
    if (!question.trim()) { setErr('Question is required.'); return }
    const filled = options.filter(o => o.trim())
    if (filled.length < 2) { setErr('At least 2 options are required.'); return }

    setSaving(true)
    try {
      // Insert poll
      const { data: poll, error: pollErr } = await supabase
        .from('trip_polls')
        .insert({
          trip_id:                   tripId,
          created_by:                currentUserId,
          question:                  question.trim(),
          category,
          vote_type:                 voteType,
          max_selections:            voteType === 'pick_multiple' ? maxSel : 1,
          show_results_before_close: showEarly,
          allow_comments:            allowComment,
          deadline:                  deadline || null,
          status:                    'active',
        })
        .select()
        .single()

      if (pollErr || !poll) throw pollErr ?? new Error('Failed to create poll')

      // Insert options
      const { error: optErr } = await supabase
        .from('poll_options')
        .insert(
          filled.map((label, i) => ({
            poll_id:      poll.id,
            label:        label.trim(),
            option_order: i,
          }))
        )
      if (optErr) throw optErr

      // Refetch the full poll with options
      const { data: full } = await supabase
        .from('trip_polls')
        .select('*, poll_options(id, label, description, course_id, option_order, poll_votes(id, member_id, rank, comment, created_at))')
        .eq('id', poll.id)
        .single()

      onCreated(full as Poll)
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : 'Something went wrong.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div
      style={{
        position:       'fixed', inset: 0, zIndex: 100,
        background:     'rgba(0,0,0,0.45)',
        display:        'flex', alignItems: 'center', justifyContent: 'center',
        padding:        '24px',
      }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div
        style={{
          background:    'var(--white)',
          borderRadius:  'var(--radius-lg)',
          padding:       '32px',
          width:         '100%',
          maxWidth:      '520px',
          maxHeight:     '90vh',
          overflowY:     'auto',
          boxShadow:     '0 8px 40px rgba(0,0,0,0.18)',
        }}
      >
        <div style={{ fontFamily: 'var(--font-serif)', fontSize: '20px', color: 'var(--green-deep)', marginBottom: '24px', fontWeight: 600 }}>
          New Poll
        </div>

        {/* Question */}
        <label style={labelStyle}>Question</label>
        <input
          value={question}
          onChange={e => setQuestion(e.target.value)}
          placeholder="e.g. Which courses should we play?"
          style={inputStyle}
        />

        {/* Category */}
        <label style={labelStyle}>Category</label>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '20px' }}>
          {(Object.keys(CATEGORY_LABELS) as Poll['category'][]).map(cat => (
            <button
              key={cat}
              onClick={() => setCategory(cat)}
              style={{
                padding:       '6px 14px',
                borderRadius:  '99px',
                border:        `1px solid ${category === cat ? 'var(--green-mid)' : 'var(--cream-dark)'}`,
                background:    category === cat ? 'var(--green-deep)' : 'var(--cream)',
                color:         category === cat ? 'var(--gold-light)' : 'var(--text-mid)',
                fontSize:      '12px',
                fontWeight:    500,
                cursor:        'pointer',
                fontFamily:    'var(--font-sans)',
              }}
            >
              {CATEGORY_ICONS[cat]} {CATEGORY_LABELS[cat]}
            </button>
          ))}
        </div>

        {/* Vote type */}
        <label style={labelStyle}>Voting Style</label>
        <div style={{ display: 'flex', gap: '10px', marginBottom: '20px' }}>
          {[
            { val: 'pick_one',      label: 'Pick one' },
            { val: 'pick_multiple', label: 'Pick multiple' },
            { val: 'rank',          label: 'Rank top 3' },
          ].map(({ val, label }) => (
            <button
              key={val}
              onClick={() => setVoteType(val as Poll['vote_type'])}
              style={{
                flex:          1,
                padding:       '8px 4px',
                borderRadius:  'var(--radius-sm)',
                border:        `1px solid ${voteType === val ? 'var(--green-mid)' : 'var(--cream-dark)'}`,
                background:    voteType === val ? 'var(--green-deep)' : 'var(--cream)',
                color:         voteType === val ? 'var(--gold-light)' : 'var(--text-mid)',
                fontSize:      '12px',
                fontWeight:    500,
                cursor:        'pointer',
                fontFamily:    'var(--font-sans)',
              }}
            >
              {label}
            </button>
          ))}
        </div>

        {voteType === 'pick_multiple' && (
          <div style={{ marginBottom: '20px' }}>
            <label style={labelStyle}>Max selections per person</label>
            <input
              type="number" min={2} max={6}
              value={maxSel}
              onChange={e => setMaxSel(parseInt(e.target.value) || 2)}
              style={{ ...inputStyle, width: '80px' }}
            />
          </div>
        )}

        {/* Options */}
        <label style={labelStyle}>Options</label>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '8px' }}>
          {options.map((opt, i) => (
            <div key={i} style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <input
                value={opt}
                onChange={e => setOption(i, e.target.value)}
                placeholder={`Option ${i + 1}`}
                style={{ ...inputStyle, marginBottom: 0, flex: 1 }}
              />
              {options.length > 2 && (
                <button
                  onClick={() => removeOption(i)}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-light)', fontSize: '16px', padding: '0 4px' }}
                >
                  ×
                </button>
              )}
            </div>
          ))}
        </div>
        {options.length < 6 && (
          <button
            onClick={addOption}
            style={{ fontSize: '12px', color: 'var(--green-mid)', background: 'none', border: 'none', cursor: 'pointer', marginBottom: '20px', fontFamily: 'var(--font-sans)', fontWeight: 500 }}
          >
            + Add option
          </button>
        )}

        {/* Deadline */}
        <label style={labelStyle}>Deadline (optional)</label>
        <input
          type="datetime-local"
          value={deadline}
          onChange={e => setDeadline(e.target.value)}
          style={{ ...inputStyle }}
        />

        {/* Toggles */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '24px' }}>
          <ToggleRow
            label="Show results before poll closes"
            checked={showEarly}
            onChange={setShowEarly}
          />
          <ToggleRow
            label="Allow comments with votes"
            checked={allowComment}
            onChange={setAllowComment}
          />
        </div>

        {err && <div style={{ color: '#c0392b', fontSize: '12px', marginBottom: '12px' }}>{err}</div>}

        <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
          <button onClick={onClose} style={secondaryBtnStyle}>Cancel</button>
          <button onClick={handleSubmit} disabled={saving} style={primaryBtnStyle}>
            {saving ? 'Creating…' : 'Create Poll'}
          </button>
        </div>
      </div>
    </div>
  )
}

function ToggleRow({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px' }}>
      <span style={{ fontSize: '13px', color: 'var(--text-mid)', fontFamily: 'var(--font-sans)' }}>{label}</span>
      <div
        onClick={() => onChange(!checked)}
        style={{
          width:        '40px', height: '22px',
          borderRadius: '99px',
          background:   checked ? 'var(--green-mid)' : 'var(--cream-dark)',
          position:     'relative',
          cursor:       'pointer',
          flexShrink:   0,
          transition:   'background 0.2s',
        }}
      >
        <div style={{
          position:   'absolute',
          top:        '3px',
          left:       checked ? '21px' : '3px',
          width:      '16px', height: '16px',
          borderRadius: '50%',
          background:   'white',
          transition:   'left 0.2s',
          boxShadow:    '0 1px 3px rgba(0,0,0,0.2)',
        }} />
      </div>
    </div>
  )
}

// ─── PollCard ─────────────────────────────────────────────────────────────────

function PollCard({
  poll,
  currentMemberId,
  members,
  isOrganizer,
  onClose,
  onApply,
  onVote,
}: {
  poll:            Poll
  currentMemberId: number | undefined
  members:         TripMember[]
  isOrganizer:     boolean
  onClose:         (pollId: string) => void
  onApply:         (poll: Poll) => void
  onVote:          (pollId: string, optionIds: string[], comment: string) => Promise<void>
}) {
  const [selected,  setSelected]  = useState<string[]>([])
  const [rankOrder, setRankOrder] = useState<string[]>([])
  const [comment,   setComment]   = useState('')
  const [voting,    setVoting]    = useState(false)
  const [expanded,  setExpanded]  = useState(false)

  const sortedOptions = [...poll.poll_options].sort((a, b) => a.option_order - b.option_order)
  const totalVoters   = members.filter(m => m.user_id !== null).length
  const totalVotes    = new Set(
    sortedOptions.flatMap(o => o.poll_votes.map(v => v.member_id))
  ).size

  const hasVoted = currentMemberId != null && sortedOptions.some(
    o => o.poll_votes.some(v => v.member_id === currentMemberId)
  )

  const canSeeResults = hasVoted || poll.status === 'closed' || poll.show_results_before_close
  const maxVotesOnOption = Math.max(...sortedOptions.map(o => o.poll_votes.length), 1)

  const deadlineLabel = formatDeadline(poll.deadline)

  function toggleOption(id: string) {
    if (poll.vote_type === 'pick_one') {
      setSelected([id])
    } else if (poll.vote_type === 'pick_multiple') {
      if (selected.includes(id)) {
        setSelected(selected.filter(s => s !== id))
      } else if (selected.length < poll.max_selections) {
        setSelected([...selected, id])
      }
    } else {
      // rank
      if (rankOrder.includes(id)) {
        setRankOrder(rankOrder.filter(r => r !== id))
      } else if (rankOrder.length < 3) {
        setRankOrder([...rankOrder, id])
      }
    }
  }

  async function handleVote() {
    const ids = poll.vote_type === 'rank' ? rankOrder : selected
    if (ids.length === 0) return
    setVoting(true)
    await onVote(poll.id, ids, comment)
    setVoting(false)
    setSelected([])
    setRankOrder([])
    setComment('')
  }

  const voterNames = (optionId: string) => {
    const option = sortedOptions.find(o => o.id === optionId)
    if (!option) return []
    return option.poll_votes.map(v => {
      const member = members.find(m => m.id === v.member_id)
      return member ? getMemberName(member) : 'Unknown'
    })
  }

  return (
    <div
      style={{
        background:    'var(--white)',
        border:        '1px solid var(--cream-dark)',
        borderRadius:  'var(--radius-lg)',
        padding:       '24px',
        boxShadow:     'var(--shadow-subtle)',
      }}
    >
      {/* Header row */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '16px' }}>
        <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-start', flex: 1 }}>
          <div style={{
            fontSize: '9px', letterSpacing: '0.2em', textTransform: 'uppercase',
            color: 'var(--green-muted)', fontWeight: 600,
            background: 'var(--cream)', padding: '4px 10px', borderRadius: '99px',
            border: '1px solid var(--cream-dark)', whiteSpace: 'nowrap', marginTop: '2px',
          }}>
            {CATEGORY_ICONS[poll.category]} {CATEGORY_LABELS[poll.category]}
          </div>
          <div style={{ fontFamily: 'var(--font-serif)', fontSize: '16px', color: 'var(--green-deep)', fontWeight: 600, lineHeight: 1.3 }}>
            {poll.question}
          </div>
        </div>
        {poll.status === 'closed' && (
          <span style={{ fontSize: '10px', letterSpacing: '0.15em', textTransform: 'uppercase', color: 'var(--text-light)', background: 'var(--cream-dark)', padding: '3px 8px', borderRadius: '99px', flexShrink: 0, marginLeft: '12px' }}>
            Closed
          </span>
        )}
      </div>

      {/* Options: voting or results */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '16px' }}>
        {sortedOptions.map(option => {
          const voteCount  = option.poll_votes.length
          const pct        = totalVotes > 0 ? (voteCount / maxVotesOnOption) * 100 : 0
          const isWinner   = poll.status === 'closed' && voteCount === maxVotesOnOption && voteCount > 0
          const isSelected = selected.includes(option.id)
          const rankPos    = rankOrder.indexOf(option.id)
          const myVote     = option.poll_votes.find(v => v.member_id === currentMemberId)

          if (canSeeResults || hasVoted) {
            // Results view
            return (
              <div key={option.id}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '4px' }}>
                  {isWinner && <span style={{ fontSize: '13px' }}>👑</span>}
                  <span style={{ fontSize: '13px', color: 'var(--text-dark)', fontWeight: isWinner ? 600 : 300, flex: 1 }}>
                    {option.label}
                    {myVote && <span style={{ fontSize: '11px', color: 'var(--green-muted)', marginLeft: '8px' }}>✓ You voted</span>}
                  </span>
                  <span style={{ fontSize: '12px', color: 'var(--text-mid)', fontWeight: 500, minWidth: '48px', textAlign: 'right' }}>
                    {voteCount} {voteCount === 1 ? 'vote' : 'votes'}
                  </span>
                </div>
                <div style={{ height: '6px', background: 'var(--cream-dark)', borderRadius: '99px', overflow: 'hidden' }}>
                  <div style={{
                    height: '100%', width: `${pct}%`,
                    background: isWinner ? 'var(--gold)' : 'var(--green-light)',
                    borderRadius: '99px',
                    transition: 'width 0.4s ease',
                  }} />
                </div>
                {/* Who voted expandable */}
                {expanded && voteCount > 0 && (
                  <div style={{ fontSize: '11px', color: 'var(--text-light)', marginTop: '4px', paddingLeft: '4px' }}>
                    {voterNames(option.id).join(', ')}
                  </div>
                )}
              </div>
            )
          } else {
            // Voting view
            const isRanked = poll.vote_type === 'rank'
            return (
              <button
                key={option.id}
                onClick={() => toggleOption(option.id)}
                style={{
                  padding:       '10px 16px',
                  borderRadius:  'var(--radius-sm)',
                  border:        `1.5px solid ${isSelected || rankPos >= 0 ? 'var(--green-mid)' : 'var(--cream-dark)'}`,
                  background:    isSelected || rankPos >= 0 ? 'rgba(45,74,45,0.06)' : 'var(--cream)',
                  cursor:        'pointer',
                  textAlign:     'left',
                  display:       'flex',
                  alignItems:    'center',
                  justifyContent:'space-between',
                  fontFamily:    'var(--font-sans)',
                  fontSize:      '13px',
                  color:         'var(--text-dark)',
                  fontWeight:    isSelected || rankPos >= 0 ? 500 : 300,
                  transition:    'all 0.15s',
                }}
              >
                <span>{option.label}</span>
                {isRanked && rankPos >= 0 && (
                  <span style={{
                    width: '22px', height: '22px', borderRadius: '50%',
                    background: 'var(--green-deep)', color: 'var(--gold-light)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: '11px', fontWeight: 700, flexShrink: 0,
                  }}>
                    {rankPos + 1}
                  </span>
                )}
                {!isRanked && isSelected && (
                  <span style={{ color: 'var(--green-mid)', fontSize: '14px' }}>✓</span>
                )}
              </button>
            )
          }
        })}
      </div>

      {/* Comment input (if allowed and not yet voted) */}
      {poll.allow_comments && !hasVoted && poll.status === 'active' && (
        <textarea
          value={comment}
          onChange={e => setComment(e.target.value)}
          placeholder="Add a comment (optional)…"
          rows={1}
          style={{
            width: '100%', boxSizing: 'border-box',
            border: '1px solid var(--cream-dark)', borderRadius: 'var(--radius-sm)',
            background: 'var(--cream)', padding: '8px 12px',
            fontSize: '13px', fontFamily: 'var(--font-sans)', fontWeight: 300,
            color: 'var(--text-dark)', resize: 'vertical', outline: 'none',
            marginBottom: '12px',
          }}
        />
      )}

      {/* Footer row */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px' }}>
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '12px', color: 'var(--text-light)', fontWeight: 300 }}>
            {totalVotes} of {totalVoters} voted
            {poll.vote_type === 'pick_multiple' && ` · Pick up to ${poll.max_selections}`}
            {poll.vote_type === 'rank' && ' · Rank top 3'}
          </span>
          {deadlineLabel && (
            <span style={{ fontSize: '12px', color: poll.status === 'closed' ? 'var(--text-light)' : 'var(--gold)', fontWeight: 500 }}>
              {deadlineLabel}
            </span>
          )}
          {canSeeResults && totalVotes > 0 && (
            <button
              onClick={() => setExpanded(!expanded)}
              style={{ fontSize: '11px', color: 'var(--green-muted)', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'var(--font-sans)', padding: 0 }}
            >
              {expanded ? 'Hide' : 'Show'} who voted
            </button>
          )}
        </div>

        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          {/* Vote button */}
          {!hasVoted && poll.status === 'active' && (
            <button
              onClick={handleVote}
              disabled={voting || (poll.vote_type === 'rank' ? rankOrder.length === 0 : selected.length === 0)}
              style={{
                padding:    '7px 18px',
                borderRadius: 'var(--radius-sm)',
                background: voting || (poll.vote_type === 'rank' ? rankOrder.length === 0 : selected.length === 0)
                  ? 'var(--cream-dark)' : 'var(--gold)',
                color:      voting || (poll.vote_type === 'rank' ? rankOrder.length === 0 : selected.length === 0)
                  ? 'var(--text-light)' : 'var(--green-deep)',
                border:     'none',
                fontSize:   '11px',
                fontWeight: 700,
                letterSpacing: '0.06em',
                textTransform: 'uppercase',
                cursor:     voting || (poll.vote_type === 'rank' ? rankOrder.length === 0 : selected.length === 0) ? 'default' : 'pointer',
                fontFamily: 'var(--font-sans)',
                transition: 'all 0.15s',
              }}
            >
              {voting ? 'Voting…' : 'Submit Vote'}
            </button>
          )}

          {hasVoted && (
            <span style={{ fontSize: '12px', color: 'var(--green-muted)', fontWeight: 500 }}>✓ Voted</span>
          )}

          {/* Organizer actions */}
          {isOrganizer && poll.status === 'active' && (
            <button
              onClick={() => onClose(poll.id)}
              style={ghostBtnStyle}
            >
              Close Poll
            </button>
          )}
          {isOrganizer && poll.status === 'closed' && poll.category === 'courses' && (
            <button
              onClick={() => onApply(poll)}
              style={primaryBtnStyle}
            >
              Apply to Trip →
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Main section ─────────────────────────────────────────────────────────────

export default function GroupDecisionsSection({ tripId, members, isOrganizer, currentUserId }: Props) {
  const [polls,    setPolls]    = useState<Poll[]>([])
  const [loading,  setLoading]  = useState(true)
  const [creating, setCreating] = useState(false)

  const currentMember = members.find(m => m.user_id === currentUserId)

  const loadPolls = useCallback(async () => {
    const { data } = await supabase
      .from('trip_polls')
      .select(`
        *,
        poll_options (
          id, label, description, course_id, option_order,
          poll_votes (id, member_id, rank, comment, created_at)
        )
      `)
      .eq('trip_id', tripId)
      .order('created_at', { ascending: false })

    setPolls((data ?? []) as Poll[])
    setLoading(false)
  }, [tripId])

  useEffect(() => { loadPolls() }, [loadPolls])

  async function handleVote(pollId: string, optionIds: string[], comment: string) {
    if (!currentMember) return
    // Delete any prior votes on this poll
    await supabase.from('poll_votes').delete()
      .eq('poll_id', pollId)
      .eq('member_id', currentMember.id)

    const rows = optionIds.map((optionId, i) => ({
      poll_id:   pollId,
      option_id: optionId,
      member_id: currentMember.id,
      rank:      optionIds.length > 1 ? i + 1 : null,
      comment:   comment.trim() || null,
    }))

    await supabase.from('poll_votes').insert(rows)
    await loadPolls()
  }

  async function handleClosePoll(pollId: string) {
    await supabase.from('trip_polls').update({ status: 'closed' }).eq('id', pollId)
    setPolls(prev => prev.map(p => p.id === pollId ? { ...p, status: 'closed' } : p))
  }

  async function handleApplyToTrip(poll: Poll) {
    // Find winning option (most votes)
    const sorted = [...poll.poll_options].sort((a, b) => b.poll_votes.length - a.poll_votes.length)
    const winner = sorted[0]
    if (!winner) return

    if (winner.course_id) {
      // Link existing course from DB
      await supabase.from('trip_courses').insert({
        trip_id:   tripId,
        course_id: winner.course_id,
      })
    } else {
      // Store as name-only entry
      await supabase.from('trip_courses').insert({
        trip_id:         tripId,
        course_name:     winner.label,
        course_location: '',
      })
    }
  }

  const activePolls = polls.filter(p => p.status === 'active')
  const closedPolls = polls.filter(p => p.status === 'closed')

  if (loading) {
    return <div style={{ padding: '40px', textAlign: 'center', fontSize: '13px', color: 'var(--text-light)' }}>Loading polls…</div>
  }

  return (
    <div style={{ maxWidth: '680px' }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '28px' }}>
        <div>
          <div style={{ fontFamily: 'var(--font-serif)', fontSize: '28px', color: 'var(--green-deep)', fontWeight: 600, marginBottom: '4px' }}>
            Group Decisions
          </div>
          <div style={{ fontSize: '13px', color: 'var(--text-light)', fontWeight: 300 }}>
            Create polls so everyone gets a vote.
          </div>
        </div>
        {isOrganizer && (
          <button onClick={() => setCreating(true)} style={primaryBtnStyle}>
            + New Poll
          </button>
        )}
      </div>

      {/* Empty state */}
      {polls.length === 0 && (
        <div style={{
          textAlign: 'center', padding: '60px 40px',
          background: 'var(--white)', borderRadius: 'var(--radius-lg)',
          border: '1px solid var(--cream-dark)',
        }}>
          <div style={{ fontSize: '36px', marginBottom: '16px' }}>🗳️</div>
          <div style={{ fontFamily: 'var(--font-serif)', fontSize: '18px', color: 'var(--green-deep)', marginBottom: '8px' }}>
            No polls yet
          </div>
          <p style={{ fontSize: '13px', color: 'var(--text-light)', fontWeight: 300, maxWidth: '300px', margin: '0 auto 20px' }}>
            {isOrganizer
              ? 'Create a poll to get the group aligned on courses, dates, or anything else.'
              : 'The organizer will create polls for the group to vote on.'}
          </p>
          {isOrganizer && (
            <button onClick={() => setCreating(true)} style={primaryBtnStyle}>
              Create first poll
            </button>
          )}
        </div>
      )}

      {/* Active polls */}
      {activePolls.length > 0 && (
        <div style={{ marginBottom: '32px' }}>
          <div style={{ fontSize: '9px', letterSpacing: '0.2em', textTransform: 'uppercase', color: 'var(--green-muted)', fontWeight: 600, marginBottom: '14px' }}>
            Active
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {activePolls.map(poll => (
              <PollCard
                key={poll.id}
                poll={poll}
                currentMemberId={currentMember?.id}
                members={members}
                isOrganizer={isOrganizer}
                onClose={handleClosePoll}
                onApply={handleApplyToTrip}
                onVote={handleVote}
              />
            ))}
          </div>
        </div>
      )}

      {/* Closed polls */}
      {closedPolls.length > 0 && (
        <div>
          <div style={{ fontSize: '9px', letterSpacing: '0.2em', textTransform: 'uppercase', color: 'var(--green-muted)', fontWeight: 600, marginBottom: '14px' }}>
            Completed
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {closedPolls.map(poll => (
              <PollCard
                key={poll.id}
                poll={poll}
                currentMemberId={currentMember?.id}
                members={members}
                isOrganizer={isOrganizer}
                onClose={handleClosePoll}
                onApply={handleApplyToTrip}
                onVote={handleVote}
              />
            ))}
          </div>
        </div>
      )}

      {creating && (
        <CreatePollModal
          tripId={tripId}
          currentUserId={currentUserId}
          onCreated={(poll) => { setPolls(prev => [poll, ...prev]); setCreating(false) }}
          onClose={() => setCreating(false)}
        />
      )}
    </div>
  )
}

// ─── Shared styles ────────────────────────────────────────────────────────────

const labelStyle: React.CSSProperties = {
  display:       'block',
  fontSize:      '10px',
  letterSpacing: '0.15em',
  textTransform: 'uppercase',
  color:         'var(--text-light)',
  fontWeight:    600,
  marginBottom:  '8px',
  fontFamily:    'var(--font-sans)',
}

const inputStyle: React.CSSProperties = {
  width:        '100%',
  boxSizing:    'border-box',
  border:       '1px solid var(--cream-dark)',
  borderRadius: 'var(--radius-sm)',
  background:   'var(--cream)',
  padding:      '10px 14px',
  fontSize:     '13px',
  fontFamily:   'var(--font-sans)',
  fontWeight:   300,
  color:        'var(--text-dark)',
  outline:      'none',
  marginBottom: '20px',
}

const primaryBtnStyle: React.CSSProperties = {
  padding:       '9px 20px',
  borderRadius:  'var(--radius-sm)',
  background:    'var(--green-deep)',
  color:         'var(--gold-light)',
  border:        'none',
  fontSize:      '11px',
  fontWeight:    700,
  letterSpacing: '0.08em',
  textTransform: 'uppercase',
  cursor:        'pointer',
  fontFamily:    'var(--font-sans)',
  transition:    'opacity 0.15s',
}

const secondaryBtnStyle: React.CSSProperties = {
  padding:       '9px 20px',
  borderRadius:  'var(--radius-sm)',
  background:    'var(--cream)',
  color:         'var(--text-mid)',
  border:        '1px solid var(--cream-dark)',
  fontSize:      '11px',
  fontWeight:    600,
  letterSpacing: '0.06em',
  textTransform: 'uppercase',
  cursor:        'pointer',
  fontFamily:    'var(--font-sans)',
}

const ghostBtnStyle: React.CSSProperties = {
  padding:       '7px 14px',
  borderRadius:  'var(--radius-sm)',
  background:    'transparent',
  color:         'var(--text-light)',
  border:        '1px solid var(--cream-dark)',
  fontSize:      '11px',
  fontWeight:    500,
  cursor:        'pointer',
  fontFamily:    'var(--font-sans)',
}
