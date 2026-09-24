# Ghost to Markdown migration notes

The source was the Ghost blog at https://wingedsheep.com/, migrated on 2026-09-25.

## Method

- **Post list.** I checked the sitemap (`sitemap-posts.xml`) and the RSS feed. Both list the same 17 posts as the brief, so no posts were missing. The Ghost *pages* (`about-me`, `ai-art`, `projects`, `projects-old`) are not blog posts and were **not** migrated.
- **Source data.** Content came from the Ghost Content API (the public key is embedded in the site's HTML). The API gives clean post HTML, tags, `custom_excerpt`, `feature_image` and per-post code injection. Post chrome such as subscribe forms, author boxes, related posts and comments is not part of that HTML, so none of it was carried over.
- **Conversion.** A Python script in the session scratchpad, using BeautifulSoup and markdownify with custom handlers for Ghost `kg-*` cards, did the conversion.
- **Frontmatter:**
  - `title`
  - `date` (the publish date)
  - `excerpt` (the custom excerpt, or the meta description if there is none)
  - `tags` (Ghost tags)
  - `cover` (the feature image, saved as `cover.<ext>`)
  - `shelf`
- **Images.** The original, full-size files were downloaded (with Ghost's `/size/wXXX/` removed from the path) to `public/blog/<slug>/`. They are referenced as `/blog/<slug>/<file>`. Nothing was re-encoded.
- **Links.**
  - `?ref=wingedsheep.com` was stripped from outbound links.
  - Links to other posts (`https://wingedsheep.com/<slug>/`) now point to `/blog/<slug>/`.
  - Links to Ghost pages (such as `/projects/`) are still absolute `https://wingedsheep.com/...` URLs.

## How Ghost cards were converted

| Ghost element | Markdown output |
| --- | --- |
| Image card without caption | `![alt](/blog/...)` |
| Image card with caption | Raw `<figure><img ...><figcaption>...</figcaption></figure>`. Caption links and formatting are kept. |
| Code card / `<pre><code class="language-x">` | Fenced code block with the language hint. Trailing whitespace inside code was trimmed. |
| Embed card (YouTube, SoundCloud) | Raw `<iframe>` with the original attributes |
| Twitter embed | Raw `<blockquote class="twitter-tweet">`. The `widgets.js` script was dropped, so it shows as a plain quote. |
| Bookmark card | Blockquote containing a bold link and the description |
| Audio card | Bold title (if any) plus `<audio controls src="...">` (see the audio section below) |
| Tables | GFM tables |

## Needs a human look

### Audio still points at Ghost (not downloaded)
The audio totals about 170 MB, which is too heavy to commit. The `<audio>` tags still point at `https://wingedsheep.com/content/media/...` and will break when the Ghost site goes down.
- `the-shift`: 1 file, `The-Shift.mp3` (about 56 MB).
- `quantum-aeon`: 28 files. The full story is about 50 MB and each of the 27 chapters is about 2 MB.

Decide whether to self-host these files (for example on R2 or S3, or in `public/` using Git LFS) or drop them.

### Missing video (`tails-of-power-ai-video-experiment`)
The trailer video card is broken on the live Ghost site too. Only the player text `0:00/1×` survived in the post HTML. I replaced it with an HTML comment, `<!-- TODO ... -->`, at the top of the post. The trailer needs to be re-added, either as a YouTube embed or as a video file. The post's code injection also hid the feature image on the post page (`.post-full-image {display:none}`). The cover is still set in the frontmatter, so decide whether to show it.

### Custom HTML and JS that was in Ghost code injection or HTML cards
- **`gpt-4-general-intelligence`.** The chat transcript is kept as raw `<div class="user-text|game-text|gpt-text|remark-text|clarification-text">` blocks. The colours came from the post's code injection, so the site needs this CSS (scoped as you like):
  ```css
  .user-text, .game-text, .gpt-text, .remark-text, .clarification-text { color: black; display: block; padding: 10px; margin-bottom: 10px; }
  .user-text { background: #d7f5db; }            /* green: user */
  .game-text { background: #e3ecfa; }            /* grey-blue: game output */
  .gpt-text { background: #f5ead7; }             /* yellow: GPT-4 */
  .remark-text { background: #e4cffa; }          /* purple: remarks */
  .clarification-text { background: #c5f1e7; }   /* teal: clarifications */
  ```
- **`mana-from-the-machine`.** The "Showcasing a full generated set" section has an interactive card gallery with a lightbox. It is kept verbatim as a raw `<style>` + `<div id="card-gallery">` + `<script>` block. The script loads 275 `.webp` cards at runtime from the GitHub API (`wingedsheep/mtg-card-generator/example-set-2`). Check that Astro passes the inline script through as intended, or replace the block with a proper component. The GitHub API is rate-limited to 60 requests per hour per IP for unauthenticated calls.
- **`imaginary-creatures-2`.** The Ghost footer script turned the 182 images into a shuffled flex gallery with a lightbox. The migrated post is just the images stacked in their original order. It would benefit from a gallery component.
- **`imaginary-creatures`.** The footer script shuffled the order of the creature sections on each page load. The migrated post uses the fixed original order.
- **`building-a-modular-monolith`.**
  - The styled "View on GitHub" and contents box (inline-styled HTML) became a blockquote link plus a bulleted table of contents.
  - The `<div id="part-N">` anchors became `<a id="part-N"></a>`. For `introduction` and `conclusion`, the heading's auto-generated id matches the anchor, so those ids appear twice (harmless).
  - The code injection capped images at 700px wide, and some inline `<img style="max-width:500px">` images became plain markdown images, so they will render at full width.
  - The folder is 16 MB, partly because of a large Gemini-generated PNG.
- **`lunar-lander-dqn`.** The post uses LaTeX, which Ghost rendered with KaTeX via code injection. It is converted to `$...$` inline math. The site needs `remark-math` + `rehype-katex` (plus the KaTeX CSS), or the math shows as raw TeX.
- **`using-dreambooth-with-stable-diffusion`.** The tweet embed is a plain blockquote. Add Twitter's `widgets.js` or leave it as a quote.

### Broken links in the original, fixed during migration
- `music-generation-...`: the Jukebox link had its URL doubled (`https://openai.com/blog/jukebox/https://openai.com/blog/jukebox/`).
- `starting-a-ghost-blog`: the Scaleway link pointed to a Ghost preview URL (`/p/<uuid>/www.scaleway.com`). It now goes to `https://www.scaleway.com`.
- `building-argentum-...`: the excerpt was missing a space ("long.I decided"). This was fixed by hand in the markdown file.

### Image weight
The total size of `public/blog/` is about 258 MB across 424 files. `museum-of-imaginary-art` accounts for 112 MB on its own: 60 PNGs of 1536×1024, about 2 MB each. Ghost's resized variants of these PNGs were no smaller, so the originals were kept as instructed. Converting to WebP/AVIF, or routing the images through `astro:assets`, would cut this sharply.

### Minor
- Some raw HTML blocks (captions, the transcript divs, SoundCloud iframe URLs) contain `&amp;` entities. They are valid HTML and render correctly.
- Alt text is empty on most images because Ghost had none.
