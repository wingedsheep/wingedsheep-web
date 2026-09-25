import type { APIContext } from 'astro';
import { getCollection } from 'astro:content';

// every page worth indexing; the 404 and the legacy Ghost redirects stay out
export async function GET(context: APIContext) {
  const posts = (await getCollection('blog')).sort((a, b) => b.data.date.valueOf() - a.data.date.valueOf());
  const latest = posts[0]?.data.date;
  const pages: { path: string; lastmod?: Date }[] = [
    { path: '/', lastmod: latest },
    { path: '/blog/', lastmod: latest },
    { path: '/plain/', lastmod: latest },
    ...posts.map((p) => ({ path: `/blog/${p.id}/`, lastmod: p.data.date })),
  ];
  const urls = pages.map(({ path, lastmod }) =>
    `  <url><loc>${new URL(path, context.site)}</loc>${lastmod ? `<lastmod>${lastmod.toISOString().slice(0, 10)}</lastmod>` : ''}</url>`);
  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.join('\n')}\n</urlset>\n`;
  return new Response(xml, { headers: { 'Content-Type': 'application/xml' } });
}
