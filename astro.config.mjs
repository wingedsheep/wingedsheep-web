// @ts-check
import { createHash } from 'node:crypto';
import { readdirSync, readFileSync } from 'node:fs';
import { defineConfig } from 'astro/config';
import rehypeKatex from 'rehype-katex';
import remarkMath from 'remark-math';

// Ghost served posts at /<slug>/; keep those links alive by redirecting to /blog/<slug>/.
const legacyRedirects = Object.fromEntries(
  readdirSync('./src/content/blog')
    .filter((f) => f.endsWith('.md'))
    .map((f) => f.replace(/\.md$/, ''))
    .map((slug) => [`/${slug}`, `/blog/${slug}/`]),
);

// A hash of the models, put on their URLs: a browser that still holds an old island.glb
// (from before they revalidated) fetches the new one, and unchanged models stay cached.
const models = createHash('sha256');
for (const f of readdirSync('./public/models').sort()) models.update(f).update(readFileSync(`./public/models/${f}`));

export default defineConfig({
  site: 'https://wingedsheep.com',
  vite: { define: { __MODELS__: JSON.stringify(models.digest('hex').slice(0, 12)) } },
  redirects: { ...legacyRedirects, '/rss': '/rss.xml' },
  markdown: {
    remarkPlugins: [[remarkMath, { singleDollarTextMath: false }]],
    rehypePlugins: [rehypeKatex],
    shikiConfig: { theme: 'github-dark-dimmed' },
  },
});
