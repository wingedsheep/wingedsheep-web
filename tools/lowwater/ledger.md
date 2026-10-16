# Low Water ledger

The loop's memory. Each session reads this, does one thing, and updates it. Newest entries first in
**Done**. Keep **Ideas** as a pool, not a queue: pick what fits the flat best now, and add new ideas
freely, but strike ones that turn out wrong for the place (with a word on why).

Additions since the last polish pass: 3 (a polish pass is due when this reaches 4)

## Done

- **The stick** ("the note the tide takes"): a bleached stick stuck in a broad new bank west of the
  way out, level with the ring (`SAND`, `LINE`, `STICK` in world.ts). Its card has a one-line box:
  write up to 24 characters and you take the stick, walk to the line's start and step along it,
  cutting each letter as the tip gets there (a dry scrape per letter, WebAudio `sandScratch`). The
  letters are a 5×7 capital font laid as grooves in the sand (src/island/lowwater/sand.ts: an
  InstancedMesh, a dark cut with a pale lip on its near side); each groove fills on its own, water
  first, then the edges slump, then smooth, about one to one and a half minutes, six times faster
  wherever the water's over it. When you finish, the stick goes back in the sand past the last
  letter, the view drifts back to take in the whole line, and the card keeps quiet till you walk
  off. The line is never stored or sent, and the input is cleared as you write. A click or a key
  calls you away mid-line; the letters not cut yet never are.
- **The bell buoy** ("a belton"): out in the deep water east of the last twig (`BUOY` in world.ts), a
  red-and-white safe-water buoy with a red ball on top and a bell in its cage (`buoy` in
  tools/models/lowwater.py). It rocks on two slow swells that drift in and out of step, harder in
  the island's wind; when it swings back from a big enough lean, the bell sounds (a ring goes out
  on the water), so on a still evening it speaks every quarter-minute or so and in a gale every two
  seconds. Heard from where it is: panned and duller with distance, faint from the table, clear at
  the edge, and you hear it before it comes up over the horizon. On a phone, close to, felt as a
  10 ms tick. Light: a long white flash, two seconds in ten. Recorded toll (`lowwater-bell`, two
  takes, its own lazily loaded `lowwater` set in sound.ts), synthesised partials until it's in.
  Clicking anything past the deep water now walks you to its edge rather than into the sea.
- **The wreck** ("the ribs of an old tjalk"): the black ribs of an old tjalk off to the east of the way out, between
  the table and the bench (`WRECK` in world.ts), listing to one side, stem standing tallest, a
  leeboard come off beside it. The flat's first Blender model: tools/models/lowwater.py, exported to
  public/models/lowwater.glb (`--only lowwater` in build.py) and loaded lazily by the world. The tide
  is only centimetres here, so the *sand* moves instead: how deep it's buried follows the date (two
  slow swells, 37 and 11 days), and the card's last line says how much is out today. Clipped at the
  waterline, reflection and all; you can walk in through the broken stern along the keel.
- **The flat itself** (5238c95): the walkable tidal flat at blue hour, stepped sky, mirror water, fading
  footprints, sandbanks with a breathing tide, the pricken route, the island's rain/fog/wind. The
  stations along the route: the post, the twigs, the tide pool (noctiluca), the stone ring (just
  intonation), the table (things I like), the bench (Cassiopeia and the Plough), the last twig. The
  entry: seven birch twigs under the north cliffs, lantern from dusk to dawn.

## Ideas

- **The other sky**: the water's reflection shows the southern sky (the Southern Cross, the Magellanic
  Clouds) instead of the one overhead. Only noticed if you look down. No card; maybe one line if you
  stand still over it long enough.
- **The island on the horizon**: Vincent's island as a tiny dark silhouette far to the south, with the
  lighthouse's beam turning, so you know where home is.
- **A postcard proof**: a slate propped against a stone with Euclid's proof that there are infinitely
  many primes, chalked in four lines, legible in pixel type.
- **Tide table post**: a weathered tide gauge (peilschaal) with markings, showing the flat's own tide
  in real time. Card on how tides are two bulges and a spinning Earth, and why there are two a day.
- **A gully (geul)**: a winding channel of deeper, darker, moving water the route has to cross on
  stepping stones, with its own current sound.
- **Mussel bed and oyster reef** as textured dark patches, crunchy footsteps over them.
- **A dinghy** stuck in the mud, oars shipped, tilted on its keel, waiting for the tide.
- **Seasons and moments**: frost crust and ice floes (kruiend ijs) in winter, a heat shimmer in high
  summer, the long light around midsummer, one candle on the table on the island's special days that
  fit (never birthdays past the day).
- **Distant birds**: oystercatchers' piping and curlews, far off, never seen (sound only).
- **The walk out at night**: when the island is in deep night, the flat's blue hour gets darker and the
  noctiluca brightens along the waterline wherever you step.

## Known issues

- From the bank where you write, the table far out reads as a pale white outline in the haze (its
  near side is lit, the rest goes to the stepped fog's palest step); same family as the wreck's
  pale far end, but more noticeable. Look at it on the polish pass.
- The stick is a thin pale tick from the route; it's found by walking or hovering, which is meant,
  but check it doesn't read as just another twig.
- The writing bank keeps the line dry at high tide, so the tide only takes the ends; the water
  "seeping in" is what smooths the middle.
- The buoy's reflection goes pale in the stepped haze (it sits near the horizon), so it reads a
  little lighter than the buoy itself; same cause as the wreck's pale far end.
- The bell buoy's toll has never been listened to by a person (two ElevenLabs takes, checked only
  by spectrogram).
- In fog, a sandbank right at the horizon on the left stays dark against the mist (seen from near the
  wreck); it should go to haze like everything else that far out.
- Far ends of the wreck go pale in the stepped haze while the near end is black; it reads as distance,
  but check it on the next walk.
- Sound (water wash, stone notes, footsteps) has never been listened to by a person.
- Winter ice on the banks is only a faint tint.
- `just check` can't run (`astro check` refuses TypeScript 7); use `npx tsc --noEmit`, where one old
  error in astro.config.mjs is expected.
