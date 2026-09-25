# wingedsheep.com — The Island

> A portfolio you don't read, you *explore*. The important stuff is on the main path.
> Everything else hides in the corners.

---

## 1. Core concept

You arrive at a small island by kayak. The dock has a signpost pointing to the four things
most visitors want: **Library** (blog), **Workshop** (projects), **Mountain Trail** (career),
**Campfire** (about / contact). Those are always one click away.

Everything else (cats, strange lights, a well you can climb into, a bench to rest on) is
there for people who wander off the path.

**Three rules**
1. **A visitor in a hurry sees everything important within 10 seconds.** There's a signpost,
   a map, and a "just the facts" button that opens a plain CV page.
2. **Curious visitors get rewarded.** Every nook has something in it, and nothing is filler.
3. **Every easter egg ties back to something real about you:** a blog post, a book, a
   hobby, a song.

---

## 2. Pixel art or 3D?

**Recommendation: 2D pixel art, top-down, ¾ view** (Zelda: Minish Cap / Eastward / Stardew).

| | Pixel art 2D | Stylized 3D (e.g. *A Short Hike* look) |
|---|---|---|
| Load time / mobile | Very light, runs anywhere | Heavier; mobile camera controls are fiddly |
| Easter egg density | Cheap to add hundreds of tiny details | Each prop is a modelling job |
| Charm / "your style" | Fits indie games, Silksong, retro | Impressive, dreamy, more "wow" at first glance |
| Hand-crafted feel | Every pixel placed on purpose | Low-poly plus pixelation shader can feel great too |
| Build complexity | Moderate | High (lighting, camera, collisions, perf) |

**Ambitious alternative:** a *low-res 3D diorama* rendered with a pixelation shader, in the
style of *A Short Hike* (which is itself a game about exploring an island and climbing a mountain).
You could glide as the winged sheep, which fits well. I'd still start with 2D and keep this
as a possible "v2 / secret sky island" mode.

**Pixel spec proposal:** 16×16 tiles, a 480×270 internal resolution scaled up by whole
numbers, a limited palette (~32 colours, warm and slightly melancholic, something like
a golden-hour Murakami afternoon), and hand-drawn sprites with 2–4 frame idle animations.

---

## 3. The island map (first sketch)

```
                         ☁  ☁   [Sky Island: the Winged Sheep flock]  ☁
                                        ▲ (secret)
                 ⛰  SUMMIT (now / current role)
                /  switchback cairns = career timeline
      ⭐observatory      \___ bouldering wall
   (UAP / night)   🌲🌲 FOREST  🌲🌲         🗿 stone circle
        |          (running trail loop)       (crop circle field)
   🌊  LIGHTHOUSE          |                        |
        |        ┌─── VILLAGE SQUARE ───┐          🕳 THE WELL
        |        │ 📚 Library (blog)    │         (Murakami otherworld)
        |        │ 🔧 Workshop (projects)│
        |        │ 🎲 Tavern (board games│)
        |        └──────────┬───────────┘
   🏖 hidden cove           |           🔥 campfire clearing (guitar)
   (kayak only)       ⚓ DOCK + signpost  (start here)
                  🛶  ~~~~~~~ sea ~~~~~~~  🐋?
```

### Main destinations (always marked on the map)

| Place | Content | Notes |
|---|---|---|
| **Dock** | Arrival, signpost, map | Your kayak is tied up here, and you can take it out later |
| **Library** | All blog posts | Each post is a book on a shelf, and its spine colour/icon shows its theme (AI, games, music). Opening one gives a real, SEO-friendly article URL |
| **Workshop** | Projects | Argentum (MTG engine) sits on a card table with a playable-looking board. Talespinner is a spinning wheel / loom that spins stories. Mana from the Machine is a card printing press |
| **Mountain trail** | Career timeline | Each switchback has a **cairn** for one role (year, company, what you did). The summit is "now", which works as a metaphor too: the climb keeps going |
| **Campfire** | About me + contact | You (pixel Vincent) are sometimes sitting here. Links to LinkedIn/GitHub/email |

### Places to discover (not on the map until found)

| Place | Interest | What you find |
|---|---|---|
| **Campfire at night / cliff at sunset / lighthouse top / cave / beach** | Music | **Five guitar spots, no video: pure pixel art.** Pixel-Vincent sits at each spot playing guitar, as a hand-animated loop (strumming hand, tapping foot, swaying head, fireflies or waves around him). Zoom in near a spot and faint strumming fades in (after the first click, because of autoplay rules). Clicking him plays the song as a full pixel scene: the camera settles, the lighting changes, and music notes drift up. Each spot gets its own song and its own staging. Finding all 5 completes your "Setlist" in the journal |
| **The Well** | Murakami (*Wind-Up Bird Chronicle*) | Climb down into a surreal inverted version of the island: a hotel corridor, room 208, a Sheep Man in a sheepskin (*A Wild Sheep Chase*) |
| **Two moons** | Murakami (*1Q84*) | At night the sky sometimes has two moons. You can only notice it, and the journal logs it |
| **Talking cat** | Cats + Murakami (*Kafka on the Shore*) | One cat speaks. It gives hints about undiscovered secrets |
| **Observatory** | UAPs | A telescope you can look through. At night: lights moving in patterns that don't make sense, a tic-tac shaped object, a radar screen with a blip |
| **Stone circle / crop field** | UAP + consciousness | Crop circle with a message in it (maybe binary or your initials). Stand in the centre of the stone circle and the screen fades to a "consciousness" moment: a short quote, the island dissolving into dots |
| **Meditation cave** | Consciousness | A mirror pool that reflects a slightly different island |
| **Bench (several)** | Silksong / Hollow Knight | Sitting on a bench "saves" your journal progress, with a little silk-thread animation. A tiny red-cloaked, needle-carrying bug appears on a far cliff and vanishes when you get close. This is an homage, not copied sprites |
| **Bouldering wall** | Bouldering | Painted problems with V-grades. Click holds in order to "send" it and get a chalk-puff animation |
| **Running trail** | Running | A loop around the forest with a start/finish arch. It times your loop, and the ghost of your fastest run stays in localStorage |
| **Hidden cove** | Kayaking | Only reachable by taking the kayak out from the dock. It has a treasure chest (Easter egg: something small and personal) |
| **Tavern** | Board games | A shelf of board games. One table is a **Carcassonne** layout (links to your *Programming Carcassonne* post), and meeples are hidden around the island to collect |
| **Museum of Imaginary Art** | AI | A real gallery building holding the art from your blog post |
| **Imaginary creatures** | AI | Strange creatures from your "Exploring another planet" post live in the tall grass and flee when you approach |
| **Robot gardener** | AI | A little robot tending the garden. Talk to it. (Optional: an LLM-powered "island oracle" that answers questions about you. Costs money and needs guardrails, so v2) |
| **Lunar lander** | AI (DQN post) | Something occasionally tries to land on the moon at night. Sometimes it crashes |
| **Dreamhold door** | AI (GPT-4 post) | A locked door with a tiny text adventure parser: `> open door` |
| **Gramophone** | Music (AI Song Contest 2021) | Plays your AI song entry |
| **Radio tower / Quantum Aeon** | Sci-fi + AI + UAP | Picks up an alien signal, which is the "story written by alien intelligence" |
| **Library back room** | Books | Fantasy/sci-fi shelves. Hover a spine to see the title and your one-line take |
| **Sky Island** | 🐑🪽 | The final secret: once you've found enough things, a winged sheep lands and flies you to a cloud island with the whole flock. It could hold a thank-you note, credits, or a guestbook |

---

## 4. Interaction model: a living diorama (DECIDED: no avatar)

The island is a **living pixel diorama** that you pan, zoom and poke. There's no character to steer.
It's closer to *Townscaper*, *Machinarium* or a hidden-object book than to Zelda.

- **Camera**: drag or scroll to pan, pinch or scroll to zoom (fixed zoom levels, like 1×/2×/3×, so
  the pixels stay crisp). It starts zoomed out on the whole island, with the dock in the centre.
- **Hover/tap = discovery**: objects wiggle, glow or show a tiny label when hovered. On mobile,
  the first tap highlights and the second tap opens.
- **Zoom reveals detail**: at 1× you see buildings. At 3× you see the cat on the roof, the
  meeple in the grass, and the tiny bug on the cliff. **Zooming in becomes the exploring.**
- **Clicking a building** zooms the camera into it and opens its panel (library shelf, workshop
  table, career trail).
- **Things move on their own**: pixel-Vincent walks between spots (guitar at the campfire,
  reading in the library, climbing the boulder), cats wander, boats drift. Clicking him
  shows what he's doing right now.
- **The winged sheep** is the island's mascot and guide. It flies lazy loops over the island,
  and following it (clicking it) leads you toward undiscovered things. Once you've found
  enough, it takes you to the Sky Island.
- **Audio by proximity**: the camera's focus point is "where you are". Zooming in near the
  campfire fades in faint guitar (after the first click, because of autoplay rules).

Some adaptations for the no-avatar model:
- *Kayak*: click the kayak and it paddles around the coast while the camera follows, then
  reveals the hidden cove.
- *Running trail*: click the start arch and pixel-Vincent runs the loop. Click him mid-run to cheer.
- *The Well*: click it repeatedly (or zoom all the way in) and you "fall" into the otherworld.
- *Bouldering*: click the holds in the right order.

---

## 5. Systems that make it feel alive

- **Day/night cycle tied to the visitor's real local time.** UAPs, two moons and the
  observatory only happen at night, so people have a reason to come back.
- **Weather**: rare rain and fog. Maybe the cat hides in the rain.
- **Field journal** (the key to discoverability): a notebook with sketched silhouettes of
  undiscovered things ("???", 23/48 found), stored in localStorage.
- **Fog-of-war map** that fills in as you explore. The main destinations are always visible.
- **Ambient sound**: waves, wind, birds, a chiptune loop per area. **Muted by default** with an
  obvious toggle.
- **Classic web easter eggs**: the Konami code, an ASCII winged sheep in the dev console
  ("Hi fellow dev, try `island.secrets()`"), a source-code comment, and a 404 page where you're
  lost at sea.
- **"Just the facts" mode**: a fast, accessible, plain HTML version (CV, blog list, projects,
  contact). This matters for recruiters, screen readers and SEO.

---

## 6. Tech stack (researched, Sept 2026)

### Summary

| Layer | Choice | Why |
|---|---|---|
| Site framework | **Astro 6** | Static by default, Markdown content collections, real per-post URLs for SEO and RSS. `transition:persist` keeps the island canvas alive while you navigate to a post and back. Cloudflare acquired the Astro team in Jan 2026 and it stays open source |
| Island renderer | **PixiJS v8** | Without an avatar we don't need a game engine (physics, player controller, scenes). We need a fast 2D renderer with sprites, animation, filters and hit-testing. Pixi is about 200 KB, WebGPU-first with a WebGL fallback, and the most used 2D web renderer |
| Camera | **pixi-viewport** | Drag, pinch, wheel zoom, inertia, clamping, `snapZoom` for smooth zooming, and `follow` (for the kayak and the winged sheep). Supports Pixi v8 |
| Map authoring | **Tiled** → build-time bake | Paint the island in Tiled. A build script bakes the static ground layers into large PNG chunks, and dynamic things (cats, water, fire, NPCs) become separate sprites. Fewer moving parts than a runtime tilemap lib, and I can still hand-paint over the bake |
| Sprites | **Aseprite** → JSON spritesheets | Aseprite exports "JSON hash" sheets that Pixi's `Spritesheet` loads directly, with animation tags → `AnimatedSprite` |
| Day/night | Custom Pixi `Filter` (colour-grade LUT per time of day) + additive **light layer** | Lanterns, the lighthouse beam, the campfire glow, fireflies and UAP lights are additive sprites. They're invisible by day and glow at night |
| Audio | **howler.js** + spatial plugin | Volume and pan are driven by the distance from the camera centre to each sound source. That's how the guitar "fades in as you zoom closer". It handles autoplay unlocking and format fallback |
| UI / panels | Plain **HTML/CSS over the canvas** | Blog, career and project panels are real DOM, not canvas text, so they're selectable, accessible and searchable. The pixel look comes from CSS (a pixel font, 9-slice borders) |
| Fonts | e.g. *m5x7 / monogram* (Daniel Linssen, free) for UI chrome; a readable serif/sans for articles | Pixel fonts for flavour, real fonts for reading |
| Blog migration | Ghost JSON export → script → Markdown + downloaded images | Keep the exact slugs. There are known ghost-to-md scripts, but a custom one is easy with 17 posts |
| State | `localStorage` (journal, found secrets, settings) | Wrapped in try/catch, so the site works without it |
| Hosting | **Own Ubuntu server** (`talespinner.io`) | Static files served by the existing web server/reverse proxy, deployed with a `rsync` script |

### Alternatives considered
- **Phaser 4** (stable since April 2026): a great full engine, and my pick if we had an
  avatar, physics and a game loop. For a pan/zoom/click diorama it's more framework than we need.
- **Kaplay / Excalibur**: nice APIs, but Kaplay is slow for big scenes and Excalibur's community is smaller.
- **Runtime tilemap libs** (`@pixi/tilemap`, `pixi-tiledmap`): both support v8. We can switch to one
  if the island grows too big to bake. Note that `@pixi/tilemap` only fixed a Pixi 8.7+ render bug in July 2026.

### Pixel-perfect rules
- Nearest-neighbour sampling everywhere (`scaleMode: 'nearest'`), `roundPixels: true`.
- Zoom **snaps to whole-number levels** (1×, 2×, 3×, 4× of the base art). Smooth animation between
  levels is fine, but it settles on an integer.
- Base tile 16×16. Characters are about 16×24.

### Accessibility and "just the facts"
- Every clickable island object has a **hidden DOM twin** (a button with a label), so keyboard
  and screen-reader users can tab through the island.
- `prefers-reduced-motion` turns off camera easing and ambient animation.
- `/plain` (and `<noscript>`) is a clean HTML CV + blog + projects + contact page.

### Routing idea
```
/                 the island
/blog/<slug>      a post (opens as a "book" over the island, which stays alive via transition:persist)
/work             career trail (also reachable as a plain page)
/projects         workshop
/plain            just the facts
/404              lost at sea
```

### Phasing
1. **Vertical slice**: a small island with the dock, signpost, library (real blog posts),
   one guitar spot, and plain mode. This proves the look and feel.
2. **Core content**: workshop, mountain career trail, campfire/about, map and journal.
3. **Discovery pass 1**: cats, benches, UAP night, the Well, bouldering, kayak cove.
4. **Discovery pass 2**: the Sky Island, board game meeples, the running trail, audio polish.
5. **Forever**: add a new secret every now and then. The island grows over time.

---

## 7. Decisions so far

- ✅ **2D pixel art**, ¾ top-down
- ✅ **No avatar**: a pan/zoom/click living diorama (see §4)
- ✅ **Blog migrates to Markdown** in the repo, keeping the old slugs
- ✅ **Mood follows day/night** from the visitor's local clock: cozy golden hour by day,
  mysterious by night
- ✅ **Guitar spots = pixel animation + your real recordings.** No video. Audio is extracted from
  the five recordings into small Opus/AAC files that load only when triggered
- ✅ **Blog posts open as a "book" over the dimmed island**, with their own URL. Closing returns
  you to the same camera spot
- ✅ **Scale: a small, dense main island + separate hidden scenes** you travel to (the Well
  otherworld, the Sky Island, the hidden cove, maybe the inside of the observatory). Each hidden
  scene is its own little diorama, with a transition (falling, flying, paddling)
- ✅ **Hosting: your own Ubuntu server** (`ssh talespinner.io`). Deploy the static Astro build
  (e.g. rsync to a web root behind the existing reverse proxy). Keep Ghost running until cutover,
  then add redirects if needed

## 8. Open questions for Vincent

**Content**
- [ ] **Career timeline**: LinkedIn blocks scraping. Can you paste your roles
      (title, company, years, 1–2 lines each)?
- [ ] Do you have cats? Names and colours? (They should be on the island.)
- [ ] Top 5–10 books (for the library shelf), favourite board games, favourite games besides Silksong?
- [ ] Which mountains/climbs/runs/kayak trips mean something to you? (They could be painted
      as landscapes in the lighthouse or be names of trails.)
- [ ] Anything else you'd like hidden: a personal in-joke, your guitar, your city, an old project?
- [ ] Contact channels to show (email, GitHub, LinkedIn, Mastodon/Bluesky, …)?

**Practical**
- [ ] Which web server/proxy runs on the server (nginx, Caddy, Traefik, Docker)? Is Ghost in Docker?
- [ ] Are the five guitar recordings yours to use as audio files (you own them)? Do you have the original files, or should I extract from YouTube?
- [ ] Should the old post URLs keep working exactly? (I assume yes.)
- [x] A pixel/illustrated likeness of you: do you have a photo or description (hair, beard, glasses, usual clothing, guitar type)? Photos are in `tools/reference`.
