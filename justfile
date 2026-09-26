# wingedsheep.com: the island
# `just` lists the recipes.

default:
    @just --list

# install dependencies
install:
    npm install

# run the site locally with hot reload
dev: models
    npm run dev

# rebuild the island models from the Blender scripts (headless)
models:
    blender -b --factory-startup -P tools/models/build.py

# render a quick Blender preview of the island (optionally: just preview night)
preview mode="day":
    blender -b --factory-startup -P tools/models/build.py -- --preview /tmp/island-preview.png {{ if mode == "night" { "--night" } else { "" } }}
    open /tmp/island-preview.png

# render a quick Blender preview of the library's inside
preview-library:
    blender -b --factory-startup -P tools/models/build.py -- --only library --preview /tmp/library-preview.png
    open /tmp/library-preview.png

# render a quick Blender preview of the workshop's inside
preview-workshop:
    blender -b --factory-startup -P tools/models/build.py -- --only workshop --preview /tmp/workshop-preview.png
    open /tmp/workshop-preview.png

# render a quick Blender preview of the lighthouse's inside
preview-lighthouse:
    blender -b --factory-startup -P tools/models/build.py -- --only lighthouse --preview /tmp/lighthouse-preview.png
    open /tmp/lighthouse-preview.png

# render a quick Blender preview of the mountain hut's inside
preview-hut:
    blender -b --factory-startup -P tools/models/build.py -- --only hut --preview /tmp/hut-preview.png
    open /tmp/hut-preview.png

# render a quick Blender preview of everything the river scatters along its banks
preview-river:
    blender -b --factory-startup -P tools/models/build.py -- --only river --preview /tmp/river-preview.png
    open /tmp/river-preview.png

# render a quick Blender preview of a career diorama (e.g. just preview-career student)
preview-career scene="student":
    blender -b --factory-startup -P tools/models/build.py -- --only career --scene {{scene}} --preview /tmp/career-preview.png
    open /tmp/career-preview.png

# can every river be got down without touching anything? (e.g. just validate-rivers --seeds 1000, or --river black --seed 195 for a map)
validate-rivers *args:
    @npx esbuild tools/rivers/validate.ts --bundle --platform=node --format=esm --log-level=warning --outfile="${TMPDIR:-/tmp}/validate-rivers.mjs"
    @node "${TMPDIR:-/tmp}/validate-rivers.mjs" {{args}}

# paddle every river for real with the game's own kayak: clean to the take-out, or knocked, capsized, swum? (e.g. just autopilot --seeds 100, or --river coffee --seed 7 to watch one)
autopilot *args:
    @npx esbuild tools/rivers/autopilot.ts --bundle --platform=node --format=esm --log-level=warning --outfile="${TMPDIR:-/tmp}/autopilot.mjs"
    @node "${TMPDIR:-/tmp}/autopilot.mjs" {{args}}

# film the autopilot going down the rivers in the game (e.g. just record --river black --seed 3), into recordings/
record *args:
    @npx esbuild tools/rivers/record.ts --bundle --platform=node --format=esm --log-level=warning --outfile="${TMPDIR:-/tmp}/record-rivers.mjs"
    @node "${TMPDIR:-/tmp}/record-rivers.mjs" {{args}}

# generate the island's sound effects with ElevenLabs (only what's missing; or name some to redo them)
sounds *names:
    @npx esbuild tools/sounds/generate.ts --bundle --platform=node --format=esm --log-level=warning --outfile="${TMPDIR:-/tmp}/sounds.mjs"
    @node "${TMPDIR:-/tmp}/sounds.mjs" {{names}}

# make the rooms' doors (and the workshop's bell) from scratch, no creaks
door-sounds:
    python3 tools/sounds/doors.py

# typecheck
check:
    npx astro check

# production build into dist/
build: models
    npm run build

# serve the production build locally
serve: build
    npm run preview

# copy the build to the server (set DEPLOY_TARGET, e.g. talespinner.io:/var/www/wingedsheep)
deploy target=env_var_or_default("DEPLOY_TARGET", ""): build
    @test -n "{{target}}" || (echo "set DEPLOY_TARGET or pass a target" && exit 1)
    rsync -avz --delete dist/ {{target}}
