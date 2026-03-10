-- ============================================================
-- Migration 002: courses table + trip_courses table + seed data
-- Run this in the Supabase SQL editor
-- ============================================================

-- ── 1. courses table ────────────────────────────────────────

CREATE TABLE IF NOT EXISTS courses (
  id                    UUID          DEFAULT gen_random_uuid() PRIMARY KEY,
  slug                  TEXT          UNIQUE NOT NULL,
  name                  TEXT          NOT NULL,
  location              TEXT          NOT NULL,
  state                 TEXT,
  country               TEXT          DEFAULT 'USA',
  emoji                 TEXT          DEFAULT '⛳',
  tags                  TEXT[]        DEFAULT '{}',
  rating                FLOAT,
  price_min             INTEGER,
  price_max             INTEGER,
  tagline               TEXT,
  description           TEXT,
  why_its_great         TEXT[]        DEFAULT '{}',
  courses_on_property   JSONB         DEFAULT '[]',
  lodging_on_property   TEXT,
  lodging_description   TEXT,
  nearby_lodging        JSONB         DEFAULT '[]',
  best_time_to_visit    TEXT,
  walking_friendly      BOOLEAN       DEFAULT false,
  caddie_available      BOOLEAN       DEFAULT false,
  google_place_id       TEXT,
  youtube_search_query  TEXT,
  created_at            TIMESTAMPTZ   DEFAULT NOW(),
  updated_at            TIMESTAMPTZ   DEFAULT NOW()
);

-- ── 2. trip_courses table ────────────────────────────────────

CREATE TABLE IF NOT EXISTS trip_courses (
  id              UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  trip_id         UUID        NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
  course_id       UUID        REFERENCES courses(id) ON DELETE SET NULL,
  -- For AI-suggested courses not yet in the courses table:
  course_name     TEXT,
  course_location TEXT,
  course_price    TEXT,
  added_by        UUID,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(trip_id, course_id)
);

-- ── 3. RLS ───────────────────────────────────────────────────

ALTER TABLE courses     ENABLE ROW LEVEL SECURITY;
ALTER TABLE trip_courses ENABLE ROW LEVEL SECURITY;

-- Courses are publicly readable
CREATE POLICY "Anyone can view courses"
  ON courses FOR SELECT USING (true);

-- trip_courses: only trip members can read/write
CREATE POLICY "Trip members can view trip courses"
  ON trip_courses FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM trip_members
      WHERE trip_members.trip_id = trip_courses.trip_id
        AND trip_members.user_id = auth.uid()
    )
  );

CREATE POLICY "Trip members can add courses"
  ON trip_courses FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM trip_members
      WHERE trip_members.trip_id = trip_courses.trip_id
        AND trip_members.user_id = auth.uid()
    )
  );

CREATE POLICY "Trip members can remove courses"
  ON trip_courses FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM trip_members
      WHERE trip_members.trip_id = trip_courses.trip_id
        AND trip_members.user_id = auth.uid()
    )
  );

-- ── 4. Seed data — 10 flagship courses ──────────────────────
-- NOTE: google_place_id values are approximate and should be
-- verified via the Google Places API Console before launch.

INSERT INTO courses (
  slug, name, location, state, country,
  emoji, tags, rating, price_min, price_max,
  tagline, description, why_its_great,
  courses_on_property, lodging_on_property, lodging_description, nearby_lodging,
  best_time_to_visit, walking_friendly, caddie_available,
  google_place_id, youtube_search_query
) VALUES

-- ── Pebble Beach ─────────────────────────────────────────────
(
  'pebble-beach',
  'Pebble Beach Golf Links',
  'Pebble Beach, CA', 'California', 'USA',
  '🌊',
  ARRAY['Bucket List','Ocean Views','Championship','Walking-Friendly'],
  4.9, 595, 595,
  'The most beautiful 18 holes in golf, where the Pacific Ocean becomes your playing partner.',
  E'There are golf courses, and then there is Pebble Beach. Perched on the Monterey Peninsula with the Pacific crashing against its cliffs, this is the course every golfer pictures when they imagine the game at its most sublime. From the second shot on the iconic 8th — a blind par-4 that crests a hill to reveal the ocean below — to the final three holes hugging the water''s edge, Pebble demands your full attention and rewards it with views that make even a double bogey feel forgivable.\n\nThe course has hosted six U.S. Opens and the AT&T Pebble Beach Pro-Am every February. Walking these fairways alongside the ghosts of Nicklaus, Watson, and Tiger connects you to golf history in a way no other venue in America can match. The par-3 7th — just 100 yards from an elevated tee to a green perched above the crashing surf — is one of the most photographed holes in the world.\n\nFor a group, Pebble Beach is a once-in-a-career experience. Yes, it is expensive. Yes, you''ll need to plan well in advance. But the moment your group stands on the 18th tee with the ocean to your left and the Lodge visible ahead, you''ll understand why golfers save for years to stand here.',
  ARRAY[
    'Six U.S. Open appearances — history is everywhere you look',
    'Spyglass Hill and Poppy Hills provide exceptional variety for multi-day trips',
    'Walking the course with a forecaddie is the only way to truly experience it',
    'Post-round drinks at the Tap Room or Stillwater Bar are non-negotiable',
    'The 17 Mile Drive gives your group a scenic afternoon that rivals the golf itself'
  ],
  '[
    {"name":"Pebble Beach Golf Links","par":72,"holes":18,"description":"The crown jewel — 9 holes along the Pacific cliffs"},
    {"name":"Spyglass Hill Golf Course","par":72,"holes":18,"description":"Tree-lined Monterey pines meet ocean views; arguably harder than Pebble"},
    {"name":"Poppy Hills Golf Course","par":71,"holes":18,"description":"Inland redwood setting, a more affordable complement to the resort courses"},
    {"name":"Pebble Beach Par 3","par":27,"holes":9,"description":"The perfect warm-up or sunset round on the edge of the resort"}
  ]'::jsonb,
  'The Lodge at Pebble Beach',
  'Cottages and rooms steps from the 18th green, with fireplaces, coastal views, and the legendary Tap Room downstairs. Reserve well in advance — this is the most sought-after golf resort accommodation in America.',
  '[
    {"name":"The Inn at Spanish Bay","type":"Resort","price_range":"$$$","url":"https://www.pebblebeach.com/accommodations/the-inn-at-spanish-bay/"},
    {"name":"Carmel Valley Ranch","type":"Resort","price_range":"$$$","url":"https://www.carmelvalleyranch.com/"},
    {"name":"Hofsas House","type":"Boutique Hotel","price_range":"$$","url":"https://hofsashouse.com/"}
  ]'::jsonb,
  'May through October for the driest conditions; expect morning fog year-round',
  true, true,
  'ChIJF5CxNVDGj4ARz3BjBGo3VaI',
  'Pebble Beach Golf Links golf course flyover'
),

-- ── Sand Valley ───────────────────────────────────────────────
(
  'sand-valley',
  'Sand Valley Golf Resort',
  'Nekoosa, WI', 'Wisconsin', 'USA',
  '🏜️',
  ARRAY['Walking Only','Multi-Course','Links-Style','Hidden Gem'],
  4.8, 100, 295,
  'Wisconsin''s answer to Pinehurst — three world-class courses carved through ancient sand barrens where carts are not an option.',
  E'Sand Valley shouldn''t exist. Building a destination golf resort in central Wisconsin — far from any major city, on terrain that resembles the Scottish coast more than the American Midwest — sounds like a fever dream. And yet Mike Keiser, the visionary behind Bandon Dunes, has done it again. Sand Valley is one of the most exciting golf destinations to open in America in the past decade, and word is getting out fast.\n\nThe property sits on an ancient glacial formation called the Central Sand Plains, leaving behind a landscape of rolling dunes, native grasses, and scrubby oaks eerily reminiscent of linksland. Both Sand Valley (Coore & Crenshaw) and Mammoth Dunes (David McLay Kidd) are walking-only — carts aren''t even an option — and that mandate transforms the experience completely. You''ll cover five miles on foot, bag on your back or in a caddie''s hands, connected to every contour and nuance of the terrain in a way riding never allows.\n\nThe Sandbox, a 17-hole par-3 course, provides the perfect warm-up or cool-down. Pair it with a round on each championship course and your group has the ideal three-day itinerary. The clubhouse and lodging are understated but excellent — everything here is in service of the golf.',
  ARRAY[
    'Walking-only policy creates a meditative, connected experience your group won''t forget',
    'Three distinct courses in different styles means no two rounds feel the same',
    'Caddies are knowledgeable, funny, and worth every dollar on these strategic layouts',
    'The Sandbox par-3 is perfect for an evening round or friendly head-to-head competition',
    'Remote location means genuine peace and quiet — no day-trippers, just serious golfers'
  ],
  '[
    {"name":"Sand Valley","par":72,"holes":18,"description":"Coore & Crenshaw design through rolling sand barrens — strategic and endlessly replayable"},
    {"name":"Mammoth Dunes","par":73,"holes":18,"description":"David McLay Kidd''s bold, wide-open layout with massive fairways and heroic elevation changes"},
    {"name":"The Sandbox","par":54,"holes":17,"description":"A 17-hole par-3 for casual rounds and putting competitions — the perfect warmup"}
  ]'::jsonb,
  'Sand Valley Lodge',
  'Modern lodge rooms and cabins centered around a great bar and dining room. Unpretentious, comfortable, and perfectly calibrated to a group that is here purely for the golf.',
  '[
    {"name":"Hotel Mead","type":"Hotel","price_range":"$$","url":"https://www.hotelmead.com/"},
    {"name":"Sentry World area hotels","type":"Various","price_range":"$","url":"https://www.visitmarshallwi.com/"}
  ]'::jsonb,
  'May through October; July and August offer the longest days and warmest temperatures',
  true, true,
  'ChIJ5YOFC4gzBIgRNhKm_f3GKRA',
  'Sand Valley Golf Resort golf course flyover'
),

-- ── Bandon Dunes ──────────────────────────────────────────────
(
  'bandon-dunes',
  'Bandon Dunes Golf Resort',
  'Bandon, OR', 'Oregon', 'USA',
  '🌬️',
  ARRAY['Walking Only','Links Golf','Ocean Views','Multi-Course'],
  4.9, 100, 295,
  'Links golf at its purest — five courses on the Oregon coast where the Pacific wind is always in the conversation.',
  E'If you have never played Bandon Dunes, stop what you are doing and plan the trip. Mike Keiser''s original destination resort remains the gold standard for American golf pilgrimages — a remote stretch of Oregon coastline transformed into the closest thing to Scotland this side of the Atlantic.\n\nThe wind defines everything at Bandon. No two rounds are the same because conditions change constantly, demanding shot-shaping creativity and course management you rarely need elsewhere. Pacific Dunes, designed by Tom Doak, is consistently ranked among the top five courses in the United States. Bandon Dunes (the course) offers a more forgiving introduction to the property; Bandon Trails threads through gorse and shore pines inland; Old Macdonald pays homage to golden-age architecture with enormous greens and bold bunkering; and The Sheep Ranch — a clifftop walking experience with no defined holes — may be the most purely fun round of golf you will ever play.\n\nThe resort is walking-only on all courses. The community of guests, staff, caddies, and shared culture makes Bandon feel like being admitted to the best club you have ever visited — the kind you never want to leave.',
  ARRAY[
    'Five completely distinct course designs means a five-night trip never repeats itself',
    'Caddies at Bandon are legendary — local knowledge, course management, and great stories',
    'The Sheep Ranch is unlike anything else in golf — bring your group for an evening session',
    'Remote location (3 hours from Portland) keeps the vibe exclusively focused on golf',
    'The camaraderie at the bars after rounds is as memorable as the golf itself'
  ],
  '[
    {"name":"Bandon Dunes","par":72,"holes":18,"description":"The original — pure links with ocean views and deceptive difficulty"},
    {"name":"Pacific Dunes","par":70,"holes":18,"description":"Tom Doak''s masterpiece, consistently top-5 USA, clifftop holes are unforgettable"},
    {"name":"Bandon Trails","par":71,"holes":18,"description":"An inland journey through gorse and shore pines — best walking on the property"},
    {"name":"Old Macdonald","par":71,"holes":18,"description":"Golden age homage with enormous greens and dramatic bunkering"},
    {"name":"Sheep Ranch","par":0,"holes":18,"description":"Clifftop walking experience with no tee markers or defined routing — pure golf freedom"}
  ]'::jsonb,
  'Inn at Bandon Dunes',
  'Multiple lodges and cottages across the property, from standard rooms to large group suites. Book well in advance — Bandon fills up fast, especially in summer and fall.',
  '[
    {"name":"Bandon Dunes Cottages","type":"Resort Cottages","price_range":"$$$","url":"https://www.bandondunesgolf.com/accommodations"},
    {"name":"Old Town Inn Bandon","type":"Inn","price_range":"$","url":"https://oldtowninnbandon.com/"}
  ]'::jsonb,
  'June through October for the most stable weather; spring offers dramatic conditions and fewer crowds',
  true, true,
  'ChIJOwg_06VPwokRYv534QaPC8g',
  'Bandon Dunes Golf Resort golf course flyover'
),

-- ── Pinehurst ─────────────────────────────────────────────────
(
  'pinehurst',
  'Pinehurst Resort',
  'Pinehurst, NC', 'North Carolina', 'USA',
  '🌲',
  ARRAY['Historic','Multi-Course','Championship','Package Deals'],
  4.7, 75, 500,
  'The Cradle of American Golf — nine courses, a century of history, and fairways that have shaped the game since 1895.',
  E'Pinehurst is not just a golf resort — it is the spiritual home of American golf. Founded in 1895 and shaped into legend by Donald Ross, who spent 40 years designing and refining the property, the village of Pinehurst and its collection of courses represent a pilgrimage every serious golfer should make.\n\nNo. 2 is the jewel — a Ross masterpiece of crowned greens and deceptive simplicity that has hosted the U.S. Open more times than any other venue. The turtleback putting surfaces are imitated around the world and surpassed by none. But don''t overlook the rest of the portfolio: No. 4 (redesigned by Gil Hanse) is now considered one of the finest courses in the Southeast, and No. 8, a Rees Jones design through Carolina pines, provides genuine variety for multi-day stays.\n\nThe village itself is part of the appeal — strolling from the Carolina hotel to the Ryder Cup Bar for a nightcap, walking the village green, attending the Golf Advantage School. This is golf as a total lifestyle experience, and few places in the world do it better.',
  ARRAY[
    'Nine golf courses means your group can play a different layout every day of a week-long trip',
    'No. 2 is a genuine bucket-list course — the crowned greens are as challenging as advertised',
    'The walkable village of Pinehurst is charming, historic, and full of atmosphere',
    'Package deals at The Carolina and The Holly Inn make multi-day stays excellent value',
    'Year-round Carolina climate makes this a reliable four-season destination'
  ],
  '[
    {"name":"Pinehurst No. 2","par":70,"holes":18,"description":"Donald Ross''s masterpiece — 8x U.S. Open venue with legendary crowned greens"},
    {"name":"Pinehurst No. 4","par":72,"holes":18,"description":"Gil Hanse redesign opened 2018 — bold, modern, and among the best in the Carolinas"},
    {"name":"Pinehurst No. 8","par":72,"holes":18,"description":"Rees Jones design through Carolina pines — excellent walk, great variety"},
    {"name":"Pinehurst No. 9","par":70,"holes":18,"description":"Tom Fazio design — resort-style playability perfect for higher handicappers in the group"}
  ]'::jsonb,
  'The Carolina',
  'A National Historic Landmark with 240 rooms, porches made for rocking chairs, and a dining room serving Southern classics. Golf packages include preferred tee times on No. 2.',
  '[
    {"name":"The Holly Inn","type":"Historic Inn","price_range":"$$","url":"https://www.pinehurst.com/accommodations/holly-inn/"},
    {"name":"The Manor Inn","type":"Inn","price_range":"$$","url":"https://www.pinehurst.com/accommodations/manor-inn/"},
    {"name":"Homewood Suites Pinehurst","type":"Hotel","price_range":"$","url":"https://www.hilton.com/"}
  ]'::jsonb,
  'March–May and September–November for ideal temperatures; summers are hot but manageable with early tee times',
  true, true,
  'ChIJN7-TH4JFrIkRXeQaHfkYFB4',
  'Pinehurst No 2 golf course flyover'
),

-- ── TPC Sawgrass ──────────────────────────────────────────────
(
  'tpc-sawgrass',
  'TPC Sawgrass',
  'Ponte Vedra Beach, FL', 'Florida', 'USA',
  '🏝️',
  ARRAY['Bucket List','Stadium Course','Island Green','PGA Tour'],
  4.7, 125, 400,
  'Home of The Players Championship — the island green 17th is the most photographed par-3 in golf and it is every bit as terrifying in person.',
  E'There is a hole in golf that transcends the game. The 17th at TPC Sawgrass — a short par-3 playing to a green entirely surrounded by water — has ended more professional careers and weekend ambitions than any other hole on earth. Pete Dye built it in 1980 as something of a throwaway idea, and it became the most copied, most discussed, most feared hole in golf. Standing on that tee with your group, knowing what awaits, is one of the great shared experiences in the sport.\n\nThe Stadium Course is more than just the 17th. Dye''s design winds through saw palmettos and lagoons, demanding precision from the tee on most holes. The amphitheater settings on several holes explain the ''Stadium'' name — this course was built for spectators as much as players. Playing it feels like walking through a Sunday at The Players Championship.\n\nDye''s Valley Course provides a more relaxed companion for groups wanting to get competitive on the Stadium and then blow off steam on a less demanding track. The Sawgrass Marriott with multiple pools, spa, and dining makes this a complete resort experience for the whole group.',
  ARRAY[
    'The 17th island green is a bucket-list moment that unites every group around the drop zone',
    'Playing the same course as The Players Championship adds a thrill hard to replicate',
    'The Stadium Course''s amphitheater greens make every hole feel like a tournament setting',
    'Close to Jacksonville airport (45 min) — easy for groups flying in from multiple cities',
    'Excellent resort facilities mean non-golfers in the group are well accommodated'
  ],
  '[
    {"name":"TPC Sawgrass Stadium Course","par":72,"holes":18,"description":"Pete Dye''s tournament masterpiece — precision golf with the legendary island 17th"},
    {"name":"TPC Sawgrass Dye''s Valley Course","par":72,"holes":18,"description":"More forgiving companion course — great for a second-day round"}
  ]'::jsonb,
  'Sawgrass Marriott Golf Resort & Spa',
  'Full-service resort adjacent to the courses with multiple pools, spa, restaurants, and event spaces. Golf packages include preferred access to the Stadium Course.',
  '[
    {"name":"Ponte Vedra Inn & Club","type":"Luxury Resort","price_range":"$$$","url":"https://www.pvresorts.com/"},
    {"name":"One Ocean Resort & Spa","type":"Oceanfront Resort","price_range":"$$$","url":"https://www.oneoceanresort.com/"},
    {"name":"Hampton Inn Ponte Vedra","type":"Hotel","price_range":"$$","url":"https://www.hilton.com/"}
  ]'::jsonb,
  'October through May; summers are hot and humid; avoid The Players week in March unless you book a year out',
  false, false,
  'ChIJSdHF5TFt5IgRQ5r2-Pw67x4',
  'TPC Sawgrass Stadium Course golf course flyover'
),

-- ── Whistling Straits ─────────────────────────────────────────
(
  'whistling-straits',
  'Whistling Straits',
  'Sheboygan, WI', 'Wisconsin', 'USA',
  '⛰️',
  ARRAY['Links-Style','Ryder Cup','Lake Michigan','Championship'],
  4.8, 200, 395,
  'Pete Dye''s faux-links masterpiece on Lake Michigan — 1,000 acres of sculpted terrain that fooled the golf world into thinking it was in Ireland.',
  E'Pete Dye had one of the great creative audacities in golf architecture when he built Whistling Straits: he took the flat Wisconsin lakefront and buried it under 1,000 acres of manufactured duneland, importing sod, sculpting hills, and putting sheep to graze the fescues. The result looks like it was lifted from the Irish coast and transplanted to Lake Michigan, and it is magnificent.\n\nThe Straits course — host to multiple PGA Championships and the 2021 Ryder Cup — plays along the lake with stunning views on nearly every hole. The wind off Lake Michigan is always a factor, and the sheer number of bunkers (over 1,000) demands precision that will humble even scratch players. The Irish Course, while less famous, offers a parkland-influenced layout through the inland portions of the property and provides an excellent contrast to the Straits'' relentless drama.\n\nWhat makes Whistling Straits sing for a group is its combination of extreme challenge on the Straits and the resort facilities of The American Club in Kohler — a world-class property that offers spa, multiple restaurants, and exceptional service. Pairing it with rounds at Blackwolf Run gives your group a four-course Wisconsin odyssey that fills a long weekend beautifully.',
  ARRAY[
    'The Straits hosted the Ryder Cup in 2021 — walking these fairways carries serious prestige',
    'Over 1,000 bunkers demand the kind of strategic thinking that fuels great group conversation',
    'Lake Michigan views from the lakeside holes are genuinely breathtaking',
    'Blackwolf Run next door adds two more outstanding courses to the Wisconsin itinerary',
    'The American Club in Kohler is one of the finest resort experiences in the Midwest'
  ],
  '[
    {"name":"Whistling Straits (Straits)","par":72,"holes":18,"description":"The Ryder Cup course — 1,000+ bunkers, Lake Michigan views, and elite difficulty"},
    {"name":"Whistling Straits (Irish)","par":72,"holes":18,"description":"More inland character, parkland-influenced — a great contrast to the Straits"}
  ]'::jsonb,
  'The American Club',
  'AAA Five Diamond resort in Kohler, 30 minutes from the courses. Tudor-style architecture, Kohler fixtures throughout, fine dining at The Immigrant Restaurant, and a full-service spa. The standard for Midwestern luxury hospitality.',
  '[
    {"name":"Inn on Woodlake","type":"Resort Inn","price_range":"$$","url":"https://www.destinationkohler.com/"},
    {"name":"Sheboygan area hotels","type":"Various","price_range":"$","url":"https://www.visitsheeboygancounty.com/"}
  ]'::jsonb,
  'May through October; summer weekends book up fast, especially around major events',
  false, true,
  'ChIJZ5oa5A-YBYgRWEHkPHxdF7w',
  'Whistling Straits golf course flyover'
),

-- ── Harbour Town ──────────────────────────────────────────────
(
  'harbour-town',
  'Harbour Town Golf Links',
  'Hilton Head Island, SC', 'South Carolina', 'USA',
  '⚓',
  ARRAY['Historic','RBC Heritage','Lighthouse Hole','Lowcountry'],
  4.6, 100, 320,
  'The lighthouse hole defines Hilton Head Island — Pete Dye and Jack Nicklaus built something timeless on the edge of Calibogue Sound.',
  E'Harbour Town Golf Links is one of those rare courses that feels inevitable — as if the 18 holes were already there in the Lowcountry landscape and Pete Dye and Jack Nicklaus simply uncovered them. The layout winds through live oaks draped in Spanish moss, along Calibogue Sound, and culminates at the 18th hole with the red-and-white striped lighthouse as its backdrop — arguably the most iconic finishing hole in American golf outside Augusta National.\n\nBuilt in 1969 as part of the original Sea Pines Resort development, Harbour Town has hosted the RBC Heritage every year since, making it one of the longest-running PGA Tour events at a single site. The course rewards shot-making creativity over power — it plays under 7,000 yards and the tight, tree-lined fairways demand a ball-striker who can work both directions.\n\nFor a group trip, Hilton Head itself provides exceptional infrastructure: excellent dining, beach access, and the broader Sea Pines Resort with additional courses (including Heron Point by Pete Dye) keeps the experience varied across multiple days. This is a classic destination that earns its reputation.',
  ARRAY[
    'The 18th backdrop with the lighthouse is one of the great finishing scenes in golf',
    'Hosted the RBC Heritage for 55+ consecutive years — genuine PGA Tour history underfoot',
    'Sea Pines Resort''s additional courses keep a multi-day trip interesting',
    'Hilton Head is a full-service resort destination with excellent dining and beach access',
    'The tight, shot-shaping layout creates genuine competition and memorable hole discussions'
  ],
  '[
    {"name":"Harbour Town Golf Links","par":71,"holes":18,"description":"The Pete Dye/Nicklaus classic — tight fairways, live oaks, iconic 18th lighthouse backdrop"},
    {"name":"Heron Point by Pete Dye","par":72,"holes":18,"description":"Sea Pines'' secondary Pete Dye layout — marsh views and great variety"},
    {"name":"Atlantic Dunes by Davis Love III","par":72,"holes":18,"description":"Ocean Dunes renovation by Love III — a solid complement to Harbour Town"}
  ]'::jsonb,
  'The Inn at Harbour Town',
  'Boutique inn steps from the 18th green and the lighthouse, within Sea Pines Resort. 60 rooms with Lowcountry decor, a pool, and immediate access to the golf shop and practice facilities.',
  '[
    {"name":"Sea Pines Resort Villas","type":"Resort Villas","price_range":"$$$","url":"https://www.seapines.com/"},
    {"name":"Omni Hilton Head Oceanfront Resort","type":"Resort","price_range":"$$$","url":"https://www.omnihotels.com/hotels/hilton-head"},
    {"name":"Palmetto Dunes Oceanfront Resort","type":"Resort","price_range":"$$","url":"https://www.palmettodunes.com/"}
  ]'::jsonb,
  'March–May and September–November for the best weather; March brings the RBC Heritage — book a year in advance for that week',
  true, true,
  'ChIJPYqBq_iV-4gRdMGDFALkxnQ',
  'Harbour Town Golf Links golf course flyover'
),

-- ── Sea Island ────────────────────────────────────────────────
(
  'sea-island',
  'Sea Island Golf Club',
  'Sea Island, GA', 'Georgia', 'USA',
  '🌴',
  ARRAY['Luxury Resort','Golden Isles','PGA Tour','Southern Hospitality'],
  4.7, 150, 350,
  'Southern hospitality at its most refined — three courses on the Georgia Golden Isles anchored by one of America''s great resort hotels.',
  E'Sea Island occupies a peculiar and wonderful position in American golf: it is both a world-class resort destination and one of the most closely held private communities in the country. The golf club''s three courses — Seaside, Plantation, and Retreat — reflect the landscape of Georgia''s Golden Isles beautifully, routing through maritime forest, past tidal marshes, and along the Atlantic coastline with a grace that feels effortless.\n\nSeaside is the star, hosting the RSM Classic on the PGA Tour each November. The Plantation Course provides a more parkland alternative through mature trees and Spanish moss-draped fairways, while Retreat offers a shorter, more relaxed routing ideal for a casual group afternoon. All three share the same excellent conditioning that makes Sea Island one of the most pristine golf experiences in the South.\n\nBeyond the golf, The Cloister — Sea Island''s legendary resort hotel — is one of the finest properties in the United States: impeccable service, butler-attended beach access, multiple dining rooms, and a spa that will make the non-golfers in your group deeply grateful for the trip. This is a golf trip that doubles as a luxury vacation, and it does both exceptionally well.',
  ARRAY[
    'The Cloister is one of the finest resort hotels in America — non-golfers will be thrilled',
    'Seaside hosts the PGA Tour''s RSM Classic — you''re playing a real tour venue',
    'Three distinct courses keep a multi-day trip fresh and competitively interesting',
    'Butler-attended beach service and world-class spa elevate the off-course experience considerably',
    'Georgia''s Golden Isles are genuinely beautiful — the setting enhances every round'
  ],
  '[
    {"name":"Seaside Course","par":70,"holes":18,"description":"PGA Tour venue — links-influenced with marsh views and coastal character"},
    {"name":"Plantation Course","par":72,"holes":18,"description":"Parkland routing through maritime forest — demanding but accessible"},
    {"name":"Retreat Course","par":72,"holes":18,"description":"More relaxed layout ideal for casual rounds and higher handicappers"}
  ]'::jsonb,
  'The Cloister at Sea Island',
  'Forbes Five-Star, AAA Five Diamond resort hosting American presidents and golf pilgrims since 1928. Beachfront rooms, butler service, and some of the finest dining in the South. A once-in-a-lifetime stay.',
  '[
    {"name":"The Lodge at Sea Island","type":"Golf Lodge","price_range":"$$$","url":"https://www.seaisland.com/"},
    {"name":"King and Prince Resort","type":"Resort","price_range":"$$","url":"https://www.kingandprince.com/"},
    {"name":"Jekyll Island Club Resort","type":"Historic Resort","price_range":"$$","url":"https://jekyllclub.com/"}
  ]'::jsonb,
  'March–May and October–November are ideal; summer is hot and humid but courses are playable with early morning tee times',
  true, true,
  'ChIJi_9BBFSp9ogRjFe3mRuFP8c',
  'Sea Island Seaside Course golf course flyover'
),

-- ── Streamsong ────────────────────────────────────────────────
(
  'streamsong',
  'Streamsong Resort',
  'Bowling Green, FL', 'Florida', 'USA',
  '🌿',
  ARRAY['Best Value','Multi-Course','Walking-Friendly','Off the Beaten Path'],
  4.6, 100, 250,
  'Three bold, fearless courses rising from Florida phosphate country — golf unlike anything else in the state, at prices that shouldn''t be this good.',
  E'Streamsong is the great surprise of American golf. Built on reclaimed phosphate mining land in central Florida, it has no right to be this good. The stripped, otherworldly terrain — undulating hills, ancient oaks, and a network of lakes that look more like a Scottish loch than a Florida pond — creates a canvas that three of the game''s best contemporary architects have used brilliantly.\n\nStreamsong Red, designed by Tom Doak, is the most admired of the three — bold, creative, with the kind of strategic options that reward multiple visits. The Blue, from Coore & Crenshaw, is more subtle but no less satisfying, routing through the most dramatic terrain changes on the property. Black, from Gil Hanse, is the newest and perhaps the most photogenic, with dramatic par-3s and greens that cascade across the landscape.\n\nWhat really makes Streamsong sing as a group destination is the value. Green fees run $100-$250 per round, making a three-course itinerary genuinely affordable. The remote central Florida location means you''re not competing for tee times with day-trippers. This is a golfer''s golfer destination.',
  ARRAY[
    'Three courses from three elite architects — a semester in contemporary design philosophy',
    'Best price-to-quality ratio for top-tier golf in Florida — hard to find this elsewhere',
    'Remote location means the resort is yours — no day-trippers, easy tee times',
    'The terrain is genuinely unlike anything else in Florida golf',
    'Walking all three courses over two or three days is manageable and deeply satisfying'
  ],
  '[
    {"name":"Streamsong Red","par":72,"holes":18,"description":"Tom Doak design — bold greens, strategic brilliance, and the most admired routing on property"},
    {"name":"Streamsong Blue","par":72,"holes":18,"description":"Coore & Crenshaw — subtle, strategic, and endlessly replayable through dramatic terrain"},
    {"name":"Streamsong Black","par":72,"holes":18,"description":"Gil Hanse''s newest addition — photogenic par-3s and flowing greens across the landscape"}
  ]'::jsonb,
  'Streamsong Lodge',
  'Contemporary lodge rooms with views across the property''s lakes. Great bar and dining room, a rooftop pool, and a full driving range. Simple, comfortable, and focused on the golf.',
  '[
    {"name":"Streamsong Lodge Cabins","type":"Resort Cabins","price_range":"$$","url":"https://www.streamsongresort.com/"},
    {"name":"Tampa area hotels (1.5 hrs)","type":"Various","price_range":"$","url":"https://www.visittampabay.com/"}
  ]'::jsonb,
  'November through April for cooler temperatures; summer is hot but uncrowded and rates drop significantly',
  true, false,
  'ChIJQ9nWRRV-3YgROjv0DZLd2OQ',
  'Streamsong Resort golf course flyover'
),

-- ── Kiawah Ocean Course ───────────────────────────────────────
(
  'kiawah-island-ocean-course',
  'Kiawah Island Ocean Course',
  'Kiawah Island, SC', 'South Carolina', 'USA',
  '🌊',
  ARRAY['Bucket List','Ryder Cup','Oceanfront','Championship'],
  4.8, 200, 500,
  'Ten holes on the Atlantic, one Ryder Cup, and the kind of wind that makes scratch golfers feel like beginners.',
  E'The Ocean Course at Kiawah Island is one of the few golf courses that can genuinely be called humbling. Pete Dye''s 1991 design, built for the Ryder Cup known as the ''War on the Shore,'' puts golfers on ten holes directly adjacent to the Atlantic Ocean, where the wind off the water turns routine shots into full-problem-solving exercises. On a breezy day, the Ocean Course will break your ball-striking confidence, your club selection assumptions, and possibly your driver — and you will love every moment of it.\n\nThe course stretches to over 7,800 yards from the tips, making it one of the longest courses in the world, but the playability from appropriate tees makes it accessible enough for a group outing. The key is wind management: every shot at Kiawah requires you to think about where the wind is coming from, where the ball will drift, and whether you are getting more or less club than you think. That shared challenge creates a group bonding experience unlike any other.\n\nThe island itself is a private residential community with resort facilities managed by the Kiawah Island Golf Resort. Four additional resort courses provide options for your group''s remaining days, ensuring a complete multi-day golf trip without leaving the island.',
  ARRAY[
    'Ten oceanside holes create a wind-in-your-face experience that is impossible to forget',
    'Ryder Cup history (1991 War on the Shore, 2021 PGA Championship) gives every round a cinematic quality',
    'The shared difficulty of wind management creates conversation that lasts long after the round',
    'Four additional resort courses keep the trip interesting for multiple days',
    'The island setting — private, quiet, barrier-island beautiful — makes this a full destination vacation'
  ],
  '[
    {"name":"Ocean Course","par":72,"holes":18,"description":"Pete Dye''s 1991 Ryder Cup layout — 10 oceanfront holes, relentless wind, 7,800+ yard tips"},
    {"name":"Osprey Point","par":72,"holes":18,"description":"Tom Fazio design through marsh and forest — a quieter, more forgiving alternative"},
    {"name":"Turtle Point","par":72,"holes":18,"description":"Jack Nicklaus design with three oceanfront holes and classic Lowcountry character"}
  ]'::jsonb,
  'The Sanctuary at Kiawah Island',
  'AAA Five Diamond oceanfront hotel with 255 rooms and suites. Butler service, private beach, multiple restaurants, and direct golf access. A serious splurge that the whole group will remember.',
  '[
    {"name":"Kiawah Island Golf Resort Villas","type":"Resort Villas","price_range":"$$$","url":"https://www.kiawahresort.com/"},
    {"name":"Charleston area hotels (40 min)","type":"Various","price_range":"$$","url":"https://www.charlestoncvb.com/"},
    {"name":"Wild Dunes Resort","type":"Barrier Island Resort","price_range":"$$","url":"https://www.wilddunes.com/"}
  ]'::jsonb,
  'March–May and September–November are ideal; avoid peak summer for heat and peak-season rates',
  false, true,
  'ChIJ6_oFc0fU-4gRB5DvXkzU8LQ',
  'Kiawah Island Ocean Course golf course flyover'
);
