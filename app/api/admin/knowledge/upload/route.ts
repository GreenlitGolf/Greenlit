import { NextRequest } from 'next/server'
import { createAdminSupabaseClient } from '@/lib/supabase-server'

const BUCKET = 'knowledge-screenshots'
const MAX_SIZE = 5 * 1024 * 1024 // 5MB

export async function POST(req: NextRequest) {
  const secret = process.env.CRON_SECRET
  if (!secret || req.headers.get('authorization') !== `Bearer ${secret}`) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createAdminSupabaseClient()

  // Ensure bucket exists
  const { data: buckets } = await supabase.storage.listBuckets()
  if (!buckets?.find(b => b.name === BUCKET)) {
    await supabase.storage.createBucket(BUCKET, { public: true })
  }

  const formData = await req.formData()
  const file     = formData.get('file') as File | null

  if (!file) return Response.json({ error: 'No file provided' }, { status: 400 })
  if (file.size > MAX_SIZE) return Response.json({ error: 'File too large (max 5MB)' }, { status: 400 })

  const allowed = ['image/jpeg', 'image/png', 'image/webp']
  if (!allowed.includes(file.type)) {
    return Response.json({ error: 'Only JPG, PNG, and WebP allowed' }, { status: 400 })
  }

  const ext      = file.type.split('/')[1] === 'jpeg' ? 'jpg' : file.type.split('/')[1]
  const filename = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`

  const { data, error } = await supabase.storage
    .from(BUCKET)
    .upload(filename, file, { contentType: file.type })

  if (error) {
    console.error('Upload error:', error)
    return Response.json({ error: error.message }, { status: 500 })
  }

  const { data: urlData } = supabase.storage.from(BUCKET).getPublicUrl(data.path)

  return Response.json({ url: urlData.publicUrl })
}
