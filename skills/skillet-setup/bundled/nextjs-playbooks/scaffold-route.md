# Playbook: scaffold a route tree

Goal: create a correct App Router route with the right conventions for the requested behavior.

## 1. Place the segment
- URL `/dashboard/settings` → `app/dashboard/settings/page.tsx`.
- Group without a URL segment: `app/(marketing)/about/page.tsx` → `/about`.
- Colocate non-route files in `_lib`/`_components` (underscore = private, non-routable).

## 2. Pick the files for the behavior

| Need | Add |
|------|-----|
| The page itself | `page.tsx` |
| Shared shell that survives navigation | `layout.tsx` (root layout needs `<html>`/`<body>`) |
| Loading skeleton during nav | `loading.tsx` |
| Catch render errors | `error.tsx` (`'use client'`) — root: `global-error.tsx` |
| 404 for missing data | `not-found.tsx` + call `notFound()` |
| Reset state every nav | `template.tsx` instead of/under layout |
| Dynamic param | folder `[id]` |
| Catch-all / optional | `[...slug]` / `[[...slug]]` |
| Side-by-side sub-views | parallel `@slot` folders + `default.tsx` per slot (**required**) |
| Modal over current page | intercepting `(.)route` inside a `@modal` slot |
| API endpoint | `route.ts` (no `page.tsx` in the same folder) |

## 3. Write the page (async params/searchParams)
```tsx
import type { PageProps } from 'next'

export default async function Page(props: PageProps<'/dashboard/[id]'>) {
  const { id } = await props.params
  const { tab } = await props.searchParams
  return <h1>{id} — {tab ?? 'overview'}</h1>
}
```
Prefer typed `PageProps`/`LayoutProps` (run `next typegen`). In Client Components read the promises
with React `use()` or `useParams()`/`useSearchParams()` (wrap the latter in `<Suspense>`).

## 4. Prebuild dynamic routes (optional)
```tsx
export async function generateStaticParams() {
  const posts = await getPosts()
  return posts.map((p) => ({ id: p.id }))     // ≥1 entry required under Cache Components
}
```
Set `export const dynamicParams = false` to 404 params not listed.

## 5. Stream slow parts
Wrap independent slow async children in `<Suspense fallback={…}>`, or rely on `loading.tsx` for the
whole segment. Under Cache Components, request-time data (cookies/headers/searchParams/uncached
params) **must** be inside a Suspense boundary or the build errors.

## 6. Verify
`next build` passes, the route renders, dynamic params resolve, parallel slots all have `default.tsx`.
Reference: `nextjs-16` → routing-and-data.md.
