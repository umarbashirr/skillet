# Routing, file conventions, data fetching & Server Actions

## Routing rules
Folders = URL segments; only `page.tsx` or `route.ts` makes a segment public. `_folder` = private
(non-routable) · `(group)` = route group (no URL impact; can host multiple root layouts) ·
`[slug]` / `[...slug]` / `[[...slug]]` = dynamic / catch-all / optional-catch-all.

## File conventions

| File | Role | Key exports / props |
|------|------|---------------------|
| `layout.tsx` | shared wrapper; preserves state across nav | `children`, `params: Promise`; root layout needs `<html>`/`<body>`; can't read request/searchParams/pathname directly |
| `page.tsx` | route leaf (public) | `params: Promise`, `searchParams: Promise` |
| `loading.tsx` | Suspense fallback for the segment | none |
| `error.tsx` | error boundary (**must be `'use client'`**) | `{ error: Error & {digest?}, unstable_retry() }` (v16.2; `reset()` legacy) |
| `global-error.tsx` | root error boundary; needs `<html>`/`<body>`; no metadata export | `{ error, unstable_retry }` |
| `not-found.tsx` | 404 UI (from `notFound()`) | none |
| `forbidden.tsx` / `unauthorized.tsx` | 403/401 UI (needs `experimental.authInterrupts`) | none |
| `route.ts` | HTTP handler; can't coexist with `page` | `(req: NextRequest, ctx: { params: Promise })` |
| `template.tsx` | like layout but **remounts** (resets state) per nav | `children` |
| `default.tsx` | parallel-slot fallback on hard nav (**required in v16**) | `params: Promise` |

**Nesting order:** `layout` → `template` → `error` → `loading` → `not-found` → `page`. `error` wraps
from `loading` down (not its own `layout`/`template`); `loading` wraps `page`/`not-found`/nested
`layout`; `template` remounts on segment/param change (not on searchParams change).

**Dynamic segments:** `[slug]`→`{slug:'a'}` · `[...slug]`→`{slug:['a','b']}` ·
`[[...slug]]`→`{slug:undefined|['a']}`. `params` is a **Promise** — `await` it (or `useParams()`/
`use()` in Client Components).

**Parallel routes** `@slot`: rendered as named layout props (`children` is the implicit slot); each
slot can own `loading`/`error`; **needs `default.tsx`**. **Intercepting routes** `(.)` `(..)` `(...)`:
intercept on soft nav (modals), full route on hard nav — usually paired with a `@modal` slot.

**Route segment config** (still valid): `dynamicParams` (default `true`; `false` → 404 unknown
params), `runtime` (`'nodejs'` default), `preferredRegion`, `maxDuration`. Under Cache Components,
`dynamic`/`revalidate`/`fetchCache` are gone.

**`generateStaticParams`** prebuilds dynamic routes (runs before layouts/pages at build; not on ISR;
runs on nav in dev). Under Cache Components it must return ≥1 param. Without it, params are
request-time → wrap in `<Suspense>`.

**Typed props:** `import type { PageProps, LayoutProps } from 'next'` →
`Page(props: PageProps<'/blog/[slug]'>)` then `await props.params`. Run `next typegen`.
`typedRoutes: true` types `<Link href>`.

## Data fetching
- Server Components: `await fetch(...)` (memoized per render). Parallelize independent calls with
  `Promise.all`; dedupe shared reads with React `cache()`.
- Sequential when dependent; otherwise hoist promises and `Promise.all`.
- Client-side: SWR / React Query, or stream a promise + React `use()` (see cache-and-rendering.md).

## Server Actions (`'use server'`)
Async server functions. **File-level** directive when imported by Client Components; **inline**
allowed inside Server Components.
```tsx
// app/actions.ts
'use server'
import { revalidateTag } from 'next/cache'
import { redirect } from 'next/navigation'
export async function createPost(prev, formData: FormData) {
  const session = await verifySession()                 // authZ INSIDE the action
  const parsed = Schema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) return { errors: parsed.error.flatten().fieldErrors }
  const post = await db.post.create({ data: parsed.data })
  revalidateTag('posts', 'max')                          // or updateTag('posts') for read-your-writes
  redirect(`/posts/${post.id}`)
}
```
- Invoke via `<form action={fn}>`, `fn.bind(null, id)` for extra args, or from event handlers.
- State/pending: `const [state, formAction, pending] = useActionState(fn, init)`. Also
  `useFormStatus()` (in a child of `<form>`) and `useOptimistic()`.
- **Security:** authenticate & authorize *inside* the action; read session from cookies/headers,
  never trust args; return only the fields the UI needs (DTO). A matcher excluding a path in `proxy`
  also skips that route's Server Actions (they POST to the route).
- Validate with Zod `safeParse`; return field errors as action state.

## Forms
Prefer the platform `<form action={serverAction}>`. `import Form from 'next/form'` adds client-side
nav + prefetch for GET search forms. Client validation via native attributes; server validation in
the action. Multiple submit buttons via `formAction={otherAction}`.

## Navigation & control-flow functions (`next/navigation`, `next/server`, `next/cache`)
- `redirect(path, type?)` — 307 (303 in actions); throws (call outside try/catch, no return).
- `permanentRedirect` — 308. `notFound()` — 404 + renders `not-found` + `noindex`.
- `forbidden()` / `unauthorized()` — 403/401, render those files; need
  `experimental.authInterrupts`; not in root layout.
- `connection()` — gate to request time. `after(cb)` — run work after the response (in Server
  Components read `headers()`/`cookies()` *before* and close over them; in actions/handlers you can
  read them inside).
- Client hooks: `useRouter()` (`push`/`replace`/`refresh`/`prefetch`/`back`/`forward`; `refresh()`
  re-renders but does **not** clear the server cache) · `usePathname()` · `useSearchParams()` (wrap
  consumer in `<Suspense>` to avoid prerender bailout) · `useParams()` ·
  `useSelectedLayoutSegment(s)` · `useLinkStatus()` (pending-nav indicator).
