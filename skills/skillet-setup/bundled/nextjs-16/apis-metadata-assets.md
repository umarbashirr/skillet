# Proxy, Route Handlers, request APIs, metadata & assets

## Proxy (the v16 rename of Middleware)
One `proxy.ts` per project at the root. Runs before routing — header rewrites, redirects, optimistic
auth, CORS. **Not** for heavy data work. Node runtime only (no edge).
```ts
import { NextRequest, NextResponse } from 'next/server'
export function proxy(req: NextRequest) {           // default export also allowed
  if (!req.cookies.get('session')) return NextResponse.redirect(new URL('/login', req.nextUrl))
  return NextResponse.next()
}
export const config = { matcher: ['/((?!api|_next/static|_next/image|.*\\.png$).*)'] }
```
- Matcher: string or array; supports `:param`, `*`/`?`/`+`, regex in `()`, and object form with
  `has`/`missing`/`locale`. Anchored at start.
- Order: config headers → config redirects → **proxy** → beforeFiles rewrites → fs routes → afterFiles
  → dynamic → fallback.
- Forward upstream headers via `NextResponse.next({ request: { headers } })` (not the client form —
  that can clobber framework headers). `NextResponse.rewrite()` auto-propagates RSC headers.
- A matcher excluding a path also skips that path's **Server Actions** (they POST to the route).
- Advanced flags: `skipProxyUrlNormalize`, `skipTrailingSlashRedirect`.

## Route Handlers (`route.ts`)
Web `Request`/`Response`, extended as `NextRequest`/`NextResponse`. Methods: GET/POST/PUT/PATCH/
DELETE/HEAD/OPTIONS (405 otherwise). Can't coexist with `page` at the same segment.
```ts
import { NextRequest } from 'next/server'
export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params
  const q = req.nextUrl.searchParams.get('q')
  return Response.json({ id, q })
}
```
- Not cached by default; GET opts in with `export const dynamic = 'force-static'` (or, under Cache
  Components, prerenders if it uses no request-time API). Read body via
  `await req.json()/.formData()/.text()`. Type ctx with `RouteContext<'/users/[id]'>`.
- `NextRequest`: `req.cookies.*`, `req.nextUrl.{pathname,searchParams,basePath}`. (v15 removed
  `ip`/`geo` — use `@vercel/functions` or headers.) `NextResponse`: `.json()`, `.redirect()`,
  `.rewrite()`, `.next()`, `.cookies.*`.

## Request APIs (`next/headers`, all async)
- `const c = await cookies()` — `c.get/getAll/has`; `c.set/delete` only in actions/handlers, before
  streaming. Set options: `httpOnly`, `secure`, `sameSite`, `path`, `maxAge`, `expires`, `domain`, …
- `const h = await headers()` — read-only (`get/has/entries/keys/values/getSetCookie`); makes the
  route dynamic.
- `const { isEnabled } = await draftMode()` — `enable()`/`disable()` in a Route Handler set/clear the
  bypass cookie. Can't call enable/disable inside a `use cache` scope.

## Metadata & SEO
- Static: `export const metadata: Metadata = {…}`. Dynamic: `export async function
  generateMetadata({ params, searchParams }, parent) {…}` (can't combine the two). Merges root→leaf,
  **shallow** (nested objects like `openGraph`/`robots` are replaced, not deep-merged).
- Set `metadataBase` so relative OG/twitter image URLs resolve. `title` supports
  `{ default, template:'%s | Site', absolute }`.
- Viewport/themeColor → `generateViewport()` / `export const viewport: Viewport`.
- **File metadata:** `opengraph-image`/`twitter-image` (static file, or `.tsx` via `ImageResponse`
  from `next/og` — Satori, flexbox-only CSS, ≤500KB; `params` is a Promise [v16]); `icon`/`apple-icon`;
  `sitemap.(xml|ts)` (`MetadataRoute.Sitemap`; `generateSitemaps` `id` is a Promise [v16]);
  `robots.(txt|ts)` (`MetadataRoute.Robots`); `manifest.(json|ts)`.
- Streaming metadata (v15.2+) appends after initial UI; disabled for HTML-limited bots
  (`htmlLimitedBots` config) and prerendered pages.

## Asset components
- **`next/image`:** `width`+`height` (or `fill` with a positioned parent), `priority` for the LCP
  image, `placeholder="blur"`+`blurDataURL`, `sizes`, `quality`, `loader`. Auto AVIF/WebP + lazy.
  Remember v16 default changes: `qualities` default `[75]`, `minimumCacheTTL` 4h, use
  `images.remotePatterns` (not `domains`), local-IP blocked unless `dangerouslyAllowLocalIP`.
- **`next/font`** (`next/font/google`, `next/font/local`): self-hosted at build, zero layout shift via
  auto-adjusted fallback metrics. Use `variable` for CSS-var usage; non-variable fonts need `weight`;
  set `subsets`. Apply `className`/`variable` on `<html>`/`<body>`.
- **`next/link`:** `prefetch` auto (full for static, to nearest `loading` for dynamic),
  `replace`/`scroll`/`onNavigate`/`transitionTypes` (v16.2, with `viewTransition`). `useLinkStatus()`
  for a pending indicator.
- **`next/script`:** `strategy` = `beforeInteractive` (head, critical only) / `afterInteractive`
  (default) / `lazyOnload`. `onLoad`/`onReady`/`onError` require a Client Component.
