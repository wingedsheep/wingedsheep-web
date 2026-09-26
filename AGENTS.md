# AGENTS.md

## Rules

- **A new animal gets a page in the wildlife sketchbook.** Add an entry to `SPECIMENS` in
  `src/island/sketchbook.ts` with an id that matches the one passed to `spotAnimal`, and draw it
  into the atlas. New drawings go in row seven, drawn in code by `tools/drawings/row-seven.py`.
- **Fit the moment.** Characters, text and visuals should follow the time of day, the season
  and special days, and the weather, including the visitor's real forecast. If a line mentions
  the sun, it shouldn't show in a downpour. Rare sightings keep to their conditions (`Outlook`
  in `scene/sightings.ts`).
- **Words:** the river game addresses the player as *you*, never Vincent. The companion is
  never named on the site. One light joke per beat at most. Career text says "worked on" for
  team work.

## Good to know

- `public/models/*.glb` are build output: change the Python in `tools/models` and run
  `just models` (headless Blender; `just dev` runs it too). Never edit a GLB by hand.
- Blender's (east, north) is the scene's (x, −z): scripts write `V(x, 0, -y)`.
- Clickable = an ancestor with `userData.id` (a Blender custom property `id`), which the Picker
  resolves to its entry in `content.ts`.
- Animals, sightings and the week's props are templates in the GLB, parked out of sight under a
  root tagged `fauna=<name>` or `holiday=<occasion>`, and brought out by the runtime.
- The pixel renderer draws small things only a few texels big, mostly outline. Check new
  visuals in the browser, at normal zoom and zoomed in.
- Preview a moment with query params: `?time=`, `?season=`, `?date=`, `?holiday=`,
  `?weather=` (and `&k=`, `&wind=`, `&temp=`), `?animal=`, `?vincent=`, `?companion=`.
- Visitor progress lives in `localStorage` under `wingedsheep:*` (the journal is
  `wingedsheep:found`). When testing in the user's browser, put it back afterwards.
- `just sounds` reads the ElevenLabs key from `config.yaml`, which stays out of git.
