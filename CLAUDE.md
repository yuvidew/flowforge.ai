# CLAUDE.md

Instructions for Claude Code when working in this repository.

## Function/component declaration style

Full rules live in [`.claude/docs/code-style.md`](.claude/docs/code-style.md) — read it before writing or editing any hand-written `.ts`/`.tsx` file. Summary:

| What you're writing | Style |
|---|---|
| React component | `const` + arrow, exported directly — `export const NavUser = () => { ... }` |
| Custom hook | `const` + arrow — `export const useIsMobile = () => { ... }` |
| Plain helper/utility function | `const` + arrow — `const getInitials = (name) => { ... }` |
| Default-exported page/layout component | named `const` first, then `export default` — `const Page = () => {...}; export default Page;` |
| Next.js route handler (`app/api/**/route.ts`) | `const` + arrow, exported directly — `export const POST = async (req) => { ... }` |
| Inline/anonymous (event handlers, `.map`/`.filter`, `useEffect`/`useState` bodies) | arrow function |

**Exception:** `components/ui/` is shadcn CLI output (`function ComponentName(props) { ... }`). Never convert it — leave it in generated style so future `npx shadcn add`/updates don't get overwritten or diverge.

## Comment style

The codebase has historically been under-commented. Every new component, hook, function, and non-obvious variable should carry a short comment explaining intent — not restating the code.

- **Components** get a JSDoc-style block above the declaration, using `@` tags:

  ```tsx
  /**
   * @component NavUser
   * @description Renders the signed-in user's avatar and account dropdown in the sidebar footer.
   */
  export const NavUser = () => { ... }
  ```

  Add `@param` for non-trivial props when it clarifies usage.

- **Hooks, plain functions, and important/non-obvious variables** get a single `//` line directly above them, stating *why*/*what*, not a restatement of the syntax:

  ```ts
  // Tracks whether the viewport is below the mobile breakpoint.
  export const useIsMobile = () => { ... }

  // Extracts up to two initials from a full name for the avatar fallback.
  const getInitials = (name: string) => { ... }

  // Debounce timer id — cleared on unmount to avoid a stray state update.
  const timeoutRef = useRef<NodeJS.Timeout>();
  ```

- Skip comments only for self-evident local variables (loop indices, trivial destructures) and for generated code under `components/ui/`.

## Calling backend APIs (TanStack Query + axios)

All client-side API calls go through TanStack Query v5 + axios, layered per feature. Check the TanStack Query docs (Context7) for v5 API details before writing non-trivial usage.

### Flow

```
app/**/page.tsx                      thin page, renders a feature view
  -> features/<feature>/_components/*-view.tsx   UI; consumes hooks only
    -> features/<feature>/hook/use-*.ts          TanStack hooks (queries, mutations, toasts)
      -> features/<feature>/api/index.ts         axios functions only
        -> app/api/<resource>/route.ts           route handler (Clerk auth, Drizzle)
```

- Components never call axios directly and never show toasts — hooks own both.
- Request/response types live in `features/<feature>/types.ts`.

### Setup (already done)

- `@tanstack/react-query` and `axios` are installed.
- `components/providers/query-provider.tsx` holds the single `QueryClient` (30s `staleTime`, no retry on 4xx) and is mounted in `app/layout.tsx` around `children`.
- Use the shared axios instance `api` from `lib/axios.ts` (`baseURL: "/api"`, so paths are `"/logs"`, not `"/api/logs"`).
- Use `getErrorMessage(error, fallback)` from `lib/get-error-message.ts` for toasts — do not re-define it in hook files.

### API functions — `features/<feature>/api/index.ts`

- `const` + arrow, relative URLs, typed generics, return the unwrapped `data`.
- GET params go in `{ params }`; DELETE bodies go in `{ data }`.

```ts
// Fetches a page of run logs.
export const getLogs = async ({ page, pageSize }: { page: number; pageSize: number }) => {
  const { data } = await api.get<LogsResponse>("/logs", { params: { page, pageSize } });
  return data;
};
```

### Query hooks — `features/<feature>/hook/use-<x>.ts`

- Names: `useGet<Plural>` for lists, otherwise verb-first (`useAgentTools`). File extension is `.ts` unless the file contains JSX.
- Query keys are kebab-case arrays: `["get-logs", page, pageSize]`. Reuse the exact same key when invalidating; if a key is shared across features, export it from a constants file.
- Use `enabled` for gated fetches, `placeholderData: keepPreviousData` for pagination, and an optional `options?: { refetchInterval?: number }` argument for opt-in polling.

```ts
// Paginated run logs; keeps the previous page visible while the next one loads.
export const useGetLogs = (page: number, pageSize: number, options?: { refetchInterval?: number }) =>
  useQuery({
    queryFn: () => getLogs({ page, pageSize }),
    queryKey: ["get-logs", page, pageSize],
    placeholderData: keepPreviousData,
    refetchInterval: options?.refetchInterval,
  });
```

### Mutation hooks

Every mutation has `mutationFn`, `mutationKey` (kebab-case verb phrase), `onSuccess` (invalidate the owning query key + success toast) and `onError` (error toast using `getErrorMessage`). No optimistic updates unless explicitly requested.

```ts
// Deletes an agent, then refreshes the agents list.
export const useDeleteAgent = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: deleteAgent,
    mutationKey: ["delete-agent"],
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["all-agents"] });
      toast.add({ title: "Agent deleted", type: "success" });
    },
    onError: (error) => {
      toast.add({ title: "Couldn't delete agent", description: getErrorMessage(error, "Please try again."), type: "error" });
    },
  });
};
```

- Components pass per-call callbacks only for UI follow-up: `mutate(vars, { onSuccess: () => onOpenChange(false) })`.
- Extra variables used only for the toast (e.g. `agentName`) may ride along in the mutation variables; note that in a comment.
- Per-item pending state: `mutation.isPending && mutation.variables?.id === item.id`.

### Components

Render states in this order: `isPending` -> `isError` -> empty -> data. Use `isPending` consistently (not `isLoading`). Mutation buttons: `disabled={isPending}`, a spinner, and a label swap ("Saving…").

### Route handlers — `app/api/<resource>/route.ts`

- `export const GET = async (req: NextRequest) => { ... }`, authenticate with Clerk, scope every query to the signed-in user.
- Success returns the raw body or a small envelope (`{ tools }`); failure returns `{ error: string }` — the client reads exactly that key.
- Unauthenticated -> **401** (not 400). Missing/invalid input -> 400, not found -> 404, unexpected -> 500.
- Parse and validate request bodies with zod; never spread a client-supplied object into `db.update().set(...)`. Pick allowed fields explicitly.
- Wrap `req.json()` and DB calls in try/catch so the handler always returns `{ error }`.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
