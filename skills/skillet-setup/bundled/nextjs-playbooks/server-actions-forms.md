# Playbook: form → Server Action (validation, pending, optimistic)

Goal: a working form backed by a Server Action with server validation, pending UI, and optional
optimistic updates. Background: `nextjs-16` → routing-and-data.md.

## 1. The action (its own file, file-level directive)
```ts
// app/posts/actions.ts
'use server'
import { z } from 'zod'
import { revalidateTag } from 'next/cache'
import { redirect } from 'next/navigation'
import { verifySession } from '@/app/lib/dal'

const Schema = z.object({ title: z.string().min(1), body: z.string().min(1) })
export type State = { errors?: Record<string, string[]>; message?: string }

export async function createPost(_prev: State, formData: FormData): Promise<State> {
  const session = await verifySession()                         // authZ INSIDE the action
  if (!session) return { message: 'Unauthorized' }
  const parsed = Schema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) return { errors: parsed.error.flatten().fieldErrors }
  const post = await db.post.create({ data: { ...parsed.data, userId: session.userId } })
  revalidateTag('posts', 'max')                                 // or updateTag('posts')
  redirect(`/posts/${post.id}`)
}
```
Rules: authenticate/authorize inside the action; read session from cookies/headers (never trust
client args); return only what the UI needs.

## 2. The form (Client Component) with `useActionState`
```tsx
'use client'
import { useActionState } from 'react'
import { createPost, type State } from './actions'

const initial: State = {}
export function PostForm() {
  const [state, formAction, pending] = useActionState(createPost, initial)
  return (
    <form action={formAction}>
      <input name="title" required />
      {state.errors?.title && <p>{state.errors.title[0]}</p>}
      <textarea name="body" required />
      {state.errors?.body && <p>{state.errors.body[0]}</p>}
      {state.message && <p role="alert">{state.message}</p>}
      <button disabled={pending}>{pending ? 'Saving…' : 'Create'}</button>
    </form>
  )
}
```

## 3. Variations
- **Extra args:** `createPost.bind(null, id)` and add `id` as the action's first param.
- **Submit button only:** isolate `useFormStatus()` in a child component of `<form>`.
- **Multiple buttons:** `<button formAction={publishAction}>` alongside the form's `action`.
- **Optimistic UI:** `useOptimistic(current, (s, next) => […])`, apply before `await`ing the action.
- **Plain Server Component form** (no client state): `<form action={createPost}>` directly with an
  inline or imported action — no `useActionState`.

## 4. Pitfalls
- A `proxy.ts` matcher that excludes the route also blocks its Server Actions (they POST to the route).
- Don't put `redirect()` in a try/catch — it throws by design.
- Multi-instance: set `NEXT_SERVER_ACTIONS_ENCRYPTION_KEY` identically on every node.

## 5. Verify
Submit valid + invalid input: errors render, pending toggles, success redirects/revalidates, and the
list reflects the mutation.
