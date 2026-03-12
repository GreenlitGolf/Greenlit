'use client'

import React, { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/context/AuthContext'
import ProtectedRoute from '@/components/ProtectedRoute'
import Sidebar from '@/components/ui/Sidebar'
import type { NavItem } from '@/components/ui/Sidebar'

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
  id:           number
  user_id:      string | null
  display_name: string | null
  role:         string
  member_type:  string
  users:        { full_name: string | null; email: string | null } | null
}

type BudgetItem = {
  id:          string
  trip_id:     string
  category:    Category
  label:       string
  amount:      number
  per_person:  boolean | null   // null if migration 010 not run yet
  notes:       string | null
  source_type: string | null
  source_id:   string | null
  added_by:    string | null
  created_at:  string
}

type TeeTime = {
  id:                   string
  course_name:          string
  tee_date:             string
  num_players:          number | null
  green_fee_per_player: number | null
  cart_fee_per_player:  number | null
}

type Acc = {
  id:         string
  name:       string
  total_cost: number | null
}

type Category = 'green_fees' | 'lodging' | 'transport' | 'food_drink' | 'golf_games' | 'other'

type AddForm = {
  label:      string
  amount:     string
  per_person: boolean
  notes:      string
  category:   Category
}

// ─── Constants ────────────────────────────────────────────────────────────────

const CATEGORIES: { id: Category; emoji: string; label: string }[] = [
  { id: 'green_fees',  emoji: '⛳', label: 'Green Fees'   },
  { id: 'lodging',     emoji: '🏨', label: 'Lodging'      },
  { id: 'transport',   emoji: '🚗', label: 'Transport'    },
  { id: 'food_drink',  emoji: '🍺', label: 'Food & Drink' },
  { id: 'golf_games',  emoji: '🎲', label: 'Golf Games'   },
  { id: 'other',       emoji: '📦', label: 'Other'        },
]

const EMPTY_FORM = (cat: Category): AddForm => ({
  label: '', amount: '', per_person: false, notes: '', category: cat,
})

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmt(n: number): string {
  return n.toLocaleString('en-US', {
    style: 'currency', currency: 'USD',
    minimumFractionDigits: 0, maximumFractionDigits: 0,
  })
}

function fmtFull(n: number): string {
  return n.toLocaleString('en-US', {
    style: 'currency', currency: 'USD',
    minimumFractionDigits: 2, maximumFractionDigits: 2,
  })
}

function memberName(m: Member): string {
  if (m.member_type === 'ghost') return m.display_name ?? 'Guest'
  return m.users?.full_name ?? m.display_name ?? m.users?.email ?? 'Member'
}

function buildNavItems(memberCount: number): NavItem[] {
  return [
    { id: 'concierge', icon: '✦',  label: 'Golf Concierge',  href: '' },
    { id: 'itinerary', icon: '📅', label: 'Trip Itinerary',  href: '' },
    { id: 'games',     icon: '🎲', label: 'Golf Games',      href: '' },
    { id: 'teetimes',  icon: '🕐', label: 'Tee Times',       href: '' },
    { id: 'report',    icon: '📄', label: 'Trip Report',     href: '' },
    { id: 'hotels',    icon: '🏨', label: 'Accommodations',  href: '' },
    { id: 'group',     icon: '👥', label: 'Group & Members', href: '', badge: memberCount > 0 ? memberCount : undefined },
    { id: 'budget',    icon: '💰', label: 'Budget Tracker',  href: '' },
  ]
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

function itemTotal(item: BudgetItem, memberCount: number): number {
  return (item.per_person ?? false) ? item.amount * memberCount : item.amount
}

function itemPerPerson(item: BudgetItem, memberCount: number): number {
  return (item.per_person ?? false) ? item.amount : item.amount / Math.max(memberCount, 1)
}

// ─── SummaryBar ───────────────────────────────────────────────────────────────

function SummaryBar({
  grandTotal, perPerson, largestCat, largestTotal,
}: {
  grandTotal:   number
  perPerson:    number
  largestCat:   typeof CATEGORIES[0] | null
  largestTotal: number
}) {
  const stats = [
    {
      label: 'Estimated Total',
      value: grandTotal > 0 ? fmt(grandTotal) : '—',
      sub:   null as string | null,
    },
    {
      label: 'Per Person',
      value: perPerson > 0 ? fmt(perPerson) : '—',
      sub:   null,
    },
    {
      label: 'Largest Expense',
      value: largestCat && largestTotal > 0 ? `${largestCat.emoji} ${largestCat.label}` : '—',
      sub:   largestTotal > 0 ? fmt(largestTotal) : null,
    },
    {
      label: 'Budget Status',
      value: grandTotal > 0 ? 'In Progress' : 'Not Started',
      sub:   null,
    },
  ]

  return (
    <div style={{
      display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)',
      gap: '1px', background: '#e5e7eb', borderBottom: '1px solid #e5e7eb',
      flexShrink: 0,
    }}>
      {stats.map(s => (
        <div key={s.label} style={{ background: '#fff', padding: '20px 24px' }}>
          <div style={{
            fontSize: '11px', fontWeight: 600, color: '#9ca3af',
            letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 4,
          }}>
            {s.label}
          </div>
          <div style={{ fontSize: '22px', fontWeight: 700, color: '#111827', lineHeight: 1.2 }}>
            {s.value}
          </div>
          {s.sub && (
            <div style={{ fontSize: '12px', color: '#6b7280', marginTop: 3 }}>{s.sub}</div>
          )}
        </div>
      ))}
    </div>
  )
}

// ─── SourceBadge ──────────────────────────────────────────────────────────────

function SourceBadge({ sourceType }: { sourceType: string | null }) {
  if (!sourceType) return null
  const styles: Record<string, { label: string; color: string; bg: string }> = {
    tee_time:      { label: 'from Tee Times',      color: '#065f46', bg: '#d1fae5' },
    accommodation: { label: 'from Accommodations', color: '#1e40af', bg: '#dbeafe' },
    golf_game:     { label: 'from Golf Game',      color: '#6d28d9', bg: '#ede9fe' },
    game_payout:   { label: 'from Golf Games',     color: '#6d28d9', bg: '#ede9fe' },
  }
  const s = styles[sourceType] ?? { label: sourceType, color: '#374151', bg: '#f3f4f6' }
  return (
    <span style={{
      fontSize: '10px', fontWeight: 600, letterSpacing: '0.03em',
      color: s.color, background: s.bg, padding: '2px 8px', borderRadius: 20,
      whiteSpace: 'nowrap',
    }}>
      {s.label}
    </span>
  )
}

// ─── BudgetRow ────────────────────────────────────────────────────────────────

function BudgetRow({
  item, memberCount, isOrganizer,
  deleteConfirm, onDeleteRequest, onDeleteConfirm, onDeleteCancel,
}: {
  item:            BudgetItem
  memberCount:     number
  isOrganizer:     boolean
  deleteConfirm:   string | null
  onDeleteRequest: (itemId: string) => void
  onDeleteConfirm: (item: BudgetItem) => void
  onDeleteCancel:  () => void
}) {
  const isSource = !!item.source_type
  const total    = itemTotal(item, memberCount)
  const pp       = itemPerPerson(item, memberCount)
  const isConfirming = deleteConfirm === item.id

  return (
    <div style={{
      display: 'flex', alignItems: 'flex-start', gap: 10,
      padding: '10px 14px', borderRadius: 8,
      background: isSource ? '#fafafa' : '#fff',
      border: `1px solid ${isSource ? '#f0f0f0' : '#f3f4f6'}`,
    }}>
      {/* Lock icon — synced items */}
      <span
        title={isSource ? 'Auto-synced from ' + (item.source_type === 'tee_time' ? 'Tee Times' : 'Accommodations') : ''}
        style={{
          fontSize: '12px', marginTop: 2, flexShrink: 0,
          color: isSource ? '#d1d5db' : 'transparent', lineHeight: 1,
        }}
      >
        🔒
      </span>

      {/* Description + badges */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <span style={{ fontSize: '14px', fontWeight: 500, color: '#111827' }}>
            {item.label}
          </span>
          <SourceBadge sourceType={item.source_type} />
          {(item.per_person ?? false) && (
            <span style={{
              fontSize: '10px', color: '#6b7280', background: '#f3f4f6',
              padding: '2px 7px', borderRadius: 20,
            }}>
              per person
            </span>
          )}
        </div>
        {item.notes && (
          <div style={{ fontSize: '12px', color: '#9ca3af', marginTop: 3 }}>{item.notes}</div>
        )}
      </div>

      {/* Amounts */}
      <div style={{ textAlign: 'right', flexShrink: 0, marginLeft: 8 }}>
        <div style={{ fontSize: '15px', fontWeight: 700, color: '#111827' }}>{fmt(total)}</div>
        {memberCount > 1 && (
          <div style={{ fontSize: '11px', color: '#9ca3af', marginTop: 1 }}>
            {fmtFull(pp)}/ea
          </div>
        )}
      </div>

      {/* Delete control */}
      {isOrganizer && (
        <div style={{ flexShrink: 0, display: 'flex', alignItems: 'center' }}>
          {isConfirming ? (
            <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              <span style={{ fontSize: '12px', color: '#6b7280' }}>Remove?</span>
              <button
                onClick={() => onDeleteConfirm(item)}
                style={{ fontSize: '12px', color: '#dc2626', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 700, padding: '0 2px' }}
              >
                Yes
              </button>
              <button
                onClick={onDeleteCancel}
                style={{ fontSize: '12px', color: '#9ca3af', background: 'none', border: 'none', cursor: 'pointer', padding: '0 2px' }}
              >
                No
              </button>
            </div>
          ) : (
            <button
              onClick={() => onDeleteRequest(item.id)}
              title="Remove item"
              style={{
                fontSize: '18px', color: '#d1d5db', background: 'none', border: 'none',
                cursor: 'pointer', lineHeight: 1, padding: '0 4px',
                transition: 'color 0.15s',
              }}
              onMouseOver={e => (e.currentTarget.style.color = '#9ca3af')}
              onMouseOut={e => (e.currentTarget.style.color = '#d1d5db')}
            >
              ×
            </button>
          )}
        </div>
      )}
    </div>
  )
}

// ─── InlineAddForm ────────────────────────────────────────────────────────────

function InlineAddForm({
  form, memberCount, onChange, onSave, onCancel, saving,
}: {
  form:        AddForm
  memberCount: number
  onChange:    (key: keyof AddForm, value: string | boolean) => void
  onSave:      () => void
  onCancel:    () => void
  saving:      boolean
}) {
  const canSave = form.label.trim().length > 0 && form.amount.length > 0 && parseFloat(form.amount) > 0

  return (
    <div style={{
      background: '#f0fdf4', border: '1px solid #bbf7d0',
      borderRadius: 10, padding: '16px 18px',
      display: 'flex', flexDirection: 'column', gap: 12,
    }}>
      {/* Row 1: Description · Amount · Category */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 130px 160px', gap: 10, alignItems: 'end' }}>

        {/* Description */}
        <div>
          <label style={{
            fontSize: '10px', fontWeight: 700, color: '#6b7280',
            letterSpacing: '0.06em', textTransform: 'uppercase', display: 'block', marginBottom: 4,
          }}>
            Description
          </label>
          <input
            autoFocus
            value={form.label}
            onChange={e => onChange('label', e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && canSave) onSave() }}
            placeholder="e.g. Golf cart rental"
            style={{
              width: '100%', padding: '8px 12px', borderRadius: 6,
              border: '1px solid #a7f3d0', fontSize: '14px', fontFamily: 'inherit',
              outline: 'none', boxSizing: 'border-box', background: '#fff',
            }}
          />
        </div>

        {/* Amount */}
        <div>
          <label style={{
            fontSize: '10px', fontWeight: 700, color: '#6b7280',
            letterSpacing: '0.06em', textTransform: 'uppercase', display: 'block', marginBottom: 4,
          }}>
            Amount
          </label>
          <div style={{ position: 'relative' }}>
            <span style={{
              position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)',
              color: '#9ca3af', fontSize: '14px', pointerEvents: 'none',
            }}>$</span>
            <input
              type="number"
              min="0"
              step="0.01"
              value={form.amount}
              onChange={e => onChange('amount', e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && canSave) onSave() }}
              placeholder="0.00"
              style={{
                width: '100%', padding: '8px 12px 8px 24px', borderRadius: 6,
                border: '1px solid #a7f3d0', fontSize: '14px', fontFamily: 'inherit',
                outline: 'none', boxSizing: 'border-box', background: '#fff',
              }}
            />
          </div>
        </div>

        {/* Category */}
        <div>
          <label style={{
            fontSize: '10px', fontWeight: 700, color: '#6b7280',
            letterSpacing: '0.06em', textTransform: 'uppercase', display: 'block', marginBottom: 4,
          }}>
            Category
          </label>
          <select
            value={form.category}
            onChange={e => onChange('category', e.target.value)}
            style={{
              width: '100%', padding: '8px 12px', borderRadius: 6,
              border: '1px solid #a7f3d0', fontSize: '13px', fontFamily: 'inherit',
              outline: 'none', background: '#fff', boxSizing: 'border-box',
            }}
          >
            {CATEGORIES.map(c => (
              <option key={c.id} value={c.id}>{c.emoji} {c.label}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Row 2: Per person toggle · Notes · Buttons */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        {/* Per person */}
        <label style={{
          display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer',
          fontSize: '13px', color: '#374151', whiteSpace: 'nowrap', flexShrink: 0,
        }}>
          <input
            type="checkbox"
            checked={form.per_person}
            onChange={e => onChange('per_person', e.target.checked)}
            style={{ width: 14, height: 14, cursor: 'pointer' }}
          />
          Per person ×{memberCount}
          {form.per_person && form.amount && parseFloat(form.amount) > 0 && (
            <span style={{ color: '#2d5a3d', fontWeight: 600 }}>
              = {fmt(parseFloat(form.amount) * memberCount)} total
            </span>
          )}
        </label>

        {/* Notes */}
        <input
          value={form.notes}
          onChange={e => onChange('notes', e.target.value)}
          placeholder="Notes (optional)"
          style={{
            flex: 1, minWidth: 120, padding: '7px 12px', borderRadius: 6,
            border: '1px solid #a7f3d0', fontSize: '13px', fontFamily: 'inherit',
            outline: 'none', background: '#fff',
          }}
        />

        {/* Action buttons */}
        <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
          <button
            onClick={onSave}
            disabled={saving || !canSave}
            style={{
              padding: '8px 22px', borderRadius: 6, border: 'none',
              background: canSave ? '#2d5a3d' : '#d1d5db',
              color: canSave ? '#e8d5a3' : '#9ca3af',
              fontSize: '13px', fontWeight: 700, cursor: canSave ? 'pointer' : 'default',
              fontFamily: 'inherit', transition: 'opacity 0.15s',
            }}
          >
            {saving ? '…' : 'Add'}
          </button>
          <button
            onClick={onCancel}
            style={{
              padding: '8px 14px', borderRadius: 6,
              border: '1px solid #e5e7eb', background: '#fff',
              fontSize: '13px', color: '#6b7280', cursor: 'pointer',
              fontFamily: 'inherit',
            }}
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── CategorySection ──────────────────────────────────────────────────────────

function CategorySection({
  cat, items, memberCount, catTotal, isExpanded, onToggle,
  isAddingHere, addForm, memberCountForForm, onAddFormChange, onAddSave, onAddCancel,
  addSaving, onAddOpen,
  isOrganizer, deleteConfirm, onDeleteRequest, onDeleteConfirm, onDeleteCancel,
}: {
  cat:              typeof CATEGORIES[0]
  items:            BudgetItem[]
  memberCount:      number
  catTotal:         number
  isExpanded:       boolean
  onToggle:         () => void
  isAddingHere:     boolean
  addForm:          AddForm
  memberCountForForm: number
  onAddFormChange:  (k: keyof AddForm, v: string | boolean) => void
  onAddSave:        () => void
  onAddCancel:      () => void
  addSaving:        boolean
  onAddOpen:        () => void
  isOrganizer:      boolean
  deleteConfirm:    string | null
  onDeleteRequest:  (itemId: string) => void
  onDeleteConfirm:  (item: BudgetItem) => void
  onDeleteCancel:   () => void
}) {
  return (
    <div style={{
      border: '1px solid #e5e7eb', borderRadius: 10,
      overflow: 'hidden', background: '#fff',
    }}>
      {/* Section header */}
      <div
        onClick={onToggle}
        style={{
          display: 'flex', alignItems: 'center', gap: 10,
          padding: '13px 18px', cursor: 'pointer',
          borderBottom: isExpanded ? '1px solid #f3f4f6' : 'none',
          userSelect: 'none',
          transition: 'background 0.1s',
        }}
        onMouseOver={e => (e.currentTarget.style.background = '#fafafa')}
        onMouseOut={e => (e.currentTarget.style.background = '#fff')}
      >
        <span style={{ fontSize: '18px', lineHeight: 1 }}>{cat.emoji}</span>
        <span style={{ flex: 1, fontWeight: 600, fontSize: '15px', color: '#111827' }}>
          {cat.label}
        </span>
        {items.length > 0 && (
          <span style={{ fontSize: '12px', color: '#9ca3af' }}>
            {items.length} {items.length === 1 ? 'item' : 'items'}
          </span>
        )}
        {catTotal > 0 && (
          <span style={{ fontSize: '15px', fontWeight: 700, color: '#2d5a3d', marginLeft: 4 }}>
            {fmt(catTotal)}
          </span>
        )}
        <span style={{ fontSize: '11px', color: '#d1d5db', marginLeft: 6 }}>
          {isExpanded ? '▲' : '▼'}
        </span>
      </div>

      {/* Section body */}
      {isExpanded && (
        <div style={{ padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 8 }}>
          {/* Line items */}
          {items.map(item => (
            <BudgetRow
              key={item.id}
              item={item}
              memberCount={memberCount}
              isOrganizer={isOrganizer}
              deleteConfirm={deleteConfirm}
              onDeleteRequest={onDeleteRequest}
              onDeleteConfirm={onDeleteConfirm}
              onDeleteCancel={onDeleteCancel}
            />
          ))}

          {/* Empty hint */}
          {items.length === 0 && !isAddingHere && (
            <p style={{
              fontSize: '13px', color: '#d1d5db',
              textAlign: 'center', padding: '4px 0', margin: 0,
            }}>
              No {cat.label.toLowerCase()} costs yet
            </p>
          )}

          {/* Inline add form */}
          {isAddingHere && (
            <InlineAddForm
              form={addForm}
              memberCount={memberCountForForm}
              onChange={onAddFormChange}
              onSave={onAddSave}
              onCancel={onAddCancel}
              saving={addSaving}
            />
          )}

          {/* + Add Item */}
          {!isAddingHere && (
            <button
              onClick={onAddOpen}
              style={{
                alignSelf: 'flex-start', padding: '5px 0',
                background: 'none', border: 'none', cursor: 'pointer',
                fontSize: '13px', fontWeight: 500, color: '#2d5a3d',
                fontFamily: 'inherit',
              }}
              onMouseOver={e => (e.currentTarget.style.textDecoration = 'underline')}
              onMouseOut={e => (e.currentTarget.style.textDecoration = 'none')}
            >
              + Add Item
            </button>
          )}
        </div>
      )}
    </div>
  )
}

// ─── PerPersonTable ───────────────────────────────────────────────────────────

function PerPersonTable({
  members, items, memberCount,
}: {
  members:     Member[]
  items:       BudgetItem[]
  memberCount: number
}) {
  if (members.length === 0 || items.length === 0) return null

  const activeCats = CATEGORIES.map(c => ({
    ...c,
    total: items
      .filter(i => i.category === c.id)
      .reduce((s, i) => s + itemTotal(i, memberCount), 0),
  })).filter(c => c.total > 0)

  if (activeCats.length === 0) return null

  const grandTotal = activeCats.reduce((s, c) => s + c.total, 0)

  return (
    <div style={{ marginTop: 36 }}>
      <h3 style={{
        fontSize: '15px', fontWeight: 700, color: '#374151',
        margin: '0 0 14px', display: 'flex', alignItems: 'center', gap: 8,
      }}>
        Per-Person Breakdown
        <span style={{ fontSize: '12px', fontWeight: 400, color: '#9ca3af' }}>
          — equal split across {memberCount} golfer{memberCount !== 1 ? 's' : ''}
        </span>
      </h3>

      <div style={{ overflowX: 'auto', borderRadius: 10, border: '1px solid #e5e7eb' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
          <thead>
            <tr style={{ background: '#f9fafb', borderBottom: '2px solid #e5e7eb' }}>
              <th style={{
                textAlign: 'left', padding: '11px 16px',
                fontWeight: 600, color: '#374151', whiteSpace: 'nowrap',
              }}>
                Player
              </th>
              {activeCats.map(c => (
                <th key={c.id} style={{
                  textAlign: 'right', padding: '11px 16px',
                  fontWeight: 600, color: '#374151', whiteSpace: 'nowrap',
                }}>
                  {c.emoji} {c.label}
                </th>
              ))}
              <th style={{
                textAlign: 'right', padding: '11px 16px',
                fontWeight: 700, color: '#111827', whiteSpace: 'nowrap',
                borderLeft: '1px solid #e5e7eb',
              }}>
                Total
              </th>
            </tr>
          </thead>

          <tbody>
            {members.map((m, idx) => {
              const rowTotal = activeCats.reduce((s, c) => s + c.total / memberCount, 0)
              return (
                <tr
                  key={m.id}
                  style={{
                    borderBottom: idx < members.length - 1 ? '1px solid #f3f4f6' : 'none',
                    background: idx % 2 === 0 ? '#fff' : '#fafafa',
                  }}
                >
                  <td style={{ padding: '10px 16px', color: '#374151', fontWeight: 500, whiteSpace: 'nowrap' }}>
                    {memberName(m)}
                    {m.role === 'organizer' && (
                      <span style={{ marginLeft: 6, fontSize: '10px', color: '#9ca3af', fontWeight: 400 }}>
                        Organizer
                      </span>
                    )}
                    {m.member_type === 'ghost' && (
                      <span style={{ marginLeft: 6, fontSize: '10px', color: '#9ca3af', fontWeight: 400 }}>
                        Guest
                      </span>
                    )}
                  </td>
                  {activeCats.map(c => (
                    <td key={c.id} style={{
                      textAlign: 'right', padding: '10px 16px', color: '#374151',
                    }}>
                      {c.total > 0 ? fmtFull(c.total / memberCount) : '—'}
                    </td>
                  ))}
                  <td style={{
                    textAlign: 'right', padding: '10px 16px',
                    fontWeight: 700, color: '#111827',
                    borderLeft: '1px solid #f3f4f6',
                  }}>
                    {fmtFull(rowTotal)}
                  </td>
                </tr>
              )
            })}
          </tbody>

          <tfoot>
            <tr style={{ borderTop: '2px solid #e5e7eb', background: '#f9fafb' }}>
              <td style={{ padding: '11px 16px', fontWeight: 700, color: '#374151' }}>TOTAL</td>
              {activeCats.map(c => (
                <td key={c.id} style={{
                  textAlign: 'right', padding: '11px 16px',
                  fontWeight: 600, color: '#374151',
                }}>
                  {fmt(c.total)}
                </td>
              ))}
              <td style={{
                textAlign: 'right', padding: '11px 16px',
                fontWeight: 700, color: '#2d5a3d', fontSize: '14px',
                borderLeft: '1px solid #e5e7eb',
              }}>
                {fmt(grandTotal)}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  )
}

// ─── ImportBanner ─────────────────────────────────────────────────────────────

function ImportBanner({
  count, importing, onImport,
}: {
  count:     number
  importing: boolean
  onImport:  () => void
}) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 14,
      padding: '14px 20px', borderRadius: 10, marginBottom: 20,
      background: 'linear-gradient(135deg, #f0fdf4, #ecfdf5)',
      border: '1px solid #bbf7d0',
    }}>
      <span style={{ fontSize: '18px' }}>✦</span>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: '13px', fontWeight: 600, color: '#065f46' }}>
          {count} item{count !== 1 ? 's' : ''} available to import
        </div>
        <div style={{ fontSize: '12px', color: '#6b7280', marginTop: 2 }}>
          Tee Times and Accommodations have costs not yet reflected in your budget
        </div>
      </div>
      <button
        onClick={onImport}
        disabled={importing}
        style={{
          padding: '8px 18px', borderRadius: 7, border: 'none',
          background: '#2d5a3d', color: '#e8d5a3',
          fontSize: '12px', fontWeight: 600, cursor: importing ? 'default' : 'pointer',
          fontFamily: 'inherit', flexShrink: 0, opacity: importing ? 0.7 : 1,
        }}
      >
        {importing ? 'Importing…' : 'Import Now'}
      </button>
    </div>
  )
}

// ─── EmptyState ───────────────────────────────────────────────────────────────

function EmptyState({
  hasImportable, importCount, onAddFirst, onImport,
}: {
  hasImportable: boolean
  importCount:   number
  onAddFirst:    () => void
  onImport:      () => void
}) {
  return (
    <div style={{
      textAlign: 'center', padding: '72px 40px',
      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0,
    }}>
      <div style={{ fontSize: '52px', lineHeight: 1, marginBottom: 18 }}>💰</div>
      <h3 style={{
        fontSize: '20px', fontWeight: 700, color: '#374151',
        margin: '0 0 10px',
      }}>
        Your trip budget starts here
      </h3>
      <p style={{
        fontSize: '14px', lineHeight: 1.7, maxWidth: 380,
        margin: '0 0 30px', color: '#6b7280',
      }}>
        Green fees and lodging costs auto-populate from your Tee Times and
        Accommodations. Add anything else manually.
      </p>

      <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
        <button
          onClick={onAddFirst}
          style={{
            padding: '11px 28px', borderRadius: 8, border: 'none',
            background: '#2d5a3d', color: '#e8d5a3',
            fontSize: '14px', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
          }}
        >
          + Add Item
        </button>

        {hasImportable && (
          <button
            onClick={onImport}
            style={{
              padding: '11px 28px', borderRadius: 8,
              border: '1px solid #2d5a3d', background: '#fff',
              color: '#2d5a3d', fontSize: '14px', fontWeight: 600,
              cursor: 'pointer', fontFamily: 'inherit',
              display: 'flex', alignItems: 'center', gap: 7,
            }}
          >
            ✦ Import from Tee Times &amp; Accommodations
            <span style={{
              background: '#2d5a3d', color: '#fff',
              fontSize: '11px', fontWeight: 700, borderRadius: 20,
              padding: '1px 7px',
            }}>
              {importCount}
            </span>
          </button>
        )}
      </div>
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function BudgetPage() {
  const params      = useParams()
  const router      = useRouter()
  const { session } = useAuth()
  const id          = params?.id as string

  const [trip,    setTrip]    = useState<Trip | null>(null)
  const [members, setMembers] = useState<Member[]>([])
  const [items,   setItems]   = useState<BudgetItem[]>([])
  const [teeTimes, setTeeTimes] = useState<TeeTime[]>([])
  const [accs,    setAccs]    = useState<Acc[]>([])
  const [loading, setLoading] = useState(true)

  // UI state
  const [expanded,  setExpanded]  = useState<Set<Category>>(new Set(CATEGORIES.map(c => c.id)))
  const [addingTo,  setAddingTo]  = useState<Category | null>(null)
  const [addForm,   setAddForm]   = useState<AddForm>(EMPTY_FORM('green_fees'))
  const [addSaving,  setAddSaving]  = useState(false)
  const [importing,  setImporting]  = useState(false)
  const [copiedMsg,  setCopiedMsg]  = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [importErr,  setImportErr]  = useState<string | null>(null)

  // ─── Fetch ──────────────────────────────────────────────────────────────────

  useEffect(() => {
    if (!id || !session) return
    void load()
  }, [id, session])

  async function load() {
    setLoading(true)
    const [tripRes, membersRes, itemsRes, ttRes, accRes] = await Promise.all([
      supabase
        .from('trips')
        .select('id,name,destination,start_date,end_date,created_by')
        .eq('id', id)
        .single(),
      supabase
        .from('trip_members')
        .select('id,user_id,display_name,role,member_type,users(full_name,email)')
        .eq('trip_id', id),
      supabase
        .from('budget_items')
        .select('*')
        .eq('trip_id', id)
        .order('created_at', { ascending: true }),
      supabase
        .from('tee_times')
        .select('id,course_name,tee_date,num_players,green_fee_per_player,cart_fee_per_player')
        .eq('trip_id', id),
      supabase
        .from('accommodations')
        .select('id,name,total_cost')
        .eq('trip_id', id),
    ])

    if (tripRes.data)  setTrip(tripRes.data)
    if (itemsRes.data) setItems(itemsRes.data as BudgetItem[])
    if (ttRes.data)    setTeeTimes(ttRes.data as TeeTime[])
    if (accRes.data)   setAccs(accRes.data as Acc[])

    // Members — full query includes display_name + users join (requires migration 007).
    // If that 400s, fall back to a minimal query so memberCount is still correct.
    if (membersRes.data) {
      setMembers(membersRes.data as unknown as Member[])
    } else {
      const { data: fallback } = await supabase
        .from('trip_members')
        .select('id,user_id,role,member_type')
        .eq('trip_id', id)
      if (fallback) setMembers(fallback as unknown as Member[])
    }

    // Expand only categories that have items (after first load with data)
    if (itemsRes.data && itemsRes.data.length > 0) {
      const populated = new Set(itemsRes.data.map((i: BudgetItem) => i.category as Category))
      setExpanded(populated)
    }

    setLoading(false)
  }

  // ─── Computed ────────────────────────────────────────────────────────────────

  const memberCount = Math.max(members.length, 1)
  const isOrganizer = trip?.created_by === session?.user?.id

  const catTotals = Object.fromEntries(
    CATEGORIES.map(c => [
      c.id,
      items
        .filter(i => i.category === c.id)
        .reduce((s, i) => s + itemTotal(i, memberCount), 0),
    ])
  ) as Record<Category, number>

  const grandTotal = Object.values(catTotals).reduce((s, n) => s + n, 0)
  const perPerson  = grandTotal / memberCount

  const largestCat = CATEGORIES.reduce<typeof CATEGORIES[0] | null>((best, c) => {
    if (!best || catTotals[c.id] > catTotals[best.id]) return c
    return best
  }, null)
  const largestTotal = largestCat ? catTotals[largestCat.id] : 0

  // Importable items not yet in budget
  const importableTT = teeTimes.filter(tt =>
    (tt.green_fee_per_player ?? 0) > 0 &&
    !items.some(i => i.source_type === 'tee_time' && i.source_id === tt.id)
  )
  const importableAcc = accs.filter(acc =>
    acc.total_cost != null && acc.total_cost > 0 &&
    !items.some(i => i.source_type === 'accommodation' && i.source_id === acc.id)
  )
  const importCount   = importableTT.length + importableAcc.length
  const hasImportable = importCount > 0

  // ─── Import ──────────────────────────────────────────────────────────────────

  async function handleImport() {
    if (importing) return
    setImporting(true)
    setImportErr(null)

    // Build inserts — omit per_person/notes so the insert works even if
    // migration 010 hasn't been run (DB default false is correct for imports)
    const inserts: Record<string, unknown>[] = []

    for (const tt of importableTT) {
      inserts.push({
        trip_id:     id,
        category:    'green_fees',
        label:       `Green Fees — ${tt.course_name}`,
        amount:      (tt.green_fee_per_player ?? 0) * (tt.num_players ?? memberCount),
        source_type: 'tee_time',
        source_id:   tt.id,
        added_by:    session?.user.id ?? null,
      })
    }

    for (const acc of importableAcc) {
      inserts.push({
        trip_id:     id,
        category:    'lodging',
        label:       `Lodging — ${acc.name}`,
        amount:      acc.total_cost!,
        source_type: 'accommodation',
        source_id:   acc.id,
        added_by:    session?.user.id ?? null,
      })
    }

    if (inserts.length > 0) {
      // Use insert (not upsert) — importableTT/Acc are pre-filtered to items
      // that don't exist yet, so there's no risk of duplicates. The partial
      // unique index on (source_type, source_id) can't be used by PostgREST's
      // ON CONFLICT clause anyway.
      const { data, error } = await supabase
        .from('budget_items')
        .insert(inserts)
        .select()

      if (error) {
        setImportErr(`Import failed: ${error.message}`)
      } else if (data) {
        const newIds = new Set(items.map(i => i.id))
        const fresh  = (data as BudgetItem[]).filter(d => !newIds.has(d.id))
        setItems(prev => [...prev, ...fresh])

        // Expand newly populated categories
        const newCats = new Set(data.map((i: BudgetItem) => i.category as Category))
        setExpanded(prev => new Set([...prev, ...newCats]))
      }
    }

    setImporting(false)
  }

  // ─── Add item ────────────────────────────────────────────────────────────────

  function openAdd(cat: Category) {
    setAddingTo(cat)
    setAddForm(EMPTY_FORM(cat))
    // Ensure section is expanded
    setExpanded(prev => new Set([...prev, cat]))
  }

  function handleAddFormChange(key: keyof AddForm, value: string | boolean) {
    setAddForm(prev => {
      const next = { ...prev, [key]: value }
      return next
    })
    // Move add form to new category section if category changes
    if (key === 'category') {
      setAddingTo(value as Category)
      setExpanded(prev => new Set([...prev, value as Category]))
    }
  }

  async function handleAddSave() {
    if (!addForm.label.trim() || !addForm.amount || parseFloat(addForm.amount) <= 0) return
    setAddSaving(true)

    // Base payload — works without migration 010
    const base: Record<string, unknown> = {
      trip_id:     id,
      category:    addForm.category,
      label:       addForm.label.trim(),
      amount:      parseFloat(addForm.amount),
      source_type: null,
      source_id:   null,
      added_by:    session?.user.id ?? null,
    }

    // Try with migration-010 columns first (per_person, notes)
    const full = {
      ...base,
      per_person: addForm.per_person,
      notes:      addForm.notes.trim() || null,
    }

    let { data, error } = await supabase
      .from('budget_items')
      .insert(full)
      .select()
      .single()

    // If unknown column error (migration 010 not run), retry without those fields
    if (error) {
      const retry = await supabase
        .from('budget_items')
        .insert(base)
        .select()
        .single()
      data  = retry.data
      error = retry.error
    }

    if (data) {
      setItems(prev => [...prev, data as BudgetItem])
      setAddForm(EMPTY_FORM(addForm.category))
    }

    setAddSaving(false)
  }

  // ─── Delete ──────────────────────────────────────────────────────────────────

  async function handleDeleteConfirm(item: BudgetItem) {
    await supabase.from('budget_items').delete().eq('id', item.id)
    setItems(prev => prev.filter(i => i.id !== item.id))
    setDeletingId(null)
  }

  // ─── Copy summary ────────────────────────────────────────────────────────────

  async function handleCopySummary() {
    const activeCats = CATEGORIES.filter(c => catTotals[c.id] > 0)
    if (activeCats.length === 0) return

    const labelWidth = Math.max(...activeCats.map(c => c.label.length), 12)
    const sep        = '─'.repeat(labelWidth + 28)

    const lines: string[] = [
      `${trip?.name ?? 'Trip'} — Cost Summary`,
      sep,
      ...activeCats.map(c => {
        const total = catTotals[c.id]
        const pp    = total / memberCount
        const label = (c.label + ':').padEnd(labelWidth + 2)
        const totalStr = fmt(total).padStart(9)
        const ppStr    = `(${fmtFull(pp)}/person)`
        return `${label}  ${totalStr}  ${ppStr}`
      }),
      sep,
      `${'TOTAL:'.padEnd(labelWidth + 2)}  ${fmt(grandTotal).padStart(9)}  (${fmtFull(perPerson)}/person)`,
      '',
      'Planned with Greenlit · greenlit.golf',
    ]

    try {
      await navigator.clipboard.writeText(lines.join('\n'))
      setCopiedMsg(true)
      setTimeout(() => setCopiedMsg(false), 2500)
    } catch {
      // Clipboard API not available
    }
  }

  // ─── Nav ─────────────────────────────────────────────────────────────────────

  function handleNav(navId: string) {
    if (navId === 'budget')   return
    if (navId === 'games')    { router.push(`/trip/${id}/games`);          return }
    if (navId === 'report')   { router.push(`/trip/${id}/report`);         return }
    if (navId === 'teetimes') { router.push(`/trip/${id}/tee-times`);      return }
    if (navId === 'hotels')   { router.push(`/trip/${id}/accommodations`); return }
    router.push(`/trip/${id}`)
  }

  // ─── Render ───────────────────────────────────────────────────────────────────

  const hasItems    = items.length > 0
  const showSections = hasItems || addingTo !== null

  return (
    <ProtectedRoute>
      <div style={{
        display: 'flex', height: '100vh', overflow: 'hidden',
        fontFamily: 'var(--font-sans)',
      }}>

        {/* Sidebar */}
        {trip && (
          <Sidebar
            navItems={buildNavItems(memberCount)}
            activeId="budget"
            onItemClick={handleNav}
            tripName={trip.name}
            tripMeta={buildTripMeta(trip.start_date, trip.end_date, memberCount)}
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
              Loading budget…
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
              {/* Stats strip */}
              <SummaryBar
                grandTotal={grandTotal}
                perPerson={perPerson}
                largestCat={largestTotal > 0 ? largestCat : null}
                largestTotal={largestTotal}
              />

              {/* Page header */}
              <div style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '22px 48px 0', flexShrink: 0,
              }}>
                <h2 style={{ fontSize: '20px', fontWeight: 700, color: '#111827', margin: 0 }}>
                  💰 Budget Tracker
                </h2>
                <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                  {hasItems && grandTotal > 0 && (
                    <button
                      onClick={handleCopySummary}
                      style={{
                        padding: '8px 18px', borderRadius: 7,
                        border: '1px solid #e5e7eb', background: '#fff',
                        fontSize: '13px', fontWeight: 500, cursor: 'pointer',
                        color: copiedMsg ? '#2d5a3d' : '#374151',
                        fontFamily: 'inherit', transition: 'color 0.2s',
                      }}
                    >
                      {copiedMsg ? '✓ Copied!' : '📋 Copy Summary'}
                    </button>
                  )}
                  <a
                    href={`/trip/${id}`}
                    style={{ fontSize: '12px', color: '#9ca3af', textDecoration: 'none' }}
                  >
                    ← Trip
                  </a>
                </div>
              </div>

              {/* Scrollable content */}
              <div style={{ flex: 1, overflowY: 'auto', padding: '20px 48px 60px' }}>

                {!showSections ? (
                  /* ── Empty state ── */
                  <>
                    {importErr && (
                      <div style={{
                        display: 'flex', alignItems: 'center', gap: 10,
                        padding: '12px 16px', borderRadius: 8, margin: '0 0 12px',
                        background: '#fef2f2', border: '1px solid #fecaca',
                      }}>
                        <span style={{ fontSize: '14px' }}>⚠️</span>
                        <span style={{ fontSize: '13px', color: '#b91c1c', flex: 1 }}>{importErr}</span>
                        <button onClick={() => setImportErr(null)} style={{ fontSize: '16px', color: '#fca5a5', background: 'none', border: 'none', cursor: 'pointer' }}>×</button>
                      </div>
                    )}
                    <EmptyState
                      hasImportable={hasImportable}
                      importCount={importCount}
                      onAddFirst={() => openAdd('green_fees')}
                      onImport={handleImport}
                    />
                  </>
                ) : (
                  <>
                    {/* Import banner */}
                    {hasImportable && (
                      <ImportBanner
                        count={importCount}
                        importing={importing}
                        onImport={handleImport}
                      />
                    )}

                    {/* Import error */}
                    {importErr && (
                      <div style={{
                        display: 'flex', alignItems: 'center', gap: 10,
                        padding: '12px 16px', borderRadius: 8, marginBottom: 12,
                        background: '#fef2f2', border: '1px solid #fecaca',
                      }}>
                        <span style={{ fontSize: '14px' }}>⚠️</span>
                        <span style={{ fontSize: '13px', color: '#b91c1c', flex: 1 }}>{importErr}</span>
                        <button
                          onClick={() => setImportErr(null)}
                          style={{ fontSize: '16px', color: '#fca5a5', background: 'none', border: 'none', cursor: 'pointer' }}
                        >×</button>
                      </div>
                    )}

                    {/* Category accordion sections */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 8 }}>
                      {CATEGORIES.map(cat => {
                        const catItems = items.filter(i => i.category === cat.id)
                        return (
                          <CategorySection
                            key={cat.id}
                            cat={cat}
                            items={catItems}
                            memberCount={memberCount}
                            catTotal={catTotals[cat.id]}
                            isExpanded={expanded.has(cat.id)}
                            onToggle={() => setExpanded(prev => {
                              const next = new Set(prev)
                              if (next.has(cat.id)) next.delete(cat.id)
                              else next.add(cat.id)
                              return next
                            })}
                            isAddingHere={addingTo === cat.id}
                            addForm={addForm}
                            memberCountForForm={memberCount}
                            onAddFormChange={handleAddFormChange}
                            onAddSave={handleAddSave}
                            onAddCancel={() => setAddingTo(null)}
                            addSaving={addSaving}
                            onAddOpen={() => openAdd(cat.id)}
                            isOrganizer={isOrganizer}
                            deleteConfirm={deletingId}
                            onDeleteRequest={(itemId) => setDeletingId(itemId)}
                            onDeleteConfirm={handleDeleteConfirm}
                            onDeleteCancel={() => setDeletingId(null)}
                          />
                        )
                      })}
                    </div>

                    {/* Per-person breakdown table */}
                    <PerPersonTable
                      members={members}
                      items={items}
                      memberCount={memberCount}
                    />
                  </>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </ProtectedRoute>
  )
}
