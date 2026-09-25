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
