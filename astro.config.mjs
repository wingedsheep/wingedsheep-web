// @ts-check
import { createHash } from 'node:crypto';
import { readdirSync, readFileSync } from 'node:fs';
import { defineConfig } from 'astro/config';
import rehypeKatex from 'rehype-katex';
import remarkMath from 'remark-math';
import rehypePages from './src/lib/rehype-pages.mjs';

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

// `just phone`: served over https on the network, since a phone only hands over its motion
// sensors (tilting to lean on the river) to a secure page. The certificate's self-signed.
const phone = process.env.PHONE === '1';

export default defineConfig({
  site: 'https://wingedsheep.com',
  server: phone ? { host: true } : {},
  vite: {
    define: { __MODELS__: JSON.stringify(models.digest('hex').slice(0, 12)) },
    ...(phone && { server: { https: { key: readFileSync('.cert/key.pem'), cert: readFileSync('.cert/cert.pem') } } }),
  },
  redirects: { ...legacyRedirects, '/rss': '/rss.xml' },
  markdown: {
    remarkPlugins: [[remarkMath, { singleDollarTextMath: false }]],
    rehypePlugins: [rehypeKatex, rehypePages],
    shikiConfig: { theme: 'github-dark-dimmed' },
  },
});
