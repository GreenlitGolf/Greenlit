import { SupabaseClient } from '@supabase/supabase-js'

// ─── Types ───────────────────────────────────────────────────────────────────

type TeeTimeRow = {
  id:          string
  trip_id:     string
  course_id:   string | null
  course_name: string
  tee_date:    string   // YYYY-MM-DD
  tee_time:    string   // HH:MM:SS
  num_players: number | null
}

type AccommodationRow = {
  id:             string
  trip_id:        string
  name:           string
  check_in_date:  string
  check_out_date: string
  check_in_time:  string | null
  check_out_time: string | null
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function dateToDayNumber(date: string, tripStart: string): number {
  const d = new Date(date + 'T12:00:00')
  const s = new Date(tripStart + 'T12:00:00')
  return Math.round((d.getTime() - s.getTime()) / (1000 * 60 * 60 * 24)) + 1
}

function formatTime12(time: string): string {
  const [hStr, mStr] = time.split(':')
  let h = parseInt(hStr, 10)
  const m = parseInt(mStr, 10)
  const ampm = h >= 12 ? 'PM' : 'AM'
  if (h > 12) h -= 12
  if (h === 0) h = 12
  return `${h}:${m.toString().padStart(2, '0')} ${ampm}`
}

// ─── Sync after tee time mutation ────────────────────────────────────────────

/**
 * Called after a tee time is created or updated.
 * Upserts a matching itinerary_item (type=tee_time, matching course_id + day).
 */
export async function syncTeeTimeToItinerary(
  supabase: SupabaseClient,
  teeTime: TeeTimeRow,
  tripStart: string,
  userId: string | null,
) {
  const dayNum = dateToDayNumber(teeTime.tee_date, tripStart)
  if (dayNum < 1) return // outside trip range

  const timeFormatted = formatTime12(teeTime.tee_time)

  // Check if an itinerary item already exists for this tee time
  // Match on: type=tee_time, same course_id, same day_number
  const { data: existing } = await supabase
    .from('itinerary_items')
    .select('id, start_time, title')
    .eq('trip_id', teeTime.trip_id)
    .eq('type', 'tee_time')
    .eq('day_number', dayNum)
    .eq('course_id', teeTime.course_id)

  if (existing && existing.length > 0) {
    // Update the existing item's time and title to match the tee time
    await supabase
      .from('itinerary_items')
      .update({
        start_time: timeFormatted,
        title:      teeTime.course_name,
      })
      .eq('id', existing[0].id)
  } else {
    // Insert new itinerary item
    await supabase
      .from('itinerary_items')
      .insert({
        trip_id:    teeTime.trip_id,
        day_number: dayNum,
        start_time: timeFormatted,
        title:      teeTime.course_name,
        description: null,
        type:       'tee_time',
        course_id:  teeTime.course_id,
        created_by: userId,
      })
  }
}

/**
 * Called after a tee time is deleted.
 * Removes the matching itinerary_item.
 */
export async function removeTeeTimeFromItinerary(
  supabase: SupabaseClient,
  teeTime: TeeTimeRow,
  tripStart: string,
) {
  const dayNum = dateToDayNumber(teeTime.tee_date, tripStart)
  if (dayNum < 1) return

  await supabase
    .from('itinerary_items')
    .delete()
    .eq('trip_id', teeTime.trip_id)
    .eq('type', 'tee_time')
    .eq('day_number', dayNum)
    .eq('course_id', teeTime.course_id)
}

// ─── Sync after accommodation mutation ───────────────────────────────────────

/**
 * Called after an accommodation is created or updated.
 * Upserts check-in and check-out itinerary items.
 */
export async function syncAccommodationToItinerary(
  supabase: SupabaseClient,
  acc: AccommodationRow,
  tripStart: string,
  userId: string | null,
) {
  const checkInDay  = dateToDayNumber(acc.check_in_date, tripStart)
  const checkOutDay = dateToDayNumber(acc.check_out_date, tripStart)

  const checkInTime  = acc.check_in_time  ? formatTime12(acc.check_in_time)  : '3:00 PM'
  const checkOutTime = acc.check_out_time ? formatTime12(acc.check_out_time) : '11:00 AM'

  // ── Check-in item ──
  if (checkInDay >= 1) {
    const { data: existingIn } = await supabase
      .from('itinerary_items')
      .select('id')
      .eq('trip_id', acc.trip_id)
      .eq('type', 'accommodation')
      .eq('day_number', checkInDay)
      .ilike('title', `%check%in%${acc.name}%`)

    if (!existingIn || existingIn.length === 0) {
      // Also check for a generic accommodation item on that day with this name
      const { data: genericIn } = await supabase
        .from('itinerary_items')
        .select('id')
        .eq('trip_id', acc.trip_id)
        .eq('type', 'accommodation')
        .eq('day_number', checkInDay)
        .ilike('title', `%${acc.name}%`)

      if (!genericIn || genericIn.length === 0) {
        await supabase
          .from('itinerary_items')
          .insert({
            trip_id:     acc.trip_id,
            day_number:  checkInDay,
            start_time:  checkInTime,
            title:       `Check in — ${acc.name}`,
            description: null,
            type:        'accommodation',
            course_id:   null,
            created_by:  userId,
          })
      }
    }
  }

  // ── Check-out item ──
  if (checkOutDay >= 1 && checkOutDay !== checkInDay) {
    const { data: existingOut } = await supabase
      .from('itinerary_items')
      .select('id')
      .eq('trip_id', acc.trip_id)
      .eq('type', 'accommodation')
      .eq('day_number', checkOutDay)
      .ilike('title', `%check%out%${acc.name}%`)

    if (!existingOut || existingOut.length === 0) {
      const { data: genericOut } = await supabase
        .from('itinerary_items')
        .select('id')
        .eq('trip_id', acc.trip_id)
        .eq('type', 'accommodation')
        .eq('day_number', checkOutDay)
        .ilike('title', `%${acc.name}%`)

      if (!genericOut || genericOut.length === 0) {
        await supabase
          .from('itinerary_items')
          .insert({
            trip_id:     acc.trip_id,
            day_number:  checkOutDay,
            start_time:  checkOutTime,
            title:       `Check out — ${acc.name}`,
            description: null,
            type:        'accommodation',
            course_id:   null,
            created_by:  userId,
          })
      }
    }
  }
}

/**
 * Called after an accommodation is deleted.
 * Removes associated check-in/check-out itinerary items.
 */
export async function removeAccommodationFromItinerary(
  supabase: SupabaseClient,
  acc: AccommodationRow,
  tripStart: string,
) {
  const checkInDay  = dateToDayNumber(acc.check_in_date, tripStart)
  const checkOutDay = dateToDayNumber(acc.check_out_date, tripStart)

  // Delete check-in item
  if (checkInDay >= 1) {
    await supabase
      .from('itinerary_items')
      .delete()
      .eq('trip_id', acc.trip_id)
      .eq('type', 'accommodation')
      .eq('day_number', checkInDay)
      .ilike('title', `%${acc.name}%`)
  }

  // Delete check-out item
  if (checkOutDay >= 1 && checkOutDay !== checkInDay) {
    await supabase
      .from('itinerary_items')
      .delete()
      .eq('trip_id', acc.trip_id)
      .eq('type', 'accommodation')
      .eq('day_number', checkOutDay)
      .ilike('title', `%${acc.name}%`)
  }
}
