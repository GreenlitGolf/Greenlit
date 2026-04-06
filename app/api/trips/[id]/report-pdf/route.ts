import { NextRequest, NextResponse } from 'next/server'
import { createAdminSupabaseClient } from '@/lib/supabase-server'
import puppeteer from 'puppeteer-core'
import chromium from '@sparticuz/chromium'

export const maxDuration = 60

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: tripId } = await params
  const db = createAdminSupabaseClient()

  // 1. Get trip info
  const { data: trip, error: tripErr } = await db
    .from('trips')
    .select('share_token, name')
    .eq('id', tripId)
    .single()

  if (tripErr || !trip?.share_token) {
    return NextResponse.json({ error: 'Trip not found' }, { status: 404 })
  }

  try {
    // 2. Launch headless browser
    const browser = await puppeteer.launch({
      args: chromium.args,
      defaultViewport: { width: 1200, height: 800 },
      executablePath: await chromium.executablePath(),
      headless: 'shell',
    })

    const page = await browser.newPage()

    // 3. Navigate to brochure page in PDF mode
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://greenlit-one.vercel.app'
    await page.goto(`${baseUrl}/share/${trip.share_token}/brochure?pdf=true`, {
      waitUntil: 'networkidle0',
      timeout: 30000,
    })

    // 4. Clean up UI elements
    await page.evaluate(() => {
      document.querySelectorAll('.no-print, .organizer-banner, button, [id="print-btn"]')
        .forEach(el => el.remove())
    })

    // 5. Wait for images to load
    await page.evaluate(() => {
      return Promise.all(
        Array.from(document.images)
          .filter(img => !img.complete)
          .map(img => new Promise(resolve => {
            img.onload = resolve
            img.onerror = resolve
          }))
      )
    })

    // 6. Generate PDF
    const pdf = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: { top: '0', bottom: '0', left: '0', right: '0' },
      preferCSSPageSize: true,
    })

    await browser.close()

    // 7. Upload to Supabase Storage
    const BUCKET = 'trip-reports'

    // Ensure bucket exists
    const { data: buckets } = await db.storage.listBuckets()
    if (!buckets?.find(b => b.name === BUCKET)) {
      await db.storage.createBucket(BUCKET, { public: true })
    }

    const filename = `${trip.share_token}/brochure.pdf`
    await db.storage
      .from(BUCKET)
      .upload(filename, pdf, {
        contentType: 'application/pdf',
        upsert: true,
      })

    const { data: urlData } = db.storage.from(BUCKET).getPublicUrl(filename)

    // 8. Store URL on trip record
    await db
      .from('trips')
      .update({
        report_pdf_url: urlData.publicUrl,
        report_generated_at: new Date().toISOString(),
      })
      .eq('id', tripId)

    return NextResponse.json({ pdfUrl: urlData.publicUrl })
  } catch (err: any) {
    console.error('PDF generation error:', err)
    return NextResponse.json(
      { error: 'PDF generation failed', details: err.message },
      { status: 500 },
    )
  }
}

// GET — return existing PDF URL if available
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: tripId } = await params
  const db = createAdminSupabaseClient()

  const { data: trip } = await db
    .from('trips')
    .select('report_pdf_url, report_generated_at, updated_at')
    .eq('id', tripId)
    .single()

  if (!trip) {
    return NextResponse.json({ error: 'Trip not found' }, { status: 404 })
  }

  return NextResponse.json({
    pdfUrl: trip.report_pdf_url,
    generatedAt: trip.report_generated_at,
    updatedAt: trip.updated_at,
    isStale: trip.report_generated_at && trip.updated_at
      ? new Date(trip.updated_at) > new Date(trip.report_generated_at)
      : false,
  })
}
