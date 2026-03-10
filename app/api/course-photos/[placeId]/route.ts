import { NextRequest, NextResponse } from 'next/server'

const PLACES_API_KEY = process.env.GOOGLE_PLACES_API_KEY

// Returns up to 5 photo CDN URLs for a given Google Place ID.
// Falls back gracefully if the API key is missing or the place has no photos.
//
// Uses the Places API (New) — requires:
//   1. "Places API (New)" enabled in Google Cloud Console
//   2. API key restricted to "Places API (New)" service
//   3. The Place IDs in the courses table must be valid Google Place IDs

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ placeId: string }> },
) {
  const { placeId } = await params

  if (!PLACES_API_KEY || PLACES_API_KEY === 'your_google_places_api_key_here') {
    return NextResponse.json({ photos: [] })
  }

  try {
    // Places API (New) — field mask goes in X-Goog-FieldMask header, NOT ?fields=
    const detailsUrl = `https://places.googleapis.com/v1/places/${encodeURIComponent(placeId)}`

    const detailsRes = await fetch(detailsUrl, {
      headers: {
        'X-Goog-Api-Key':     PLACES_API_KEY,
        'X-Goog-FieldMask':   'photos',
        'Content-Type':       'application/json',
        'Accept':             'application/json',
      },
      next: { revalidate: 86400 }, // cache 24 hours
    })

    if (!detailsRes.ok) {
      const errText = await detailsRes.text()
      console.error(`Places API error ${detailsRes.status} for placeId=${placeId}:`, errText)
      return NextResponse.json({ photos: [], error: `Places API ${detailsRes.status}` })
    }

    const data = await detailsRes.json()
    const rawPhotos: Array<{ name: string }> = data.photos ?? []

    if (rawPhotos.length === 0) {
      console.log(`Places API: no photos returned for placeId=${placeId}`)
      return NextResponse.json({ photos: [] })
    }

    // Build photo media URLs (max 5, 1200px wide)
    // Format: https://places.googleapis.com/v1/{photoName}/media?key=KEY&maxWidthPx=1200
    const photos = rawPhotos.slice(0, 5).map((p) =>
      `https://places.googleapis.com/v1/${p.name}/media` +
      `?key=${PLACES_API_KEY}&maxWidthPx=1200&skipHttpRedirect=false`,
    )

    return NextResponse.json({ photos })
  } catch (err) {
    console.error('course-photos route error:', err)
    return NextResponse.json({ photos: [] })
  }
}
