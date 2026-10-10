# FlowForge AI

FlowForge is an AI whiteboard. Describe an idea in plain words and it draws a flowchart, architecture diagram, concept map or web/mobile wireframe on an [Excalidraw](https://excalidraw.com) canvas. You can keep editing the result by hand, publish a board as a read-only link, or let an external AI tool (Claude Code, Cursor, ChatGPT…) draw on your boards through the built-in **MCP server**.

## Features

- **AI diagram generation** — five modes: `diagram`, `flowchart`, `architecture`, `web`, `mobile`. Flowcharts, diagrams and architecture use automatic layout (dagre); wireframes use explicit coordinates.
- **Whiteboard** — themed Excalidraw canvas with autosave, custom toolbar and a floating options bar.
- **Boards** — create, rename, archive, restore and delete; random cover images.
- **Publishing** — share a board read-only at `/view/<boardId>`; unpublish any time.
- **MCP server** — lets AI tools create boards and queue diagrams for you (see [Connect an AI tool via MCP](#connect-an-ai-tool-via-mcp)).
- **Auth** — Clerk sign-in/sign-up, with a webhook that syncs users to the database.

## Tech stack

| Area | Tools |
|---|---|
| Framework | Next.js 16 (App Router), React 19, TypeScript |
| UI | Tailwind CSS 4, shadcn/ui on Base UI, lucide-react, next-themes |
| Whiteboard | `@excalidraw/excalidraw`, `@dagrejs/dagre` |
| Data fetching | TanStack Query v5 + axios |
| Auth | Clerk |
| Database | Neon Postgres + Drizzle ORM |
| AI | Vercel AI SDK with Mistral models |
| Background jobs | Inngest |
| MCP | `mcp-handler`, `@clerk/mcp-tools` (OAuth via Clerk) |

## Getting started

### 1. Install

```bash
bun install      # or npm install
```

### 2. Environment variables

Create a `.env` file in the project root:

| Variable | Purpose |
|---|---|
| `NEXT_PUBLIC_APP_URL` | Public base URL of the app (`http://localhost:3000` locally). Used for MCP links and OAuth metadata. |
| `DATABASE_URL` | Neon Postgres connection string |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`, `CLERK_SECRET_KEY` | Clerk keys. Without them auth is skipped for local development. |
| `NEXT_PUBLIC_CLERK_SIGN_IN_URL`, `NEXT_PUBLIC_CLERK_SIGN_UP_URL` | Clerk sign-in / sign-up routes |
| `CLERK_WEBHOOK_SIGNING_SECRET` | Verifies the Clerk user-sync webhook (`/api/webhooks/clerk`) |
| `MISTRAL_AI` (or `MISTRAL_API_KEY`) | Mistral API key for diagram generation |
| `INNGEST_EVENT_KEY`, `INNGEST_SIGNING_KEY` | Inngest background jobs |

### 3. Database

```bash
npm run db:push      # apply the schema to your database
npm run db:studio    # optional: browse the data
```

### 4. Run

```bash
npm run dev
```

Open http://localhost:3000. Optional, for Inngest functions: `npm run inngest:dev`.

### Scripts

| Script | What it does |
|---|---|
| `dev` / `build` / `start` | Next.js dev server, production build, production server |
| `db:generate` / `db:push` / `db:studio` | Drizzle migrations, schema push, data browser |
| `inngest:dev` | Local Inngest dev server |

## Project structure

```
app/
  (auth)/          sign-in, sign-up
  (root)/          dashboard shell: all-files, archived
  (whiteboard)/    workspace/[id] — the editor
  view/[id]/       public read-only board
  api/             route handlers: projects, whiteboard, ai, mcp, webhooks, inngest
  .well-known/     OAuth metadata used by the MCP server
components/        shared UI (components/ui = generated shadcn, don't edit)
features/          one folder per feature: _components, hook, api, types
  all-files/       board list, create/rename/archive/delete
  workspace/       editor, AI diagram pipeline (ai/), publishing
  connect-mcp/     "Connect to MCP" dialog content
db/                Drizzle schema and client
lib/               auth helpers, axios instance, board queries, Inngest
```

Client code follows one layering: `page` → feature view → TanStack hook → axios function → route handler. See `CLAUDE.md` for the code style rules.

## Connect an AI tool via MCP

FlowForge exposes a remote MCP server (streamable HTTP):

```
https://<your-domain>/api/mcp          # local: http://localhost:3000/api/mcp
```

There are **no API keys**. The client opens a browser window, you sign in to FlowForge and approve access. You must be signed in to the same account in the browser to see the drawings.

> The easiest way: in the app, open the user menu (bottom-left) → **Connect to MCP**. The dialog shows the exact commands for your URL with copy buttons.

### Claude Code

```bash
claude mcp add --transport http flowforge https://<your-domain>/api/mcp
```

Add `--scope user` to use it in every project. Then start a **new** session, type `/mcp`, choose `flowforge` → **Authenticate**, and approve in the browser. `claude mcp list` should show it as connected.

### Cursor

`~/.cursor/mcp.json` (or `.cursor/mcp.json`):

```json
{ "mcpServers": { "flowforge": { "url": "https://<your-domain>/api/mcp" } } }
```

Then Cursor Settings → MCP → connect `flowforge`.

### VS Code (Copilot agent mode)

`.vscode/mcp.json`:

```json
{ "servers": { "flowforge": { "type": "http", "url": "https://<your-domain>/api/mcp" } } }
```

### OpenCode

`opencode.json`:

```json
{
  "$schema": "https://opencode.ai/config.json",
  "mcp": { "servers": { "flowforge": { "type": "remote", "url": "https://<your-domain>/api/mcp" } } }
}
```

Then run `opencode mcp auth flowforge`.

### claude.ai, Claude Desktop and ChatGPT (custom connector)

Settings → Connectors → **Add custom connector** (ChatGPT: enable Developer mode first). Name it `FlowForge`, paste the MCP URL, choose OAuth, click **Connect** and approve. These run online, so they need your public HTTPS URL, not `localhost`.

### Using it

Ask your AI, for example:

> On FlowForge, create a board called "Connection Test" and draw a small flowchart of a login flow.

Tools exposed: `create_board`, `open_board`, `get_drawing_guide`, `draw_diagram`, `get_board_scene`, `publish_board`, `unpublish_board`. Diagrams are queued on the server and drawn when the board is open in your browser. Boards can't be listed, so give the exact board name.

### Server requirements (self-hosting)

- Deployed over HTTPS with `NEXT_PUBLIC_APP_URL` set to the real URL.
- Dynamic client registration (with PKCE) enabled in the Clerk dashboard.
- The routes `app/api/mcp`, `app/.well-known/oauth-authorization-server` and `app/.well-known/oauth-protected-resource/api/mcp` deployed.
- Database schema up to date (`npm run db:push`).

## Troubleshooting MCP

| Symptom | Fix |
|---|---|
| 401 / "needs authentication" | Normal before sign-in; authenticate from your client. |
| Server or tools missing | Start a new session after adding the server. |
| "Queued" but nothing appears | Open the workspace link in a browser signed in to the same account. |
| Works locally, not in ChatGPT/claude.ai | They can't reach `localhost`; use the public HTTPS URL. |
| "No board named …" | Give the exact name, or ask the AI to create a new board. |
