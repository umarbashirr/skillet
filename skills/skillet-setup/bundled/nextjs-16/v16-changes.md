# Next.js 16 — breaking changes & what's new (vs 15)

Source of truth: `/docs/app/guides/upgrading/version-16`. Upgrade with `npx next upgrade` (or
`npx @next/codemod@latest upgrade latest`).

## Runtime & dependencies
- **Node ≥ 20.9** (Node 18 dropped) · **React ≥ 19.2** · **TypeScript ≥ 5.1**.
- Browsers: Chrome/Edge/Firefox 111+, Safari 16.4+.

## Bundler / compiler
- **Turbopack is the DEFAULT** for `next dev` and `next build` — no `--turbopack` flag. Opt out with
  `--webpack`. A custom `webpack()` config now **fails the build** unless you run with `--webpack`.
- Turbopack config moved `experimental.turbopack` → top-level `turbopack`. Codemod:
  `next-experimental-turbo-to-turbopack`.
- SWC is default; Babel only if a Babel config exists.

## Async request APIs — sync access fully removed
`cookies()`, `headers()`, `draftMode()`, plus `params` (layout/page/route/default + image handlers)
and `searchParams` (page) are **async**. `await` them (or `use()` in Client Components).
Also: image-handler `params`/`id` and `generateSitemaps` `id` are now Promises.
Codemod: `next-async-request-api`. Generate prop types with `next typegen`.
```tsx
// before → after
const c = cookies()            // → const c = await cookies()
function Page({ params }) {}    // → async function Page({ params }) { const p = await params }
```

## Middleware → Proxy
- `middleware.ts/js` → **`proxy.ts/js`**; `export function middleware` → `export function proxy`
  (default export also allowed). **Edge runtime not supported** (Node only).
- Config renames: `skipMiddlewareUrlNormalize`→`skipProxyUrlNormalize` ·
  `experimental.middlewarePrefetch`→`experimental.proxyPrefetch` ·
  `…middlewareClientMaxBodySize`→`…proxyClientMaxBodySize` ·
  `…externalMiddlewareRewritesResolve`→`…externalProxyRewritesResolve`.
- Codemod: `middleware-to-proxy`.

## Caching / revalidation
- **`revalidateTag(tag, profile)` now requires 2 args** — second is a cacheLife profile (usually
  `'max'` for stale-while-revalidate). Single-arg form is deprecated / TS-errors. For immediate
  webhook expiry: `revalidateTag(tag, { expire: 0 })`.
- **`updateTag(tag)` NEW** — Server Actions only, immediate expiry, read-your-own-writes.
- **`refresh()` NEW** — Server Actions only, clears the entire client router cache.
- `cacheLife` & `cacheTag` **stabilized** (drop `unstable_`). Codemod: `remove-unstable-prefix`.
- `experimental.dynamicIO` and `experimental.useCache` → folded into **`cacheComponents: true`**.
- `experimental_ppr` route-segment config **removed**; PPR is part of Cache Components now.

## next/image breaking defaults
- `minimumCacheTTL` 60s → **4h (14400)**.
- `qualities` default now **`[75]`** only (set `images.qualities` for more).
- `imageSizes` dropped the value `16`.
- Local images with **query strings** require `images.localPatterns[].search`.
- **Local-IP optimization blocked** unless `images.dangerouslyAllowLocalIP: true`.
- `maximumRedirects` default now **3**.
- `next/legacy/image` **deprecated**; `images.domains` **deprecated** → use `images.remotePatterns`.

## Removed / migrated
- **`next lint` command removed** — use ESLint or Biome CLI. `@next/eslint-plugin-next` defaults to
  **flat config**. `eslint` option in `next.config` removed. Codemod: `next-lint-to-eslint-cli`.
  Note: `next build` no longer runs the linter — wire ESLint into CI / npm scripts.
- **AMP removed** (`next/amp`, `useAmp`, `amp` config / page config).
- **`serverRuntimeConfig` / `publicRuntimeConfig` removed** → use env vars; for runtime reads call
  `connection()` before `process.env`.
- Some `devIndicators` options removed (`appIsrStatus`, `buildActivity`, `buildActivityPosition`).
- `unstable_rootParams` removed (replacement coming).
- Build output dropped the `size` / `First Load JS` columns (inaccurate under RSC — use Lighthouse).

## Behavior changes
- **Parallel-route slots now require an explicit `default.js`** or the build fails. Return
  `notFound()` or `null` to keep prior behavior.
- No longer overrides `scroll-behavior: smooth` — restore via `<html data-scroll-behavior="smooth">`.
- `next dev` writes to `.next/dev` (can run concurrently with `next build`). Config is no longer
  loaded twice in dev → `process.argv.includes('dev')` in config is now `false`; use
  `NODE_ENV`/phase instead.

## New / stabilized
- **Cache Components** (`cacheComponents: true`): `use cache`, `use cache: private`,
  `use cache: remote`, `cacheLife`, `cacheTag`, `updateTag`, `refresh`, PPR by default.
- **`connection()`** and **`after()`** stabilized.
- **`error.js` `unstable_retry()`** (v16.2) and component-level `unstable_catchError` from `next/error`.
- **React Compiler 1.0** stable but opt-in: `reactCompiler: true` (+ `babel-plugin-react-compiler`).
- View Transitions: `viewTransition: true` config + `<Link transitionTypes>` (v16.2).
- `next upgrade`, `next typegen`, `next experimental-analyze` CLI commands.

## Codemods quick list
`upgrade latest` (runs the bundle) · `next-async-request-api` · `middleware-to-proxy` ·
`next-experimental-turbo-to-turbopack` · `next-lint-to-eslint-cli` · `remove-unstable-prefix` ·
`remove-experimental-ppr` · (v15) `next-request-geo-ip`.
