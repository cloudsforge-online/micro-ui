import { type CloudsForgeSurface } from './surfaces.ts';
/**
 * Every surface that belongs in the estate sitemap, in registry order.
 *
 * Derived from three registry fields and nothing else, so a new surface is included or excluded by
 * virtue of what it IS rather than by somebody remembering this file.
 */
export declare const SITEMAP_SURFACES: readonly CloudsForgeSurface[];
export interface SitemapUrl {
    /** The absolute address. */
    readonly loc: string;
    /**
     * A hint, not a promise. Omitted rather than guessed for anything this module cannot know.
     *
     * `changefreq` and `priority` are deliberately absent from the whole module: Google has said
     * publicly that it ignores both, and a field that is ignored is a field that can only be wrong.
     */
    readonly lastmod?: string;
}
/**
 * Every URL in the estate sitemap, given the origin the APEX surface is served from.
 *
 * `apexOrigin` is the front door — `https://cloudsforge.online`, or whatever `$host` said. Each
 * surface's address is its `subdomain` prefixed onto that host, plus its `basePath` when it is a
 * route on another surface's host rather than a host of its own. The apex surface itself has an
 * empty subdomain and composes to the origin unchanged.
 *
 * `extraPaths` are routes ON THE APEX SURFACE — the marketing site's own pages. They are passed in
 * rather than derived because this package cannot import from a consumer, and `site`'s route table
 * is the consumer's own declaration.
 */
export declare function sitemapUrls(apexOrigin: string, extraPaths?: readonly string[]): readonly SitemapUrl[];
/**
 * The sitemap, as XML.
 *
 * One `<urlset>` in the 0.9 schema, which is the only schema any crawler implements. No
 * `<changefreq>`, no `<priority>` — see {@link SitemapUrl}.
 */
export declare function sitemapXml(apexOrigin: string, extraPaths?: readonly string[]): string;
/**
 * `robots.txt` for a surface, given the origin IT is served from.
 *
 * ── The `Disallow` is derived, and it is the half that was missing ────────────────────────────
 *
 * A surface whose {@link import('./seo.ts').robotsDirective} says `noindex` gets `Disallow: /`
 * here as well. Both are needed and neither is sufficient: `robots.txt` stops the fetch, the meta
 * tag stops the indexing, and a page that is only disallowed can still be indexed from an inbound
 * link with a search result reading "no information is available for this page" — which for an
 * operator console is a search result that confirms the console exists.
 *
 * `sitemapUrl` is emitted only when one is given, and only on the surface that serves it. The
 * `Sitemap:` line must be absolute; that is why it is a parameter and not a constant.
 */
export declare function robotsTxt(options: {
    readonly indexable: boolean;
    readonly sitemapUrl?: string | undefined;
}): string;
