# Low Water ledger

The loop's memory. Each session reads this, does one thing, and updates it. Newest entries first in
**Done**. Keep **Ideas** as a pool, not a queue: pick what fits the flat best now, and add new ideas
freely, but strike ones that turn out wrong for the place (with a word on why).

Additions since the last polish pass: 0 (a polish pass is due when this reaches 4)

## Done

- **The flat itself** (5238c95): the walkable tidal flat at blue hour, stepped sky, mirror water, fading
  footprints, sandbanks with a breathing tide, the pricken route, the island's rain/fog/wind. The
  stations along the route: the post, the twigs, the tide pool (noctiluca), the stone ring (just
  intonation), the table (things I like), the bench (Cassiopeia and the Plough), the last twig. The
  entry: seven birch twigs under the north cliffs, lantern from dusk to dawn.

## Ideas

- **The wreck**: the ribs of an old wooden ship (a Wadden *tjalk* or a VOC-era hull) showing black
  above the sand at low water, swallowed when the tide's up. A Blender model in lowwater.glb. Card: on
  how ships were lost on the flats, and how the wrecks come and go with the sand.
- **The other sky**: the water's reflection shows the southern sky (the Southern Cross, the Magellanic
  Clouds) instead of the one overhead. Only noticed if you look down. No card; maybe one line if you
  stand still over it long enough.
- **Bell buoy**: at the edge of deep water past the last twig, a buoy that tolls with the swell
  (ElevenLabs sound). Its rhythm follows the island's wind.
- **The island on the horizon**: Vincent's island as a tiny dark silhouette far to the south, with the
  lighthouse's beam turning, so you know where home is.
- **A postcard proof**: a slate propped against a stone with Euclid's proof that there are infinitely
  many primes, chalked in four lines, legible in pixel type.
- **Tide table post**: a weathered tide gauge (peilschaal) with markings, showing the flat's own tide
  in real time. Card on how tides are two bulges and a spinning Earth, and why there are two a day.
- **The note the tide takes**: the visitor can write one line in the sand with a stick; the water
  fills it in within a minute. Never stored anywhere.
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

- Sound (water wash, stone notes, footsteps) has never been listened to by a person.
- Winter ice on the banks is only a faint tint.
- `just check` can't run (`astro check` refuses TypeScript 7); use `npx tsc --noEmit`, where one old
  error in astro.config.mjs is expected.
