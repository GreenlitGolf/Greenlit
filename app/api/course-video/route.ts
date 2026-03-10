import { NextRequest, NextResponse } from 'next/server'

const YOUTUBE_API_KEY = process.env.YOUTUBE_API_KEY

// Returns a YouTube embed URL for a given course search query.
// Filters for embeddable medium-length videos (4–20 min) to surface course
// tour and flyover content rather than tournament broadcast footage.

export async function GET(req: NextRequest) {
  const rawQuery = req.nextUrl.searchParams.get('q')

  if (!rawQuery) {
    return NextResponse.json({ embedUrl: null, has_video: false }, { status: 400 })
  }

  if (!YOUTUBE_API_KEY || YOUTUBE_API_KEY === 'your_youtube_api_key_here') {
    return NextResponse.json({ embedUrl: null, has_video: false })
  }

  // Ensure the query targets flyover/aerial content.
  // If the db query already contains "flyover" we trust it as-is; otherwise append.
  const query = /flyover/i.test(rawQuery)
    ? rawQuery
    : `${rawQuery} golf course flyover`

  try {
    const searchUrl = new URL('https://www.googleapis.com/youtube/v3/search')
    searchUrl.searchParams.set('part',             'snippet')
    searchUrl.searchParams.set('type',             'video')
    searchUrl.searchParams.set('maxResults',       '5')
    searchUrl.searchParams.set('q',                query)
    searchUrl.searchParams.set('videoEmbeddable',  'true')   // must be embeddable
    searchUrl.searchParams.set('videoDuration',    'medium') // 4–20 min — tours, not broadcasts
    searchUrl.searchParams.set('relevanceLanguage','en')
    searchUrl.searchParams.set('key',              YOUTUBE_API_KEY)

    const searchRes = await fetch(searchUrl.toString(), {
      next: { revalidate: 604800 }, // cache 7 days
    })

    if (!searchRes.ok) {
      console.error('YouTube API error:', searchRes.status, await searchRes.text())
      return NextResponse.json({ embedUrl: null, has_video: false })
    }

    const data  = await searchRes.json()
    const items = data.items ?? []

    if (items.length === 0) {
      return NextResponse.json({ embedUrl: null, has_video: false })
    }

    // Prefer aerial/flyover videos; fall back to first result
    const FLYOVER_KEYWORDS = ['flyover', 'aerial', 'drone', 'course tour', 'golf course']
    const preferred = items.find((item: any) => {
      const title = (item.snippet?.title ?? '').toLowerCase()
      return FLYOVER_KEYWORDS.some((kw) => title.includes(kw))
    }) ?? items[0]

    const videoId: string = preferred.id.videoId
    const embedUrl = `https://www.youtube.com/embed/${videoId}?rel=0&modestbranding=1`

    return NextResponse.json({ embedUrl, has_video: true })
  } catch (err) {
    console.error('course-video route error:', err)
    return NextResponse.json({ embedUrl: null, has_video: false })
  }
}
