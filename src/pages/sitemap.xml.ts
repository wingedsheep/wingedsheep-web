import type { APIContext } from 'astro';
import { getCollection } from 'astro:content';
import { COMMISSION_PATHS } from '../data/commissions';

// every page worth indexing; the 404 and the legacy Ghost redirects stay out
export async function GET(context: APIContext) {
  const posts = (await getCollection('blog')).sort((a, b) => b.data.date.valueOf() - a.data.date.valueOf());
  const latest = posts[0]?.data.date;
  // pages in more than one language list every version of themselves, so search engines pair them
  const commissions = Object.entries(COMMISSION_PATHS);
  const pages: { path: string; lastmod?: Date; alternates?: [string, string][] }[] = [
    { path: '/', lastmod: latest },
    { path: '/blog/', lastmod: latest },
    { path: '/plain/', lastmod: latest },
    ...commissions.map(([, path]) => ({ path, alternates: commissions })),
    ...posts.map((p) => ({ path: `/blog/${p.id}/`, lastmod: p.data.date })),
  ];
  const urls = pages.map(({ path, lastmod, alternates = [] }) =>
    `  <url><loc>${new URL(path, context.site)}</loc>${lastmod ? `<lastmod>${lastmod.toISOString().slice(0, 10)}</lastmod>` : ''}${
      alternates.map(([lang, alt]) => `<xhtml:link rel="alternate" hreflang="${lang}" href="${new URL(alt, context.site)}"/>`).join('')}</url>`);
  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">\n${urls.join('\n')}\n</urlset>\n`;
  return new Response(xml, { headers: { 'Content-Type': 'application/xml' } });
}
