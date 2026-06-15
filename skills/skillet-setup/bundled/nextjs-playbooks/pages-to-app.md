# Playbook: migrate Pages Router → App Router

Incremental — `app/` and `pages/` coexist; move route by route. Background: `nextjs-16` →
routing-and-data.md and apis-metadata-assets.md. Official guide:
`/docs/app/guides/migrating/app-router-migration`.

## 1. Create the App Router root
- Add `app/layout.tsx` with `<html>`/`<body>` (replaces `_app`/`_document`). Move global CSS imports
  and providers here (providers must be `'use client'`).
- Keep `pages/` working meanwhile — a route resolves from `app/` if present, else `pages/`.

## 2. Move pages one at a time
- `pages/about.tsx` → `app/about/page.tsx`. `pages/blog/[slug].tsx` → `app/blog/[slug]/page.tsx`.
- Default-export a (usually `async`) Server Component.

## 3. Replace data fetching
| Pages | App |
|-------|-----|
| `getStaticProps` | fetch directly in an async Server Component (+ `use cache`/`cacheLife` to cache) |
| `getStaticPaths` | `generateStaticParams()` |
| `getServerSideProps` | fetch in the Server Component; request-time data via `await cookies()/headers()` + `<Suspense>` |
| client `useEffect` fetch | keep in a Client Component, or stream a promise + React `use()` |

`params`/`searchParams` are **async props** now — `await` them.

## 4. Replace framework APIs
- `next/head` / `<Head>` → `export const metadata` or `generateMetadata` (see apis-metadata-assets.md).
- `next/router` (`useRouter`) → `next/navigation` (`useRouter`/`usePathname`/`useSearchParams`).
- `pages/api/*` → `app/<route>/route.ts` (Web `Request`/`Response`, async `ctx.params`).
- `middleware.ts` → `proxy.ts` (rename export too; codemod `middleware-to-proxy`).
- Add `'use client'` to any moved component using state/effects/handlers/browser APIs.

## 5. Mark client boundaries & errors
- Wrap interactive subtrees with `'use client'`; pass Server Components as `children` into them.
- Add `loading.tsx`/`error.tsx`/`not-found.tsx` per segment instead of `_error`/custom 404.

## 6. Verify per route, then retire `pages/`
After each move: `next build` passes and the route behaves the same. When `pages/` is empty, delete
it. ESLint/types run outside `next build` in v16 — keep them in CI.
