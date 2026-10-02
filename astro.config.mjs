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
    // the island's code is imported only once the page has loaded, so Vite would find three.js
    // late, re-bundle it mid-visit and fail that import ("Outdated Optimize Dep"): bundle it up front
    optimizeDeps: { include: ['three', 'three/examples/jsm/loaders/GLTFLoader.js'] },
    define: { __MODELS__: JSON.stringify(models.digest('hex').slice(0, 12)) },
    ...(phone && { server: { https: { key: readFileSync('.cert/key.pem'), cert: readFileSync('.cert/cert.pem') } } }),
  },
  // the styles go in the page itself: one request fewer before anything can be drawn
  build: { inlineStylesheets: 'always' },
  redirects: { ...legacyRedirects, '/rss': '/rss.xml' },
  markdown: {
    remarkPlugins: [[remarkMath, { singleDollarTextMath: false }]],
    rehypePlugins: [rehypeKatex, rehypePages],
    shikiConfig: { theme: 'github-dark-dimmed' },
  },
});
