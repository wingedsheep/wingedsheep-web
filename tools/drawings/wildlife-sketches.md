# Wildlife sketchbook illustrations

Generated with the built-in imagegen tool. Original reference: `public/art/wildlife-sketches.png`. Final game asset: `public/art/wildlife-sketches-pixel.png`.
The atlas is used by `src/island/sketchbook.ts`: 6 × 6 generated cells (the final feather is reserved), plus a seventh row drawn in code by `tools/drawings/row-seven.py` (starlings, seal).
After any change, run `python3 tools/drawings/untangle-atlas.py public/art/wildlife-sketches-pixel.png` so no animal pokes into a neighbour's page (the serpent's spines once showed up under the robin).

## Prompt

The final asset was edited from the original using the built-in tool with this prompt:

Use case: style-transfer. Edit this exact 6 by 6 wildlife atlas into hand-dithered pixel art for a cozy low-poly pixel island game. Preserve all 36 animals, positions, exact grid and anatomy/identities, one per cell. Replace realistic detailed rendering with deliberately chunky pixels, a very limited warm graphite/sepia palette, simple expressive silhouettes and sparse crosshatching made of pixels. Looks like pixel pencil drawings in an old adventure game's field notebook. Flat uniform cream background #f4ecd9 across every cell. No visible cell dividers, no text, no frames, no gradients, no photorealistic fur. Render at a low-res pixel aesthetic, hard edges, no antialiasing. This is artwork actually inside the game.

Original generation prompt:

Use case: illustration-story. Asset type: wildlife sketchbook illustration atlas for a game. Create a square 6 by 6 grid of exactly 36 equal cells, no borders or text. Each animal centered entirely within its own cell, generous blank margin, consistent warm ivory paper background #f4ecd9. Delicate graphite and sepia pencil naturalist field sketches, light crosshatching, a few muted watercolor accents, charming but anatomically recognizable. No scenery, no lettering, no page folds, no shadows between cells. Row 1 left to right: beaver, otter, moose, brown bear, grey wolf, lynx. Row 2: friendly shaggy yeti, grey heron, mallard duck, red deer doe, white sheep, leaping trout. Row 3: white swan, raven, kingfisher, white sheep with feathered wings, rabbit, red deer stag. Row 4: badger, hedgehog, red fox, crab, red squirrel, herring gull. Row 5: robin, tawny owl, bat, goose, dolphin, humpback whale. Row 6: sea serpent, fluffy duckling, black sheep, white sheep with a star on its back, flying white sheep wearing a red superhero cape, single feather. Keep exact row/column order, one specimen per cell. High resolution square image.
