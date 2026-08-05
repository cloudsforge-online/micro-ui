/**
 * The estate sitemap and robots.txt, generated from the surface registry.
 *
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 * THE SIX ADDRESSES THAT MUST NOT BE IN IT
 *
 * `nimbus`, `account`, `api`, `pay`, `keyvault`, `studio`, `rpc` and `p2p` are `servesUi: false`:
 * a person opening them in a browser is answered with JSON, a 404, a 405 or a 426, by design.
 * `surfaces.ts` says so beside each row and records that each value was MEASURED through the
 * gateway rather than reasoned about. A sitemap listing them is a sitemap of broken links, which
 * is worse than no sitemap: a crawler that is handed dead URLs by the site's own index discounts
 * the ones that work.
 *
 * The three operator surfaces are excluded for a different reason and by a different field —
 * `adminOnly` — and the reasoning is in `seo.ts` beside `robotsDirective`. Excluding them here and
 * emitting `noindex` there are the same decision made twice, deliberately: a sitemap is an
 * invitation and a robots directive is an instruction, and the two must not disagree.
 *
 * `signin` is excluded on the rule `FOOTER_SURFACES` already states: signing in is a state
 * transition the account menu owns, not a destination.
 *
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 * WHY EVERY FUNCTION TAKES AN ORIGIN
 *
 * A sitemap must carry ABSOLUTE URLs — the spec requires it, and a crawler discards a relative
 * `<loc>`. Nothing built in this estate is allowed to name a hostname, because one artefact is
 * served from localhost, from a preview deployment and from the apex, and a sitemap baked with the
 * wrong host is worse than none. `site/public/robots.txt` records exactly that reasoning as its
 * excuse for having no `Sitemap:` line at all, and concludes the sitemap "belongs to whatever
 * terminates TLS for the apex, which is the one component that knows what the apex is".
 *
 * That conclusion is right and it is why these are FUNCTIONS OF AN ORIGIN rather than files. The
 * apex is supplied by the one party that knows it — for `site`, that is nginx, which has `$host`
 * on every request and can therefore emit a correct sitemap for whichever hostname was asked for,
 * with nothing baked in. See `site/nginx.conf`, and `site/test/sitemap.test.ts`, which regenerates
 * the block from this module and fails if the two have drifted.
 */
import { normalisePath } from "./seo.js";
import { SURFACES } from "./surfaces.js";
/**
 * Every surface that belongs in the estate sitemap, in registry order.
 *
 * Derived from three registry fields and nothing else, so a new surface is included or excluded by
 * virtue of what it IS rather than by somebody remembering this file.
 */
export const SITEMAP_SURFACES = SURFACES.filter((s) => s.servesUi && s.adminOnly !== true && s.key !== 'signin');
/**
 * Split an origin into its scheme and apex.
 *
 * `https://cloudsforge.online` -> `https://` + `cloudsforge.online`. The port is kept, because a
 * local stack is `http://localhost:3000` and a sitemap that dropped it would name a closed port.
 */
function partsOf(origin) {
    const at = origin.indexOf('://');
    if (at === -1)
        return { scheme: 'https://', host: origin.replace(/\/+$/, '') };
    return { scheme: origin.slice(0, at + 3), host: origin.slice(at + 3).replace(/\/+$/, '') };
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
export function sitemapUrls(apexOrigin, extraPaths = []) {
    const { scheme, host } = partsOf(apexOrigin);
    const originOf = (s) => `${scheme}${s.subdomain === '' ? '' : `${s.subdomain}.`}${host}`;
    const out = [];
    const seen = new Set();
    const push = (loc) => {
        if (seen.has(loc))
            return;
        seen.add(loc);
        out.push({ loc });
    };
    for (const s of SITEMAP_SURFACES) {
        // A `basePath` surface shares a host with the surface it rides on — `wallet` is `hub./wallet`.
        // Both belong in the sitemap and both are distinct addresses, so the dedupe above is on the
        // composed URL rather than on the host.
        push(`${originOf(s)}${s.basePath ?? ''}`);
    }
    for (const path of extraPaths) {
        /*
         * NORMALISED, and this is not defensive programming — it is a bug that was found by using it.
         *
         * `site`'s route table declares its paths WITHOUT a leading slash (`''`, `'products'`,
         * `'about'`), because that is the shape react-router wants for a child route. Appended raw,
         * those composed `https://cloudsforge.onlineproducts` — a hostname that does not exist, in a
         * sitemap, which is the single worst place to put one. Normalising here also collapses the
         * root's two spellings so `''` and `'/'` cannot produce two entries for the front door.
         */
        const canonical = normalisePath(path);
        push(`${scheme}${host}${canonical === '/' ? '' : canonical}`);
    }
    return out;
}
/** Escape the five characters the sitemap spec requires escaping in a `<loc>`. */
function xmlEscape(value) {
    return value
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&apos;');
}
/**
 * The sitemap, as XML.
 *
 * One `<urlset>` in the 0.9 schema, which is the only schema any crawler implements. No
 * `<changefreq>`, no `<priority>` — see {@link SitemapUrl}.
 */
export function sitemapXml(apexOrigin, extraPaths = []) {
    const urls = sitemapUrls(apexOrigin, extraPaths)
        .map((u) => `  <url><loc>${xmlEscape(u.loc)}</loc></url>`)
        .join('\n');
    return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls}
</urlset>
`;
}
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
export function robotsTxt(options) {
    const lines = ['User-agent: *'];
    lines.push(options.indexable ? 'Allow: /' : 'Disallow: /');
    if (options.sitemapUrl !== undefined && options.sitemapUrl !== '') {
        lines.push('', `Sitemap: ${options.sitemapUrl}`);
    }
    return `${lines.join('\n')}\n`;
}
//# sourceMappingURL=sitemap.js.map