# Playbook: set up / migrate to Cache Components

Goal: enable the v16 `use cache` model and convert route-segment caching to it. Background:
`nextjs-16` → cache-and-rendering.md.

## 1. Enable the flag
```ts
// next.config.ts
import type { NextConfig } from 'next'
const nextConfig: NextConfig = { cacheComponents: true }
export default nextConfig
```
This also turns on PPR by default and **removes** route-segment `dynamic`/`revalidate`/`fetchCache`.

## 2. Remove the old knobs (they now error)
- Delete `export const dynamic`, `revalidate`, `fetchCache` from pages/layouts/handlers.
- Map them: `force-dynamic`→remove · `force-static`→`use cache` + `cacheLife('max')` ·
  `revalidate=N`→`cacheLife({ revalidate:N })` · `fetchCache='force-cache'`→`use cache`.
- Remove `experimental.{ppr,useCache,dynamicIO}`. Codemod: `remove-experimental-ppr`.

## 3. Mark what should be cached
Add `'use cache'` at the function/component/file level, close to the data:
```tsx
import { cacheLife, cacheTag } from 'next/cache'
async function getProducts() {
  'use cache'
  cacheLife('hours')
  cacheTag('products')
  return db.query('SELECT * FROM products')
}
```
Rules: can't read `cookies()`/`headers()`/`searchParams` inside — pass them as args (or
`'use cache: private'`). Closure captures become part of the cache key.

## 4. Wrap the dynamic holes
Anything request-time (cookies/headers/searchParams/uncached params, or post-`connection()` work) must
sit inside `<Suspense>`, or the build errors:
```tsx
<Suspense fallback={<Skeleton/>}><UserGreeting/></Suspense>   // reads cookies()
```
Use `await connection()` before `Math.random()`/`new Date()`/sync DB.

## 5. Choose cache variants & lifetimes
- Cross-instance/serverless persistence → `'use cache: remote'` (key on shared dimensions).
- Per-user, browser-only → `'use cache: private'`.
- Pick a `cacheLife` profile (`seconds`→`max`) or custom `{ stale, revalidate, expire }` in config.

## 6. Wire invalidation to mutations
In Server Actions: `updateTag('products')` (read-your-own-writes) or `revalidateTag('products',
'max')` (SWR); `revalidatePath('/p','page'|'layout')` for path-based; `refresh()` to clear the client
router. In Route Handlers / webhooks: `revalidateTag(tag, 'max')` or `{ expire: 0 }` for immediate.

## 7. Multi-instance (if self-hosting >1 node)
Configure a shared `cacheHandler`/`cacheHandlers` (Redis/KV) implementing
`get/set/revalidateTag` + `updateTags`/`refreshTags`, set `cacheMaxMemorySize: 0`, and a stable
`generateBuildId`.

## 8. Verify
`next build` passes with no "dynamic data not inside Suspense" errors; mutated data updates after the
action; nothing still references removed segment config.
