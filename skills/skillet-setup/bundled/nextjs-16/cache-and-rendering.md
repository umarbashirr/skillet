# Caching, rendering & Cache Components

## Server vs Client Components
- **Server Components (default):** render on the server, may be `async`, fetch directly (DB/secrets
  safe), ship zero JS. Use for everything non-interactive.
- **`'use client'`:** marks a boundary — that module *and everything it imports* become client code.
  Needed for `useState`/`useEffect`/event handlers/browser APIs. Props crossing the boundary must be
  **serializable**. Prefer passing Server Components as `children` into Client Components over
  importing them. Context providers must be Client Components.
- Enforce with `server-only` / `client-only` packages. Only `NEXT_PUBLIC_*` env vars reach the browser.

## Rendering & streaming
- **Static** (prerendered) vs **dynamic** (request-time). Request-time APIs (`cookies`, `headers`,
  `searchParams`, uncached `params`, `connection()`) make a boundary dynamic.
- **Streaming:** `loading.js` wraps the segment in Suspense automatically; or wrap slow async
  components in `<Suspense>` manually. Stream a promise to a Client Component:
  ```tsx
  // server
  export default function Page() {
    const posts = getPosts()                 // don't await
    return <Suspense fallback={<Skel/>}><Posts posts={posts} /></Suspense>
  }
  // client
  'use client'; import { use } from 'react'
  function Posts({ posts }) { const all = use(posts); /* … */ }
  ```
- **PPR (Partial Prerendering):** default under Cache Components. Static shell prerendered at build,
  dynamic holes (Suspense boundaries / request-time data) stream in at request time. The RSC payload
  drives client navigation.

## Data fetching defaults (legacy, no Cache Components)
- `fetch` is **not cached** by default; requests are memoized per render. Opt in:
  `fetch(url, { cache: 'force-cache', next: { revalidate: 3600, tags: ['posts'] } })`.
- Route-segment `export const revalidate`, `dynamic`, `fetchCache`, `dynamicParams` apply.
- See `/docs/app/guides/caching-without-cache-components`.

---

## Cache Components (the v16 model)

Enable in `next.config.ts`: `cacheComponents: true`. This turns on the `use cache` family + PPR by
default and **removes** route-segment `dynamic`/`revalidate`/`fetchCache` (keeps `dynamicParams`,
`runtime`, `preferredRegion`, `maxDuration`).

### `'use cache'` — opt-in caching (file / component / function scope)
```tsx
import { cacheLife, cacheTag } from 'next/cache'
async function getProducts() {
  'use cache'
  cacheLife('hours')
  cacheTag('products')
  return db.query('SELECT * FROM products')
}
```
- **Cache key** = build ID + function ID + **serialized arguments** + (dev) HMR hash. **Closure
  captures become part of the key.**
- You **cannot** read `cookies()`/`headers()`/`searchParams` inside `use cache` — pass them in as
  arguments (or use `use cache: private`). Reading runtime Promises without passing them in can hit a
  ~50s build timeout.
- Argument serialization is strict (Server-Component rules); return-value serialization is permissive
  (Client rules). Non-serializable `children`/Server Actions may be passed **through** untouched.
- Serverless: entries aren't persistent across requests (use `use cache: remote`). Self-hosted:
  persist, bounded by `cacheMaxMemorySize`. Client copy held for `stale` (≥30s).

### Variants
- **`'use cache: private'`** — may read `cookies()`/`headers()`/`searchParams`; cached **only in the
  browser** (never server), re-executes each server render, 30s min stale, no custom handlers.
- **`'use cache: remote'`** — persisted to an external handler (Redis/KV) for cross-instance /
  serverless sharing. Key on **shared** dimensions (avoid per-user/high-cardinality keys; filter in
  memory after the hit). Nesting: remote-in-remote ✓, remote-in-regular ✓; remote↔private ✗.

### `cacheLife(profile | { stale, revalidate, expire })`
- `stale` = client window with no recheck · `revalidate` = server background SWR refresh ·
  `expire` = hard max with no traffic. Require `expire ≥ revalidate`.

| profile | stale | revalidate | expire |
|---------|-------|-----------|--------|
| `default` | 5m | 15m | never |
| `seconds` | 30s¹ | 1s | 1m |
| `minutes` | 5m | 1m | 1h |
| `hours` | 5m | 1h | 1d |
| `days` | 5m | 1d | 1w |
| `weeks` | 5m | 1w | 30d |
| `max` | 5m | 30d | 1y |

¹ client `stale` is clamped to a **30s minimum** (prefetch stability). Custom profiles go under
`next.config` `cacheLife: { biweekly: { stale, revalidate, expire } }`. Short-lived caches
(`seconds`, or expire < ~5m) are **excluded from the prerender** → become dynamic holes. A nested
short-lived cache inside an outer `use cache` that lacks an explicit `cacheLife` is a **build error**.

### Tags & invalidation
- `cacheTag('a','b')` tags an entry (≤128 tags/call, ≤256 chars each; idempotent).
- `updateTag('a')` — **Server Actions only** — immediate expiry; next read waits for fresh
  (read-your-own-writes).
- `revalidateTag('a', 'max')` — **Actions & Route Handlers** — SWR (serve stale, refresh in
  background). 2-arg form required in v16.
- `revalidatePath('/p', 'page'|'layout')` — path-based (uses internal soft tags `_N_T_…`); `type`
  required for dynamic segments.
- `refresh()` — **Server Actions only** — clears the whole client router cache.
- Any revalidate/update/refresh immediately clears the **client** cache. Both HTML and RSC payload
  are revalidated together.
- Multi-instance: a custom cache handler coordinates via `updateTags()`/`refreshTags()` against
  shared storage (else only the local instance is invalidated).

### Request-time gating
Call `await connection()` before non-deterministic work (`Math.random()`, `new Date()`, sync DB) so
it runs at request time, not build. Wrap request-time data in `<Suspense>` or the build errors under
Cache Components.
```tsx
import { connection } from 'next/server'
async function Unique() { await connection(); return <p>{crypto.randomUUID()}</p> }
```

### Migrating off route-segment config
`force-dynamic`→remove · `force-static`→`use cache` + `cacheLife('max')` ·
`revalidate=N`→`cacheLife({ revalidate:N })` · `fetchCache='force-cache'`→`use cache` ·
`runtime='edge'`→not supported (Node + Proxy instead).
