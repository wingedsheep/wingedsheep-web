// @ts-check
import { readdirSync } from 'node:fs';
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

export default defineConfig({
  site: 'https://wingedsheep.com',
  redirects: { ...legacyRedirects, '/rss': '/rss.xml' },
  markdown: {
    remarkPlugins: [[remarkMath, { singleDollarTextMath: false }]],
    rehypePlugins: [rehypeKatex],
    shikiConfig: { theme: 'github-dark-dimmed' },
  },
});
