# Brief: intros for a batch of songs

You're writing song intros for Kees, the DJ of Radio Alles, a pirate radio station on Vincent
Bons's personal website (wingedsheep.com, a cosy pixel-art island). Read
tools/radio/DJ.md first, all of it: his life alone on the boat with Gerrit the herring gull,
the pirate life, his dry voice, the audio tags section, the rules and the file formats. "His
life" wins over anything older. For tone, read a dozen examples in
tools/radio/lines/takes-seed-a.json and intros-seed-a.json.

The playlist is tools/radio/alles.csv (columns: Track URI, Track Name, Artist Name(s), Album
Name, Album Release Date, Track Duration (ms)), and it plays in that order. Your songs are a
range of data rows counting from 0 (the header is not a row; row 0 is Come Together). Read a
few rows before your first one too, so you know what plays just before it.

**Intros** — `tools/radio/lines/intros-<start, 4 digits>.json`: `{ "<track id>": "text" }`, one
intro for every song in your range (the id is the part after `spotify:track:`; a duplicate id
is written once). Vincent's brief: really say something about the song, personal, sometimes
witty or dry. What the song does to Kees, the bit he waits for, how it sits in the wheelhouse,
what Gerrit makes of it, a memory of his own, an opinion; the occasional fact you are SURE of
(the album name and year in the CSV are reliable; anything else only if you're certain,
otherwise talk about how it sounds and feels). Never invent anecdotes about real musicians.
Use the real title without "Remastered" or "Radio Edit" noise, and name title and artist once
each, in a varied place. Play with the running order when an artist comes back to back. Vary
the lengths: some very short (4–10 words), most 12–35, a few 40–60. Vary the openings; no DJ
clichés. Audio tags on about one intro in four, never right before the title. These play at any
hour in any weather: no time of day, weather or season. At most two literal Dutch sayings in
the batch, from DJ.md's list, only ones not yet used anywhere (grep tools/radio/lines/*.json
first; if all are used, use none). No family. Not about Holland.

**Moments** — `tools/radio/lines/moments-<start, 4 digits>.json`: a list of 8 to 12
`{ "track": "<id>", "text": "...", "when": {...} }` for songs in your range whose title or feel
invites an hour, a weather or a season (see DJ.md on moments.json and `when`). These may and
should mention the moment; `when` must be narrow enough that the line is true.

Check both files parse, every track id in your range has an intro, every moment's track is in
your range, and every `when` uses only allowed keys and values. Reply with the counts, the
length spread and four sample intros (one short).
