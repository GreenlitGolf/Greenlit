import { createClient } from '@supabase/supabase-js';

const db = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const urls: { rank: number; url: string }[] = [
  { rank: 1,   url: 'https://www.pebblebeach.com' },
  { rank: 2,   url: 'https://www.bandondunesgolf.com/golf/pacific-dunes' },
  { rank: 3,   url: 'https://www.shadowcreek.com' },
  { rank: 4,   url: 'https://www.destinationkohler.com/golf/whistling-straits' },
  { rank: 5,   url: 'https://www.kiawahresort.com/golf/the-ocean-course' },
  { rank: 6,   url: 'https://www.pinehurst.com/golf/courses/no-2' },
  { rank: 7,   url: 'https://parks.ny.gov/golf-courses/bethpage' },
  { rank: 8,   url: 'https://www.tpc.com/sawgrass' },
  { rank: 9,   url: 'https://www.bandondunesgolf.com/golf/bandon-dunes' },
  { rank: 10,  url: 'https://www.erinhills.com' },
  { rank: 11,  url: 'https://www.pebblebeach.com/golf/spyglass-hill-golf-course' },
  { rank: 12,  url: 'https://www.sandvalley.com/golf/the-lido' },
  { rank: 13,  url: 'https://www.bandondunesgolf.com/golf/old-macdonald' },
  { rank: 14,  url: 'https://www.arcadiabluffs.com' },
  { rank: 15,  url: 'https://www.bandondunesgolf.com/golf/sheep-ranch' },
  { rank: 16,  url: 'https://www.destinationkohler.com/golf/blackwolf-run' },
  { rank: 17,  url: 'https://www.pasatiempo.com' },
  { rank: 18,  url: 'https://www.sandvalley.com/golf/sand-valley' },
  { rank: 19,  url: 'https://www.frenchlick.com/golf/petedye' },
  { rank: 20,  url: 'https://www.streamsongresort.com/golf/red' },
  { rank: 21,  url: 'https://www.bandondunesgolf.com/golf/bandon-trails' },
  { rank: 22,  url: 'https://www.fourseasons.com/lanai/golf' },
  { rank: 23,  url: 'https://www.kapalua.com/golf/plantation-course' },
  { rank: 24,  url: 'https://www.landmandgolf.com' },
  { rank: 25,  url: 'https://www.karstencreek.com' },
  { rank: 26,  url: 'https://www.seapines.com/golf/harbour-town-golf-links' },
  { rank: 27,  url: 'https://www.streamsongresort.com/golf/blue' },
  { rank: 28,  url: 'https://www.chambersbaygolf.com' },
  { rank: 29,  url: 'https://www.sandvalley.com/golf/mammoth-dunes' },
  { rank: 30,  url: 'https://www.pinehurst.com/golf/courses/no-10' },
  { rank: 31,  url: 'https://www.maunakeabeachhotel.com/golf' },
  { rank: 32,  url: 'https://www.pinehurst.com/golf/courses/no-4' },
  { rank: 33,  url: 'https://www.ozarksnational.com' },
  { rank: 34,  url: 'https://www.omnihotels.com/hotels/homestead-virginia/golf' },
  { rank: 35,  url: 'https://www.theprairieclub.com/dunes' },
  { rank: 36,  url: 'https://www.forestdunesgolf.com' },
  { rank: 37,  url: 'https://www.forestdunesgolf.com' },
  { rank: 38,  url: 'https://www.streamsongresort.com/golf/black' },
  { rank: 39,  url: 'https://www.giantsridge.com/golf/quarry-course' },
  { rank: 40,  url: 'https://www.seaisland.com/golf/seaside-course' },
  { rank: 41,  url: 'https://www.greenbrier.com/Golf' },
  { rank: 42,  url: 'https://www.gamblesands.com' },
  { rank: 43,  url: 'https://www.blackdesertresort.com/golf' },
  { rank: 44,  url: 'https://www.pgafrisco.com/golf/fields-ranch-east' },
  { rank: 45,  url: 'https://www.torreypinesgolfcourse.com' },
  { rank: 46,  url: 'https://www.seaisland.com/golf/plantation-course' },
  { rank: 47,  url: 'https://www.tobaccoroad.com' },
  { rank: 48,  url: 'https://www.broadmoor.com/golf' },
  { rank: 49,  url: 'https://www.pronghorngolf.com' },
  { rank: 50,  url: 'https://www.cabotcitrusfarms.com' },
  { rank: 51,  url: 'https://www.palmettobluff.com/golf' },
  { rank: 52,  url: 'https://www.fallenoak.com' },
  { rank: 53,  url: 'https://www.lawsonia.com' },
  { rank: 54,  url: 'https://www.forestdunesgolf.com/the-loop' },
  { rank: 55,  url: 'https://www.cabotcitrusfarms.com' },
  { rank: 56,  url: 'https://www.oldwaverly.com' },
  { rank: 57,  url: 'https://www.bigcedar.com/golf/paynes-valley' },
  { rank: 58,  url: 'https://www.wekopa.com/golf/saguaro' },
  { rank: 59,  url: 'https://yalegolfcourse.com' },
  { rank: 60,  url: 'https://www.tetherow.com/golf' },
  { rank: 61,  url: 'https://www.midpinesinn.com' },
  { rank: 62,  url: 'https://www.taconicgolfclub.com' },
  { rank: 63,  url: 'https://www.tullymore.com' },
  { rank: 64,  url: 'https://www.destinationkohler.com/golf/whistling-straits' },
  { rank: 65,  url: 'https://www.pumpkinridge.com' },
  { rank: 66,  url: 'https://www.pebblebeach.com/golf/the-links-at-spanish-bay' },
  { rank: 67,  url: 'https://www.caledoniagolfandfishclub.com' },
  { rank: 68,  url: 'https://www.destinationkohler.com/golf/blackwolf-run' },
  { rank: 69,  url: 'https://www.truebluegolf.com' },
  { rank: 70,  url: 'https://www.sandvalley.com/golf/sedge-valley' },
  { rank: 71,  url: 'https://www.sunrivergolf.com/crosswater' },
  { rank: 72,  url: 'https://www.southernpinesgolfclub.com' },
  { rank: 73,  url: 'https://www.kiawahresort.com/golf/osprey-point' },
  { rank: 74,  url: 'https://www.pineneedles-midpines.com' },
  { rank: 75,  url: 'https://www.sweetenscove.com' },
  { rank: 76,  url: 'https://www.innisbrookgolfresort.com/golf/copperhead' },
  { rank: 77,  url: 'https://www.quinterogolf.com' },
  { rank: 78,  url: 'https://www.pgafrisco.com/golf/fields-ranch-west' },
  { rank: 79,  url: 'https://www.coghill.com' },
  { rank: 80,  url: 'https://www.maddens.com/golf/the-classic' },
  { rank: 81,  url: 'https://www.marquettegolfclub.com' },
  { rank: 82,  url: 'https://www.mossyoakgolfclub.com' },
  { rank: 83,  url: 'https://www.edgewoodtahoe.com/golf' },
  { rank: 84,  url: 'https://www.playwildhorse.com' },
  { rank: 85,  url: 'https://www.blackmesagolfclub.com' },
  { rank: 86,  url: 'https://www.doralresort.com/golf' },
  { rank: 87,  url: 'https://www.redskygolfclub.com' },
  { rank: 88,  url: 'https://www.pinehurst.com/golf/courses/no-8' },
  { rank: 89,  url: 'https://theparkwpb.com' },
  { rank: 90,  url: 'https://www.theprairieclub.com/pines' },
  { rank: 91,  url: 'https://www.poppyhillsgolf.com' },
  { rank: 92,  url: 'https://www.thebullgolfclub.com' },
  { rank: 93,  url: 'https://www.harborshoresgolf.com' },
  { rank: 94,  url: 'https://www.princeville.com/golf' },
  { rank: 95,  url: 'https://www.cascatagolf.com' },
  { rank: 96,  url: 'https://www.colonialwilliamsburgresort.com/golf/golden-horseshoe' },
  { rank: 97,  url: 'https://www.iugolf.com' },
  { rank: 98,  url: 'https://www.pelicanhill.com/golf' },
  { rank: 99,  url: 'https://www.reynoldslakeoconee.com/golf/great-waters' },
  { rank: 100, url: 'https://www.bayharborgolf.com' },
];

async function main() {
  let updated = 0;
  let failed = 0;

  for (const { rank, url } of urls) {
    const { error } = await db
      .from('courses')
      .update({ website_url: url })
      .eq('gd_ranking', rank);

    if (error) {
      console.error(`  FAILED #${rank}: ${error.message}`);
      failed++;
    } else {
      console.log(`  #${rank} → ${url}`);
      updated++;
    }
  }

  console.log(`\nDone. Updated: ${updated}, Failed: ${failed}`);

  // Verify
  const { data } = await db
    .from('courses')
    .select('name, gd_ranking, website_url')
    .eq('is_featured', true)
    .not('website_url', 'is', null)
    .order('gd_ranking');

  console.log(`\nFeatured courses with website_url: ${data?.length}`);
}

main().catch(console.error);
