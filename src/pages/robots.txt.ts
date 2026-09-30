import { siteConfig } from '../site.config';
export function GET() {
  return new Response(
    `User-agent: *\nAllow: /\nDisallow: /admin/\nDisallow: /search/\nSitemap: ${new URL('/sitemap-index.xml', siteConfig.siteURL).href}\n`,
    { headers: { 'Content-Type': 'text/plain; charset=utf-8' } },
  );
}
