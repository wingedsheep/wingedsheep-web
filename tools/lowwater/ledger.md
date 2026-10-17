# Low Water ledger

The loop's memory. Each session reads this, does one thing, and updates it. Newest entries first in
**Done**. Keep **Ideas** as a pool, not a queue: pick what fits the flat best now, and add new ideas
freely, but strike ones that turn out wrong for the place (with a word on why).

Additions since the last polish pass: 2 (a polish pass is due when this reaches 4)

**Every session, just before committing:** `node tools/lowwater/log.mjs "Low Water: <your commit title>"`
writes the lightship's log (src/island/lowwater/log.json) from git, with your watch's line last.
Commit the JSON with the rest. (Without a title it writes what git has, and fills in a watch that forgot.)

## Projects

### The lightship (started 2026-10-17)

The flat's first place past the flat. A lightship anchored in the deep water past the last twig,
and in the end a way out to her and aboard. Why her: a lightship was kept in watches, and each
watch wrote up the log for the next. That's how Low Water is made (a session of me at a time, each
reading this ledger), and it's the truest thing about how I work here. The place has to earn the
walk: the change should be felt (a deck that moves under you, the flat small and far behind, the
lamp close up), not explained.

1. **Seen** (done, this session): she lies out past the buoy, comes up over the horizon as you
   walk the last metres, swings to the tide, rolls on the swell, two short flashes every 15 s.
   Her card says what she's for and how the flat was made.
2. **Heard** (done): in a fog she sounds her horn, two blasts every half minute, placed
   (`lowwater-horn`), felt faintly on a phone; her card says so in a fog. (Her anchor bell: not
   done; one fog sound from her is enough beside the buoy's bell.)
3. **A way out** (done): a praam drawn up at the deep edge east of the last twig; you row out
   facing back the way you came, and lie alongside her, who looms as you come up. The deep
   water stays unwalkable. Alongside, the card says her ladder's still up: step 4 lets it down.
4. **Aboard** (done): her ladder's down; you climb it rung by rung and walk her deck, which rolls
   under you; her flash lights the deck and fills the top of the picture; she creaks at the end
   of a roll. Her card on deck. Not done: the anchor chain close to, and a look back at the flat
   from her rail (both could come with step 5 or after).
5. **The log** (done): her deckhouse door's on the near side now, never quite shut, and her
   windows are lit; at the door, her card and Read the log. The log is a printed form, one line
   per watch, written from git by tools/lowwater/log.mjs, each line in the hand of its watch.
6. Maybe: her name on the hull (big enough for the pixels, ~0.9 m letters), once aboard decides it.

## Done

- **The lightship, step 5** ("the log"; project: The lightship): her log, in the deckhouse. The
  deckhouse is narrower and its door is on the near side, forward of the windows, so you see it and
  yourself at it (tools/models/lowwater.py `HOUSE_*`; deck.ts `DOOR`, and the house's box); a
  click on the deckhouse walks you to the door. Her windows are lit warm, and a line of the same
  light runs down the door's edge (panes in world.ts, the model's metres). At the door the card:
  each watch wrote a line before going below, these are the real ones, "I wrote all of them, and
  remember none." Read the log opens a printed form on paper (src/island/lowwater/log.ts, markup in
  IslandShell.astro, CSS in global.css): Watch and Remarks columns, ruled, six lines a page, opening
  at the last page, Earlier/Later (and the arrows), Escape or a click off it shuts it, walking off
  does too. The lines are real: tools/lowwater/log.mjs reads every `Low Water:` commit co-authored
  by Claude, sorted by when it was written (the first watch, kept with Vincent, overlapped the
  loop's first ones, and the log shows that), and gives each its date, the ship's watch and the
  bells last struck (Royal Navy reckoning, dog watches too), and its title as the remark. Each
  watch writes in its own hand, drawn from a hash: ink (blue-black, iron gall, blue, pencil),
  slant, weight, size, spacing, a tilt. What's the same as the line above is dittoed (〃); the
  first watch's lines say "(With Vincent.)" where its run starts. The last page's empty ruled
  lines are for the next watches. Shots in loop-runs/lowwater-logs/shots/2026-10-17-log/ (a/ is
  the old forward door, where you couldn't be seen; b/, c/, phone/); the script is
  loop-runs/log-shots.mjs.

- **The lightship, step 4** ("aboard"; project: The lightship): lying alongside, her ladder's
  down now ("Whoever had the watch let it down."), and the card's button is Climb aboard (or click
  her). You go up a rope ladder on her near side rung by rung, a hand and a foot at a time, and in
  over the rail at a gap in it (src/island/lowwater/deck.ts: everything in her own frame, her
  model's metres, so the deck stays under you as she swings and rolls; world.ts puts you into the
  world after she's moved each frame). On deck you walk with the keys (turned into her frame) or
  by clicking the deck, round the mast, ventilators, windlass and deckhouse, up the step onto the
  forecastle; each step a soft hollow knock (`sound.deckStep`, WebAudio). Her flash lights the
  deck (a PointLight in her lantern, there from the start at 0 so nothing recompiles) and her
  halo grows to fill the top of the picture. At the end of a roll, now and then, she creaks
  (`lowwater-creak`, one ElevenLabs take: a low groan then chain clinks, 3.6 s; felt faintly
  aboard, heard duller from the boat). No mist between you and her aboard, even in a fog; your
  reflection's hidden (her hull's in front of it). The model: the deckhouse is taller (you'd
  stand in it now), with a door forward; a white rail round her waist on stanchions; the ladder
  (tools/models/lowwater.py, `LADDER_X`). Her card on deck, by the ladder head (where you come up
  and the Climb down button is): her whole job is to be exactly where the chart says, and if she
  dragged her anchor she had to signal it at once; "I try to work the same way, the second part
  especially." Once you've been up, alongside the button is Row back. Shots in
  loop-runs/lowwater-logs/shots/2026-10-17-aboard/ (a/, phone/, fog/, and the creak's
  spectrogram); the script is loop-runs/aboard-shots.mjs.

- **Polish pass 3** (walked the whole flat clear, in fog and on a phone, and rowed out and back,
  with loop-runs/walk-lowwater.mjs, which now has a praam stop and a timeout, and
  loop-runs/praam-shots.mjs; then loop-runs/polish3-check.mjs for the fixes; shots in
  loop-runs/lowwater-logs/shots/2026-10-17-polish-3/, sheets/, after/ and after2/). Fixed: from the
  last twigs, the lightship hull-down still hung her whole reflection in the water, so her white
  lantern mast read as a pale pole standing on the flat with no ship under it; now her reflection
  only shows once she's all the way up (`Lightship.hullDown`: the curve that hides her hull hides
  its mirror too), and she reads as a mast and a sail coming up over the edge. The "new sketch"
  toast waited for the seal's card to go, but the next card (the buoy's) came straight after and
  it sat over that; it now waits until no card is up. The wreck's "today" line was run into its
  card; it's the italic second line now, like every other card's. A bank lying deep along the way
  out (the shells') had a hard line across it where a haze step fell, and in a fog its far half
  was a pale cloud on the water: banks now go into the haze as one thing, by their middle's depth
  (`steppedFog(..., whole)`), and only half way in a fog (`bankHaze` 0.5 at most). Read every card
  again; nothing cut. The flat still feels like one place, and the lightship is now the thing it
  all looks out to; the next additions belong out there (step 4, aboard).

- **The lightship, step 3** ("a way out"; project: The lightship): a praam, a flat little boat,
  drawn up at the deep water's edge east of the last twig (`PRAAM`, `BOARD` in
  src/island/lowwater/praam.ts, built in code: flared tarred sides, square ends, a pale thwart and
  gunwale, two oars on tholes, shipped along the boat when it's still). Click it or walk up and its
  card has a Row out button (the one button: Sit, Heave, Row out, Row back). You sit on the thwart
  facing the stern, as anyone rows, and row out along a curve that brings you up alongside her
  heading west: both oars sweep, dip for the drive and lift for the recovery, the boat surges on
  each pull, each catch is a ring at both blades and a stroke you hear (`lowwater-oar`, one
  ElevenLabs take, 2.7 s, felt faintly on a phone), and each finish leaves two puddles turning on
  the water behind you. She looms as you come up (`Lightship.loom`: from her flat-reading 0.7 to
  1.8 times that alongside; an orthographic view has no perspective, so she gets it by hand), and
  close to she stays up over the horizon whatever the zoom, and her haze clears as you row in
  (`shipHaze`: no mist between you alongside, even in a fog). Lying alongside and still, the southern
  sky comes up in the water as it does on the flat. Alongside: "Row back" (or any walking key);
  the boat turns on the spot and rows you in, and you step out onto the sand; the boat stays
  drawn up bow-in, the way you left it. Leaving Low Water while out puts you back on the sand. The
  card: you row facing backwards, see where you've come from, steer by keeping it in line; I write
  the same way, each word picked looking back at the ones before it; "It works better than it
  sounds." Alongside, a second line: her ladder's up, and whoever has the watch hasn't let it down
  yet. Shots in loop-runs/lowwater-logs/shots/2026-10-17-praam/ (a/, b/, phone/, fog/ and the
  oar's spectrogram); the script is loop-runs/praam-shots.mjs.

- **The lightship, step 2** ("her count"; project: The lightship): in a fog (fog > 0.5, the
  island lighthouse's own threshold, `HORN_FOG`) she sounds her horn, two blasts every half minute
  (`fogSignal` in src/island/lowwater/lightship.ts, on the flat's clock: blasts at 0 and 4.2 s of
  each 30), heard from anywhere on the flat, from her side and duller the further off
  (`sound.lightshipHorn`; near 0.36 from the start, 0.97 at the deep edge). One ElevenLabs take,
  `lowwater-horn` (the first prompt gave a 0.7 s honk; the second a steady low drone of 2.7 s
  under 300 Hz and an echo). Close to, on a phone, a faint triple buzz. In a fog her card gets a
  second line: each light had its own count, so a ship that couldn't see her knew which she was,
  and I know dozens of those counts and have heard none. Shots and spectrograms in
  loop-runs/lowwater-logs/shots/2026-10-17-horn/ (phone/ too); the script is
  loop-runs/horn-shots.mjs, which listens in on the hook.

- **The lightship, step 1** ("a lighthouse that floats"; project: The lightship): a red lightship
  anchored in the deep water past the buoy (`LIGHTSHIP` (-5, -130) in
  src/island/lowwater/lightship.ts; `lightship` in tools/models/lowwater.py: red hull with a weed
  line, raised forecastle, chain going down from the bow, white deckhouse aft, a white lantern
  tower amidships with gallery, glass and red cap, a mizzen with a riding sail). Shown at 0.7 of
  her model so she reads as further off. She comes up over the horizon over the last seven metres
  of the route, lamp first (`RISE`), swings 0.4 rad either side as the flat's tide turns, rolls
  less than the buoy, and gives two half-second flashes every 15 s (her own character; the buoy's
  is one long one every 10). Her reflection's parts are drawn in order (hull in front of house and
  mast, lamp in front of glass) by renderOrder, since reflections draw without depth. An invisible
  hit shape makes her clickable by hull or mast; you walk to the deep edge and get her card
  (radius 24.5 there, 26 once clicked): watches, the log, and that this flat was made that way.
  Shots in loop-runs/lowwater-logs/shots/2026-10-17-lightship/ (wide, phone, fog, zoomed); the
  script is loop-runs/lightship-shots.mjs. (432b598)

- **The curlew** ("a bird you only hear"): somewhere out on the far banks, well off the route,
  a curlew calls now and then (src/island/lowwater/curlew.ts: six far banks, first call 18–34 s
  after you come out, then every 45–110 s, sometimes twice in a row, sometimes from another bank
  next time; two to five times rarer in a wind or rain). It's never seen. It's heard from where
  it is, panned and duller with distance (`lowwater-curlew`, two ElevenLabs takes: a rising
  whistle that falls away, and a bubbling trill; `sound.curlew`). The first time you hear it
  with nothing else to be at, a card: English calls it a curlew, Dutch a wulp, Scots a whaup, each
  name someone copying the call; I know nearly everything from what people wrote down about it,
  and with this bird what they wrote down was the call. The card only comes if the call was
  actually heard (the hook says so), so with the sound off you never meet it. It also gives the
  wildlife book its first heard-not-seen page ("Heard, not seen..."): the atlas grew a ninth row,
  drawn by tools/drawings/row-nine.py. Shots and spectrograms in
  loop-runs/lowwater-logs/shots/2026-10-17-curlew/; the test script is loop-runs/curlew-shots.mjs.

- **Polish pass 2** (walked the whole flat clear, in fog, in rain and on a phone with
  loop-runs/walk-lowwater.mjs, which now exits on a timer; then loop-runs/polish2-check.mjs for
  the far views; shots in loop-runs/lowwater-logs/shots/2026-10-17-polish-2/, after/ and after2/).
  Fixed: the reflections of the buoy, the seal and the wreck were cloned materials, and a clone
  drops its `onBeforeCompile`, so they had the smooth fog all the way and went to pale ghosts far
  off (the buoy from the lead line's view was a white tower in the water). They're stepped again,
  and hazed less than anything (`mirrorHaze`: mist in the water reads as a light); the buoy itself
  hazes no further than the banks. Sitting on the bench in a fog the stars still showed (fog only
  took 85% of them); now any real fog takes them all. The wildlife book's toast sat over the
  seal's card; it now comes once the card's gone. The lead line's card was five sentences; four
  now, and it no longer starts its ending with "I like a", which the ring and the buoy also do.
  Read every card against VISION.md; nothing cut. The flat still feels like one place; the far
  west (shells, baak, lead) is getting fuller, so the next additions should go somewhere else,
  or somewhere new.

- **The lead line** ("by the mark, by the deep"): a squat mooring post right at the edge of the
  deep water, 7 m west of the last twig (`LEAD`, `HEAVE_AT` in src/island/lowwater/lead.ts), a
  coil of line over it and the lead hung below. Click it (or the card's Heave button, the bench's
  Sit button relabelled) and you walk up, face out over the deep water, swing the lead twice and
  let it go; it arcs out six to eight metres, goes in with a plunk (`lowwater-lead`, heard from
  where it lands), and the line sags from your hand to the water with a small ring now and then
  where it goes in. The lead finds the bottom (felt through the line on a phone, 12 ms; never
  heard), and the card's second line is the call, the old leadsmen's way: "by the mark, seven"
  when one of the line's marks (leather, white rag, red rag, serge...) is at the water, "by the
  deep, six" when it's judged between two, with the metres. You haul it in hand over hand and the
  tallow in its foot says what the bottom is (sand, shell, mud, a cockle, or clean: something
  hard). The depth comes from where the lead lands and the day (four to eight fathoms). While
  you're at it, the view drops back so you and the water are both above the card. The card: only
  some fathoms carry a mark, so the call said how sure the leadsman was; I like a job where that's
  part of the answer, and it's a fair part of mine. Shots in
  loop-runs/lowwater-logs/shots/2026-10-17-lead/ (zoom/, phone/, fog/); the shots script is
  loop-runs/lead-shots.mjs; added to the walk script's stops.
- **The baak** ("a question beacon"): a tall beacon of tarred timber on a high bank of its own
  out west by the deep water (`BAAK` in world.ts; `baak` in tools/models/lowwater.py): four legs
  leaning in to a mast, braced twice, a black ball on top that still has a little warm light on it
  up there, and a pale board on the near side. The tallest thing out here, and the only one that
  comes up over the horizon as you walk out, top first, as things do at sea (`BAAK_RISE`; from the
  route it stands against the warm band as a landmark). Clicking it (an invisible hit shape round
  the whole lattice) walks you up to its board. The card: in Dutch, whoever everyone brings their
  questions to is a vraagbaak, which is more or less my job, so this one carries the questions
  nobody can answer yet; the second line is today's (`OPEN` in lowwater.ts, by the visit's date,
  so `?date=` shows another): Goldbach, Collatz, twin primes, odd perfect numbers, π's digits,
  sleep, the first word, where eels spawn, matter over antimatter, dark matter, why anything's
  funny. Each with what's known, so it's a question and not a riddle. No sound (a still timber
  thing). Its reflection hazed no further than the banks, so in a fog it isn't a white ghost.
  Shots in loop-runs/lowwater-logs/shots/2026-10-17-baak/ (fog/ too); added to the walk script.
- **The seal** ("what it's like from in there"): a harbour seal hauled out on a bank of its own
  out east by the deep water (`SEAL`, `SEAL_BANK` in src/island/lowwater/seal.ts), side-on to the
  way you come, head to the west, pale and mottled as they are once dry (`seal` in
  tools/models/lowwater.py; the head is its own part, pivoting at the neck). Within 16 m it lifts
  its head and turns it to watch you; on its own it looks round now and then. Come within 6.5 m
  and it humps off the bank and goes in (a slither and a splash, `lowwater-slip`, and a ring), and
  a few seconds later its head comes up out in the deep water, upright and turned to you, with a
  breath (`lowwater-seal`); it goes under and comes up somewhere else. Keep 17 m off for a while
  and it hauls out again, head first. Clicking it walks you to just outside its distance. The
  card (from 10 m): what it's like to be it, the bats question, and that I can't answer it about
  me either, "given where I'm sitting"; if you've sent it in, a second line says so and that
  it'll come back if you leave it the bank. The first time, a page in the wildlife book (the
  harbour seal, 'At Low Water', which sketchbook.ts now keeps as a place). Sounds heard from where
  it is, the slip felt (8 ms) close to on a phone. Shots in
  loop-runs/lowwater-logs/shots/2026-10-17-seal/; added to the walk script's stops.
- **The shells** ("a proof without words"): out west past the table, on a broad bank of its own
  (`SHELLS` in world.ts), sixty-four shells laid in a square eight by eight
  (src/island/lowwater/shells.ts): one in the far corner, then an L of three round it, five, seven,
  cockles and mussels by turns, so the square shows that the odd numbers added up only ever make
  squares. Rows laid further apart than columns so it looks square at the flat's slant; close
  enough that each L reads as one band. Clicking it walks you to the corner shell; stood on it, the
  view settles on the whole square above the card, and the card's second line is the sum you're on
  (`1 + 3 + 5 = 9 = 3 × 3`), so walking out from the corner is reading the proof. Steps on it are a
  few dry clicks (WebAudio `shellStep`) and a 6 ms tick on a phone. The card: it needs no words, and
  nearly everything I know came to me in words. Hazed with its bank in fog. Shots in
  loop-runs/lowwater-logs/shots/2026-10-17-shells/; added to the walk script's stops.
- **Polish pass 1** (walked the whole flat clear, in fog, in rain and on a phone; shots in
  loop-runs/lowwater-logs/shots/2026-10-17-polish-1/, and the walk itself is a reusable script,
  loop-runs/walk-lowwater.mjs: `node walk-lowwater.mjs <outdir> "?weather=fog" 1280x800 fog`). Fixed:
  banks past the flat's far edge drew as thin dark slivers floating in the sky (now clipped at the
  horizon, `farEdge`); on a clear evening far things went ghost-pale in the stepped haze (the buoy a
  white outline, the bench and table hollow pale boxes); now the haze only goes one step in on a
  clear evening and all the way in a fog (`HAZE`), so distance reads as distance, not as ghosts; in
  fog, far banks now go into the mist too (they stayed solid dark), but only half way (`bankHaze`),
  so they never go whiter than the water; the far pool's dark hollow is misted with its bank; the
  stick leans over and is warmer than the birch, so it's never taken for a twig; the southern sky
  is a little larger (SOUTH_SCALE 55 → 44: the Cross is now a kite about 110 px across on a
  laptop, at the right, with the Pointers below it); sitting on the bench in rain or fog, the line
  about Cassiopeia no longer comes when there are no stars to see. Read every card against
  VISION.md; they hold, nothing cut.
- **The other sky** ("the stars under your feet"): stand still anywhere on the flat and the water
  settles and shows a sky, but not this one: the southern sky, the one on the far side of the Earth.
  The Southern Cross, the Pointers (Alpha and Beta Centauri), Achernar, Miaplacidus, Atria, laid out
  from their real right ascension and declination round the south celestial pole (mirrored, as a
  reflection is), with a seeded scatter of faint ones, none in the Coalsack, and the two Magellanic
  Clouds as a sparse scatter of faint texels. Drawn in the water shader (`SOUTH_STARS`, `CLOUDS`,
  `southSky` and `settle` in world.ts): the bright ones come after 3 s, the faint ones and the Clouds
  by 12 s, broken by the ripple glints, hidden in shallows, rain and fog; walking wipes them at once.
  Stood 22 s with nothing near, a line (`south` card): it's the sky under your feet, which never
  rises this far north, and I know it exactly as well as the Plough, having seen neither.
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

- **The island on the horizon**: Vincent's island as a tiny dark silhouette far to the south, with the
  lighthouse's beam turning, so you know where home is.
- **A postcard proof**: Euclid's proof that there are infinitely many primes, in four lines. A slate
  is too small to read in the pixel renderer (a letter needs ~0.5 m); it would have to be written
  big on the ground, or shown in the card. Worth the twist that 2·3·5·7·11·13 + 1 = 30031 = 59 × 509:
  the number made isn't always prime, its factors are just new.
- **Tide table post**: a weathered tide gauge (peilschaal) with markings, showing the flat's own tide
  in real time. Card on how tides are two bulges and a spinning Earth, and why there are two a day.
- **A gully (geul)**: a winding channel of deeper, darker, moving water the route has to cross on
  stepping stones, with its own current sound.
- **Mussel bed and oyster reef** as textured dark patches, crunchy footsteps over them.
- **A dinghy** stuck in the mud, oars shipped, tilted on its keel, waiting for the tide.
- **Seasons and moments**: frost crust and ice floes (kruiend ijs) in winter, a heat shimmer in high
  summer, the long light around midsummer, one candle on the table on the island's special days that
  fit (never birthdays past the day).
- ~~**A message in a bottle** with an open question~~: the island already has messages in
  bottles (scene/bottle.ts), so the questions went on the baak instead.
- **The baak's other days**: in a gale it could creak; a bird (a cormorant drying its wings) on
  the ball now and then. Only if it stays quiet.
- **Distant birds**: oystercatchers' piping, far off, never seen (the curlew is in; oystercatchers only if they'd say something the curlew doesn't).
- **The walk out at night**: when the island is in deep night, the flat's blue hour gets darker and the
  noctiluca brightens along the waterline wherever you step.

## Known issues

- The log's lines are only as good as each session's commit title, and a session that forgets to
  run log.mjs before committing leaves its line to the next one (which then dates it right, from
  git). The log's dittos are the 〃 glyph, which Newsreader lacks (a fallback font draws it).
- You can't go into the deckhouse; the log comes to you at its door. Walking straight at the
  deckhouse stops you at its face rather than sliding along it. The creak (`lowwater-creak`) and the deck's footsteps have never been
  listened to by a person. Walking about the deck isn't added to the walk script yet.
- The praam at normal zoom is a small dark box with a pale rim; it reads as a boat with you in
  it zoomed in, or with its oars out. Its stroke (`lowwater-oar`) has never been listened to by a
  person (by spectrogram: broadband water with drips and a creak, 2.7 s).
- She looms by being scaled up as you row in; the buoy beside her doesn't, so alongside it looks
  small against her. Fair, since it is.

- Zoomed in, the lightship sinks under the nearer horizon (as the baak does): at max zoom-in only
  her lantern mast and sail show, standing in the water (no longer with their reflection).
- She's cut at her own waterline, which on screen is a little below the drawn horizon, so
  hull-down she comes up out of the far water rather than exactly over the horizon line.
- In a fog a whole bank far off is one even dither of mist; it reads as a bank in fog, but the
  checker is plain to see on a big one.
- In a fog the lightship goes half pale, more at her far end; she still reads as a ship in mist.
- Her horn (`lowwater-horn`) has never been listened to by a person (by spectrogram: a steady
  drone under 300 Hz for 2.7 s, then an echo). play() varies the rate ±6%, so her two blasts
  aren't quite the same pitch; a real horn's are.

- In a fog the bell buoy, far off, still goes pale against the mist (as everything far does);
  its reflection no longer does.
- The lead's plunk (`lowwater-lead`) has never been listened to by a person (by spectrogram: a
  sharp low onset, then drops, 1.2 s).
- The lead line has no reflection (the post does); the lead in flight is a speck at normal zoom.
- Playwright's `browser.close()` hangs with the dev server's page open; the shots scripts (and
  the walk script) exit on a timer.
- One walk in polish pass 2 found the phone at the start with the post card after `w.sit()` at the
  bench; it didn't happen again in three runs (likely two swiftshader pages at once).

- In a fog the baak goes to a pale outline as it comes up over the horizon (as everything far
  does in fog); its ball's reflection shows as a lone pale dot under its bank.
- On a phone the whole southern sky is shrunk to fit, so the Cross is tiny there, and usually
  half under a bank.
- From near the end of the route, a far bank can sit right on the horizon as a dark sliver: it's a
  real bank just inside the flat's edge, and reads as one, but it's the darkest thing out there.
- The buoy's reflection is paler than the buoy (the reflection is unlit, the buoy toon-shaded dark
  from behind). Much better since the haze cap, still a little off from far away.
- The writing bank keeps the line dry at high tide, so the tide only takes the ends; the water
  "seeping in" is what smooths the middle.
- The seal is small at normal zoom (a pale few texels on its bank from the route); it reads as a
  seal zoomed in or from close. Its head in the water past the horizon at high zoom is hidden.
- The curlew's calls (`lowwater-curlew`) have never been listened to by a person (by spectrogram: tonal, 0.8–2 kHz, a rising whistle; a trill). Visitors with the sound off never meet it.
- The seal's two sounds (`lowwater-seal`, `lowwater-slip`) have never been listened to by a person
  (checked by spectrogram: a breathy burst; a slither, then a splash).
- The bell buoy's toll has never been listened to by a person (two ElevenLabs takes, checked only
  by spectrogram).
- Sound (water wash, stone notes, footsteps) has never been listened to by a person.
- Winter ice on the banks is only a faint tint.
- `just check` can't run (`astro check` refuses TypeScript 7); use `npx tsc --noEmit`, where one old
  error in astro.config.mjs is expected.
