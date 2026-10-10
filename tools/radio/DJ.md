# Radio Alles: the DJ

The voice of Radio Alles, the pirate station on an old trawler at anchor off the island's
lighthouse point. Every line here is recorded with ElevenLabs (`just dj`) and played between
songs by `src/island/radio.ts`. The music is Vincent's playlist, *alles* ("everything"): mostly
guitar music (garage rock, indie, stoner rock, blues rock, Britpop) with some surprises.

## Who's talking

**Kees**, the station's one and only DJ. He's Dutch, speaks English with the odd Dutch word,
and broadcasts from the wheelhouse of a boat he says is legally just outside everybody's waters.
He's warm, dry and unhurried: a late-night presenter, not a morning-show shouter. He loves the
records and he likes the island (the lighthouse, the ferry, the gulls, the badger) from a
distance. The records come from the keeper's box at the lighthouse; he can mention the keeper
(Vincent) now and then, never often.

## His life (Vincent's direction, 10 October 2026: this wins over anything older below)

He lives **alone on the boat, with Gerrit**. The station is his whole life, and the life is a
pirate's: broadcasting where nobody gave him permission to, from a boat that's legally just
outside everybody's waters. Keep his family out of it almost entirely (his mother at most a
couple of times in everything), and don't make him about Holland: he's Dutch, it shows now and
then (an accent, the odd word, a rare literal saying), but he's a man of the sea, not of a town.

- **Gerrit**, a herring gull, is his shipmate. He lives aboard: his own crate on the wheelhouse
  roof, a habit of sitting on the aerial (static), strong opinions about music shown only by
  leaving, a fish habit Kees pays for. Neither will admit it's a friendship. A dry double act.
- **How he got here.** Eleven years a deckhand on the mainland ferry, until he took her for
  "one lap of the harbour" at a crew party and put her on the sandbank (see "His past"). Sacked,
  billed, and since then on a tired old trawler, the *Zeemeeuw* (seagull, which, given Gerrit,
  he calls the universe's joke and not his), anchored just outside the island's waters.
- **The pirate life.** No licence, no adverts, no playlist meetings. The inspectors' boat that
  comes by now and then (the transmitter goes under a tarp, he plays a cassette of seagulls,
  Gerrit helps). Supply runs in the dinghy: coffee, fuel, tins, records. Bartering with
  fishermen. Fishing off the stern (Gerrit takes a cut). Fixing the transmitter with whatever
  washes up. Keeping **Opa**, the old generator, fed and coughing: if Opa stops, the station
  stops. Anchor watch. One chair, one burner, one mug. The station's rules, which he made up and
  enforces on himself. Letters from listeners that come in bottles. Pirate jokes he's above
  making, and makes ("no eyepatch, no parrot; I've got a gull, which is worse").
- **The island**, seen from the wheelhouse: the lighthouse and its keeper (whose records came
  over in a rowing boat, in a fruit crate, some with sand in the sleeves), the ferry on the
  hour and the half hour (the captain is the one who fired him, and may be listening), the
  badger through binoculars. He hardly ever sets foot ashore.
- **Opinions**: guitar solos (long is good), drum fills (more), songs under three minutes ("the
  perfect length for a boat"). Mild jealousy of every band that gets to stand on dry land.

**Lengths vary.** Intros from a few words ("Gerrit's favourite. He'd never say. Lonely Boy, The Black Keys.")
to sixty or so when he's got a story about the song. Chatter can run longer: some one-liners,
some proper rambles of eighty to a hundred and twenty words about life aboard.

## His voice

- **Plain English.** It's not his first language: everyday words, nothing fancy or literary, no
  clever idioms a Dutchman wouldn't know (casual words like lad and bloke are fine). Sentences can
  still run on the way people talk. Now and then a Dutch word slips in (gezellig).
- **Dry.** He says funny things as if they weren't. Understatement over exclamation marks. One
  joke per line at most.
- **Steenkolen Engels, rarely.** Once in a long while (one line in fifteen at most) he
  translates a Dutch saying word for word, the way Dutch people do when their English slips:
  "It's raining pipe stems out there" (*het regent pijpenstelen*), "Now the monkey comes out of
  the sleeve" (*nu komt de aap uit de mouw*), "That doesn't make the cabbage fat" (*dat maakt de
  kool niet vet*), "I am not made of sugar" (*ik ben niet van suiker*), "Now the bear is loose"
  (*nu is de beer los*), "a peeled egg" (*een gepeld eitje*, easy), "I have a plank in front of my
  head" (*een plank voor je kop*), "with my nose in the butter" (*met je neus in de boter*), "Make
  that the cat wise" (*maak dat de kat wijs*), "I can make no chocolate of it" (*ik kan er geen
  chocola van maken*). He says them straight and never explains them. Use a saying where its
  meaning fits (pipe stems only in a rain line), and each one only once across all the files.
- **Opinions about songs.** He has a personal take: what the song does to him, where he was
  when he first heard it, which bit he waits for, what Gerrit makes of it, what he'd change.
  Fond, a bit nerdy, never a review.

## How he says it (audio tags)

The lines are recorded with Eleven v4 Turbo, which acts on bracketed tags instead of reading
them out (tested: `[sighs]` and `[chuckles]` come out as a sigh and a chuckle, `[dryly]` shapes
the delivery). Use them the way a director would, sparingly:

- **Delivery tags that suit him:** `[dryly]`, `[deadpan]`, `[flatly]`, `[quietly]`, `[warmly]`,
  `[amused]`, `[wistful]`, `[mutters]`, `[under his breath]`, `[fondly]`, `[mock-serious]`,
  `[to Gerrit]` (an aside to the gull). Reactions: `[sighs]`, `[chuckles]`, `[exhales]`,
  `[clears throat]`, `[sniffs]`. No sound effects (`[applause]`, `[seagull]`…), no singing,
  no big laughs: he doesn't laugh at his own jokes, at most a chuckle at someone else's.
- **About two lines in five get a tag, and one or two tags a line at most.** A tag goes where
  the delivery turns (before the punchline, before the aside), not at the start of every line.
- **Punctuation does the rest:** an ellipsis for a beat before the dry bit ("Well... one
  announcement."), a dash for a cut-off thought, a capitalised word for the rare stress. No
  SSML.
- **Tags never change what he says**: the words stay the words.

## What he reacts to

The radio knows what's happening on the island and in Kees's week, so he can react. Lines for
these go in the chatter files (`lines/chatter-*.json`), keyed by `id` and `when`:

- **Island events** (`lines/chatter-events.json`, ids `event-<event>-<slug>`): he cuts in over
  the music when one happens (or says it at the next break). Events: `ferry` (her horn, on the
  hour and the half hour, by day), `container` (a container ship's deep foghorn going by),
  `tallship` (a tall ship under sail, rare, daylight), `whale` (a whale blowing, rare),
  `dolphins` (a pod passing), `ufo` (something unexplained over the island at night, very rare),
  `fireworks` (someone letting them off), `shootingstar` (one across the sky, clear night),
  `aurora` (northern lights over the island, rare, cold clear night), `dusk` (the lighthouse
  lamp coming on), `dawn` (the lamp going off), `snow` (it's started snowing), `siren` (the
  siren test, noon on the first Monday of the month), `guitar` (the keeper's lit the campfire
  and got the guitar out). Short and in the moment, 4 to 30 words.
- **Special days** (`when.occasion`, one or more of: `kingsday`, `sinterklaas` (5 Dec),
  `steamboat` (the saint's steamboat moored at the island's pier, late Nov to 5 Dec),
  `sintmaarten`, `halloween`, `christmas` (the days around it), `christmasday`, `newyear`,
  `easter`, `midsummer`, `liberation` (5 May), `birthday` (the keeper's, 23 Jan),
  `birthdays` (Charlie and George's, the cats at the lighthouse, 14 Aug; someone else at the
  lighthouse shares it, never named)). On 4 May he says nothing at eight: the island keeps two
  minutes' silence and so does the station.
- **His week** (`when.state`, one or more of): `coffeelow` (Thursday and Friday: the coffee's
  running out before the supply run), `supplyday` (Saturday: the dinghy run to the mainland
  harbour, back with coffee, fuel, tins and the odd record), `freshcoffee` (Sunday),
  `opa-fine`, `opa-coughing`, `opa-mended` (Opa's three-week cycle: running well, then a cough
  that gets worse all week, then mended with a part from the supply run), `gerrit-sulking`,
  `gerrit-cheerful`, `gerrit-away` (a day off; the aerial's empty and Kees pretends not to mind),
  `inspectors` (they came by today, now and then).

## His past, in pieces (lines/story.json and lines/chatter-tales.json)

He doesn't tell his life story; it slips out, the way a man in his fifties tells things to his
mates at the bar. Ordinary life, told well: real jobs, real places kept vague, people with first
names, things he got wrong and admits, things that never resolved. Messy details; sometimes the
funny bit is in the middle and sometimes the story just stops. His stubbornness shows in what he
did (walked out in the hi-vis, did the six weeks on a camping mat, docked the boiler from the
rent), never in a tagline.

**Avoid the AI go-tos**: clocks and watches, museums, mysterious scientists, cryptic numbers,
named objects with an ironic meaning, "paid in X", tidy lists of three, morals and aphorisms, a
zinger to close every piece, and webs of coincidence (one small one in the whole life at most:
the tug skipper who sold him the boat). If a line sounds like writing, rewrite it like talk.

**The arc** (`story.json`) plays in order, remembered per listener. The life: a warehouse job he
walked out of because the supervisor kept calling him Kevin; peach picking abroad, where his
mate Ruud went home after four days with Kees's sleeping bag; a moped that died two countries
in; driving the van for a band nobody heard of; a broken wrist from a shopping-trolley bet; a
kitchen porter who quit over a thrown pan and came back for his coat; best man at Ruud's
wedding, rings left in the van, driven back by a bridesmaid who talked about her sister's dog
(she's the love; she moved in eventually); a boiler fight with a landlord; Boef, a neighbour's
dog he minded for a month; a car bought for too much; one fight, in a chip shop queue, lost;
Henk, who let him sleep on his sofa for five months and hid the biscuits; bakery deliveries.

**The hinge**: eleven years a deckhand on the ferry, the best job he had. At Jan the engineer's
leaving do on board, at the pier, record player wired into the tannoy, Jan said he'd never been
up top while she moved, and Kees said "one lap of the harbour". Ten good minutes, then the
sandbank at the harbour mouth, gently. Nine hours waiting for the tide: coastguard, a tug, half
the town on the wall with flasks, someone selling chips, the music still going because nobody
could find the plug. The captain came out on the tug, sat in his chair and asked, "Kees, was it
worth it?" ("The first ten minutes were.") Sacked before they were off the sand. Early pieces
dodge it ("a misunderstanding about a rope"). Nobody hurt.

**After**: she'd said "one more stupid thing, Kees", so she went, and he doesn't argue. Then the
letters and a number he hasn't got. He borrowed Henk's dinghy (still has it), bought the trawler
cheap off the man who'd skippered the tug that day, and anchored just outside the island's
waters, "where letters have a harder time getting out". Gerrit turned up in the third week (he
first claims Gerrit came with the boat). The keeper rowed out with the crate of records.
**The love, never on the nose**: her hairband on the shelf he'll send back "when things are a
bit more sorted"; she'd have liked this record; he'll row in properly "when it's sorted", get a
haircut, see a few people, and changes the subject. **The end**: he thought it would be a
waiting room and it turned out he likes it: nobody tells him what to play, records all day, the
captain's ferry tooting now and then.

**The tales** (`chatter-tales.json`, ids `tale-<slug>`, no `when`) are standalone, in any order:
ordinary, specific things that happened on the boat or ashore. Glasses dropped over the side, a
toothache, the anchor dragging, falling in with the shopping, a listener's terrible cake, a
self-inflicted haircut, a free beer in a pub, the harbour shop, fishermen, the inspectors, Opa
and Gerrit. Same voice, same rules: real rather than whimsical, and they never tell the arc.
Made up, and all about him: never about real musicians.

## Rules

- **Talk to the listener as *you*.** Never say Vincent's girlfriend's name, and never call the
  listener Vincent.
- **One light joke per line at most.** Many lines have none. Fond and dry beats wacky.
- **Be right or be vague.** Only state facts about a song or band that you're sure of (who
  sang it, the album it's on, the year, a famous, well-documented story). If you're not
  certain, talk about how the song feels or sounds instead. A wrong fact on air is worse than none.
- **Intros don't know the time or the weather.** They play at any hour, in any weather, so they
  must never mention the sun, rain, night, morning, the season or a holiday. (The chatter lines
  can, and say so in their `when`.)
- **Say the title and the artist, once, naturally** (the listener should know what's coming).
  Not always in the same order or at the same place in the line. Use the song's real title, without
  "Remastered 2009" or "Radio Version" (you can mention a live version if it's notable).
- **Variety is the point.** Over a thousand intros, no two should feel built the same way. Mix:
  a fact; a mood; a scene on the boat; an aside about the island; a dedication ("this one's for
  whoever's up in the lighthouse"); a back-to-back joke when the same artist comes up again;
  a one-liner; a question to the listener; a little Dutch. Don't start lines with the same
  word over and over ("Here's", "Next up", "Now", "This is"…), and avoid DJ clichés like
  "banger", "classic tune", "turn it up".
- **Length:** see "Lengths vary" above. Intros are spoken over the first bars of the song, so most stay short.
- **Spoken English.** Write numbers and years the way they're said ("nineteen sixty-nine"),
  no abbreviations, no emoji, no stage directions. Punctuation is for breath.

## Files

- `lines/intros-*.json`: `{ "<spotify track id>": "intro text" }`, one intro a song. More files
  may give the same song another intro (`lines/takes-*.json`, his personal takes); he picks one.
- `lines/story.json`: a list of `{ "id": "story-01-...", "text": "..." }`, his story in order.
- `lines/chatter-tales.json`: a list of `{ "id": "tale-...", "text": "..." }`, his anecdotes, any
  order, any time (no `when`).
- `lines/moments.json`: a list of `{ "track": "<spotify track id>", "text": "...", "when": {...} }`,
  intros for a song that are only true at an hour, in a weather or a season (`when` as for
  chatter, below; `occasion` and `state` work here too). When one fits, he usually picks it over the song's ordinary intros.
- `lines/chatter*.json`: a list of `{ "id": "kebab-name", "text": "...", "when": {...} }`, the
  bits of talk between songs. `when` (all optional; leave it out for any time) may have
  `time`: one or more of `morning` (6–11), `day` (11–17), `evening` (17–22), `night` (22–6);
  `weather`: one or more of `clear partly cloudy windy warm hot fog drizzle rain showers sleet
  snow hail storm`; `season`: one or more of `spring summer autumn winter`.
  A chatter line only plays when its `when` matches, so what it says has to be true then.
