# Playbook: upgrade Next.js 15 → 16

Full breaking-change list: `nextjs-16` → v16-changes.md. Official: `/docs/app/guides/upgrading/version-16`.

## 1. Pre-flight
- Commit/branch first. Confirm **Node ≥ 20.9**, plan for **React ≥ 19.2**, **TypeScript ≥ 5.1**.
- Note your current setup: webpack customizations? `middleware.ts`? `next lint` in scripts? AMP?
  `serverRuntimeConfig`? These all change.

## 2. Run the upgrade codemod
```bash
npx next upgrade                       # or: npx @next/codemod@latest upgrade latest
```
It bumps deps and applies the bundle (turbopack config, middleware→proxy, lint→eslint, unstable
prefixes, experimental_ppr removal). Then run targeted ones as needed:
`next-async-request-api` · `middleware-to-proxy` · `next-experimental-turbo-to-turbopack` ·
`next-lint-to-eslint-cli` · `remove-unstable-prefix` · `remove-experimental-ppr`.

## 3. Fix what codemods can't
- **Async APIs:** ensure every `cookies()/headers()/draftMode()/params/searchParams` is `await`ed
  (or `use()`); image-handler `params`/`id` and `generateSitemaps` `id` are Promises now.
- **Proxy:** `middleware.ts`→`proxy.ts`, export renamed, **drop edge runtime** (Node only); rename
  `skipMiddlewareUrlNormalize`→`skipProxyUrlNormalize` etc.
- **Turbopack default:** remove/port any `webpack()` config to `turbopack` (or run with `--webpack`).
- **revalidateTag:** add the 2nd arg — `revalidateTag('tag','max')`.
- **Parallel routes:** add an explicit `default.tsx` to every slot (return `notFound()`/`null`).
- **next/image:** review the changed defaults (TTL 4h, `qualities:[75]`, `imageSizes` minus 16,
  `localPatterns.search`, local-IP block, `maximumRedirects:3`); replace `images.domains` with
  `remotePatterns`; replace `next/legacy/image`.
- **Removed:** drop AMP (`next/amp`, `amp` config); replace `serverRuntimeConfig`/
  `publicRuntimeConfig` with env vars (+ `connection()` for runtime reads); remove the `eslint` option
  from `next.config`; remove dropped `devIndicators` options and `unstable_rootParams`.
- **Linting:** `next lint` is gone and `next build` no longer lints — add `eslint` (flat config) to
  CI/scripts.
- **Scroll:** if you relied on smooth-scroll override, add `<html data-scroll-behavior="smooth">`.
- **Caching (optional):** to adopt Cache Components, follow `cache-components-setup.md` (don't mix the
  old segment config with `cacheComponents:true`).

## 4. Verify
```bash
next build            # must pass (Turbopack); try --webpack only if blocked
next typegen && tsc --noEmit
eslint .              # separate from build now
```
Smoke-test routes that used cookies/headers/middleware/params, dynamic images, and any mutation paths.
Grep for leftovers: `middleware`, `serverRuntimeConfig`, `next/amp`, single-arg `revalidateTag(`,
`images: { domains`.
