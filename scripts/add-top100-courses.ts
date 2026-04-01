import { createClient } from '@supabase/supabase-js';

const db = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Courses that exist in DB but need name updates + featured flag
const existingUpdates: { currentName: string; newName: string; location: string; rank: number }[] = [
  { currentName: 'Forest Dunes Golf Club', newName: 'Forest Dunes Golf Course', location: 'Roscommon, Michigan', rank: 36 },
  { currentName: 'Pelican Hill Golf Club', newName: 'Pelican Hill Golf Club (Ocean South)', location: 'Newport Coast, California', rank: 98 },
  { currentName: 'Bay Harbor Golf Club', newName: 'Bay Harbor Golf Club (Links/Quarry)', location: 'Bay Harbor, Michigan', rank: 100 },
];

// Courses that need to be inserted fresh
const missingCourses: { name: string; location: string; rank: number }[] = [
  { name: 'Pinehurst Resort No. 2', location: 'Pinehurst, NC', rank: 6 },
  { name: 'The Lido at Sand Valley', location: 'Nekoosa, WI', rank: 12 },
  { name: 'Manele Golf Course', location: 'Lanai City, HI', rank: 22 },
  { name: 'Landmand Golf Club', location: 'Homer, NE', rank: 24 },
  { name: 'Karsten Creek Golf Course', location: 'Stillwater, OK', rank: 25 },
  { name: 'Pinehurst Resort No. 10', location: 'Pinehurst, NC', rank: 30 },
  { name: 'Pinehurst Resort No. 4', location: 'Pinehurst, NC', rank: 32 },
  { name: 'Ozarks National', location: 'Hollister, MO', rank: 33 },
  { name: 'Omni Homestead Resort (Cascades)', location: 'Hot Springs, VA', rank: 34 },
  { name: 'The Prairie Club (Dunes)', location: 'Valentine, NE', rank: 35 },
  { name: 'The Quarry at Giants Ridge', location: 'Biwabik, MN', rank: 39 },
  { name: 'The Greenbrier (Old White TPC)', location: 'White Sulphur Springs, WV', rank: 41 },
  { name: 'Gamble Sands Golf Course', location: 'Brewster, WA', rank: 42 },
  { name: 'Black Desert Resort', location: 'Ivins, UT', rank: 43 },
  { name: 'PGA Frisco Fields Ranch (East)', location: 'Frisco, TX', rank: 44 },
  { name: 'The Broadmoor (East)', location: 'Colorado Springs, CO', rank: 48 },
  { name: 'Cabot Citrus Farms (Karoo)', location: 'Brooksville, FL', rank: 50 },
  { name: 'May River Golf Club at Palmetto Bluff', location: 'Bluffton, SC', rank: 51 },
  { name: 'Fallen Oak Golf Club', location: 'Biloxi, MS', rank: 52 },
  { name: 'Cabot Citrus Farms (Tiger)', location: 'Brooksville, FL', rank: 55 },
  { name: "Payne's Valley at Big Cedar Lodge", location: 'Ridgedale, MO', rank: 57 },
  { name: 'Mid Pines Inn and Golf Club', location: 'Southern Pines, NC', rank: 61 },
  { name: 'Tullymore Golf Resort', location: 'Stanwood, MI', rank: 63 },
  { name: 'Pumpkin Ridge Golf Club (Ghost Creek)', location: 'North Plains, OR', rank: 65 },
  { name: 'Sedge Valley at Sand Valley', location: 'Nekoosa, WI', rank: 70 },
  { name: 'Southern Pines Golf Club', location: 'Southern Pines, NC', rank: 72 },
  { name: 'Pine Needles Lodge and Golf Club', location: 'Southern Pines, NC', rank: 74 },
  { name: 'Quintero Golf Club', location: 'Peoria, AZ', rank: 77 },
  { name: 'PGA Frisco Fields Ranch (West)', location: 'Frisco, TX', rank: 78 },
  { name: "The Classic at Madden's Resort", location: 'Brainerd, MN', rank: 80 },
  { name: 'Marquette Golf Club (Greywalls)', location: 'Marquette, MI', rank: 81 },
  { name: 'Mossy Oak Golf Club', location: 'West Point, MS', rank: 82 },
  { name: 'Edgewood Tahoe Golf Course', location: 'Stateline, NV', rank: 83 },
  { name: 'Wild Horse Golf Club', location: 'Gothenburg, NE', rank: 84 },
  { name: 'Black Mesa Golf Club', location: 'Espanola, NM', rank: 85 },
  { name: 'Trump National Doral (Blue Monster)', location: 'Miami, FL', rank: 86 },
  { name: 'Pinehurst Resort No. 8', location: 'Pinehurst, NC', rank: 88 },
  { name: 'The Park at West Palm Beach', location: 'West Palm Beach, FL', rank: 89 },
  { name: 'The Bull at Pinehurst Farms', location: 'Sheboygan Falls, WI', rank: 92 },
  { name: 'Harbor Shores Golf Club', location: 'Benton Harbor, MI', rank: 93 },
  { name: 'Golden Horseshoe Golf Club (Gold)', location: 'Williamsburg, VA', rank: 96 },
  { name: 'The Pfau Course at Indiana University', location: 'Bloomington, IN', rank: 97 },
  { name: 'Reynolds Lake Oconee (Great Waters)', location: 'Eatonton, GA', rank: 99 },
];

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/['']/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

async function main() {
  console.log('=== Step 1: Update existing courses with featured flag ===');

  for (const upd of existingUpdates) {
    const { data, error } = await db
      .from('courses')
      .update({
        name: upd.newName,
        slug: slugify(upd.newName),
        is_featured: true,
        gd_ranking: upd.rank,
      })
      .eq('name', upd.currentName)
      .select('id, name');

    if (error) {
      console.error(`  FAILED to update ${upd.currentName}:`, error.message);
    } else if (data && data.length > 0) {
      console.log(`  Updated: ${upd.currentName} → ${upd.newName} (rank #${upd.rank})`);
    } else {
      console.log(`  NOT FOUND: ${upd.currentName} — will insert instead`);
      missingCourses.push({ name: upd.newName, location: upd.location, rank: upd.rank });
    }
  }

  console.log('\n=== Step 2: Insert missing courses ===');

  let insertedCount = 0;
  let skippedCount = 0;
  const insertedIds: string[] = [];

  for (const course of missingCourses) {
    // Check if already exists (by name)
    const { data: existing } = await db
      .from('courses')
      .select('id, name')
      .eq('name', course.name)
      .limit(1);

    if (existing && existing.length > 0) {
      // Just update the featured flag
      await db
        .from('courses')
        .update({ is_featured: true, gd_ranking: course.rank })
        .eq('id', existing[0].id);
      console.log(`  Already exists, flagged: ${course.name} (#${course.rank})`);
      insertedIds.push(existing[0].id);
      skippedCount++;
      continue;
    }

    const slug = slugify(course.name);
    const { data, error } = await db
      .from('courses')
      .insert({
        name: course.name,
        slug,
        location: course.location,
        country: 'United States',
        is_featured: true,
        gd_ranking: course.rank,
      })
      .select('id, name');

    if (error) {
      console.error(`  FAILED to insert ${course.name}:`, error.message);
    } else if (data && data.length > 0) {
      console.log(`  Inserted: ${course.name} (#${course.rank})`);
      insertedIds.push(data[0].id);
      insertedCount++;
    }
  }

  console.log(`\n  Inserted: ${insertedCount}, Already existed: ${skippedCount}`);

  console.log('\n=== Step 3: Add to course_queue for deep_research enrichment ===');

  // Get all featured courses that need enrichment (no description yet)
  const { data: needEnrichment } = await db
    .from('courses')
    .select('id, name, location, country')
    .eq('is_featured', true)
    .or('description.is.null,description.eq.');

  if (needEnrichment && needEnrichment.length > 0) {
    // Check which are already in queue
    const { data: existingQueue } = await db
      .from('course_queue')
      .select('name, location');

    const queueSet = new Set(
      existingQueue?.map((q: any) => `${q.name}|||${q.location}`) || []
    );

    let queuedCount = 0;
    for (const course of needEnrichment) {
      const key = `${course.name}|||${course.location}`;
      if (queueSet.has(key)) {
        // Update existing queue entry to pending + deep_research
        await db
          .from('course_queue')
          .update({ status: 'pending', priority: true })
          .eq('name', course.name)
          .eq('location', course.location);
        console.log(`  Queue updated: ${course.name}`);
        queuedCount++;
        continue;
      }

      const { error } = await db
        .from('course_queue')
        .insert({
          name: course.name,
          location: course.location,
          country: course.country || 'United States',
          status: 'pending',
          priority: true,
        });

      if (error) {
        // May fail if unique constraint - try upsert approach
        console.log(`  Queue insert note for ${course.name}: ${error.message}`);
      } else {
        console.log(`  Queued: ${course.name}`);
        queuedCount++;
      }
    }
    console.log(`  Total queued for enrichment: ${queuedCount}`);
  } else {
    console.log('  All featured courses already have descriptions!');
  }

  console.log('\n=== Step 4: Verification ===');

  const { data: allFeatured } = await db
    .from('courses')
    .select('gd_ranking, name')
    .eq('is_featured', true)
    .order('gd_ranking');

  console.log(`Total featured courses: ${allFeatured?.length}`);

  const ranks = allFeatured?.map(c => c.gd_ranking).filter(Boolean).sort((a: number, b: number) => a - b);
  const expectedRanks = Array.from({ length: 100 }, (_, i) => i + 1);
  const missing = expectedRanks.filter(r => !ranks?.includes(r));

  if (missing.length === 0) {
    console.log('All 100 rankings present — no gaps!');
  } else {
    console.log(`Missing rankings: ${missing.join(', ')}`);
  }

  // Print full list
  console.log('\n=== Full Top 100 List ===');
  allFeatured?.forEach(c => console.log(`#${c.gd_ranking} - ${c.name}`));
}

main().catch(console.error);
