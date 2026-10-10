---
name: flowforge-mcp
description: Use when the user wants to create or add diagrams, flowcharts, architecture diagrams, or web/mobile wireframes on a FlowForge board, open or create a FlowForge board by name, or publish/unpublish a board, through the FlowForge MCP server. Covers connecting, the tool workflow, diagram rules and error handling.
---

# FlowForge MCP

FlowForge is a whiteboard app (Excalidraw canvas). Its MCP server lets an AI assistant create boards and draw diagrams on them. **You (the connected AI) design the diagram yourself**; the server does not call any other model. It only validates what you send, queues it, and the user's open browser tab draws it.

## Connect

The server is a remote (streamable HTTP) MCP server at `https://flowforge-ai-nine.vercel.app/api/mcp`, protected by Clerk OAuth. There are no API keys: the client opens a browser window and the user signs in to FlowForge and approves access.

If the `flowforge` tools are not available yet, or the user asks how to connect a specific client (Claude Code, OpenCode, Cursor, VS Code, claude.ai, ChatGPT), use the `flowforge-connect` skill for exact steps and troubleshooting. The user must be signed in to the same FlowForge account in the browser to see the result.

## Ground rules

1. **There is no way to list boards.** Work only with a board the user names, or create a new one. Never guess or invent board names or ids.
2. The `boardId` comes only from `open_board` or `create_board`. Never fabricate one.
3. Decide with the user's words: "work on / open / continue board X" -> `open_board`. "make / start / new board" -> `create_board`.
4. Only publish when the user explicitly asks. Publishing makes the board readable by anyone with the link.
5. Do not print the diagram JSON in chat. Pass it as the `diagram` argument of `draw_diagram`.
6. There is no delete tool. Do not try to work around that.

## Workflow

1. **Get the board.**
   - Existing board -> `open_board({ name })`.
   - New board -> `create_board({ name })`.
   - Both return `boardId`, `workspaceUrl`, `published` and `publicUrl`.
2. **Pick the mode** (see below) and call `get_drawing_guide({ mode })`. It returns the full, current design rules for that mode (sizes, colours, layout, label style). Follow it; this skill is only a summary.
3. **Design the diagram** from the user's request: specific, realistic labels (real field names, button texts, technologies), not generic placeholders.
4. **Draw it** with `draw_diagram({ boardId, mode, diagram })`.
5. **Tell the user** the `workspaceUrl` and that the diagram appears there within a few seconds *while the board is open in the browser*.
6. Publish only on request: `publish_board({ boardId })` / `unpublish_board({ boardId })`.

For several diagrams on one board, call `draw_diagram` once per diagram. Each new one is placed to the right of the existing content. Do not resend a diagram that was already queued.

## Tools

| Tool | Use |
|---|---|
| `open_board` | Find an existing board by exact name (case-insensitive, archived boards are skipped) |
| `create_board` | Create a new board; fails if that name already exists (then use `open_board`) |
| `get_drawing_guide` | Get the design rules for one mode. Call before `draw_diagram` |
| `draw_diagram` | Queue a diagram for the board |
| `get_board_scene` | Read the elements saved on the board (shapes, text, arrow connections, positions). Queued diagrams are not included until the board is opened in the browser |
| `publish_board` | Make the board public (read-only link). Idempotent, same link every time |
| `unpublish_board` | Take the public link down. Content is kept |

## Choosing a mode

| Mode | Use for |
|---|---|
| `diagram` | Concept/mind maps, timelines, org charts, entity relationships, comparisons |
| `flowchart` | Processes, workflows, decision logic, user journeys |
| `architecture` | Software or cloud system design |
| `web` | Desktop web page wireframe |
| `mobile` | Phone app screens (max 4 screens) with navigation arrows |

## Diagram rules (summary)

- Shape: `{ title, nodes[], edges[], texts[]? }`. Limits: 80 nodes, 150 edges, 20 texts.
- Node ids are unique. **Every edge `from` and `to` must be an existing node id**, otherwise the call is rejected.
- Size each node so its label fits: roughly 10px of width per character at font size 16, plus 30px padding. Use `\n` to break long labels (max about 4 lines). Put several lines of text in one node's label instead of many tiny nodes.
- Colours are hex. Use a restrained palette (light fill, darker stroke of the same hue) and let colour carry meaning (type, layer, status, primary action).
- `diagram`, `flowchart`, `architecture`: layout and arrow routing are automatic. Set every node's `x` and `y` to `0`, do not draw container/boundary/swim-lane shapes, give every node a non-empty label, and make sure every node has at least one edge.
- `web`, `mobile`: you control the coordinates. Follow the pixel recipe returned by `get_drawing_guide` (frames first, then contents; snap to multiples of 10).
- Use the user's own terminology. If the request is vague, make conventional assumptions instead of asking.

## What the responses mean

- `draw_diagram` returns "Queued". The diagram is **not drawn yet**: it appears when the board is open in the browser. Never tell the user it is already on the board, and never say it is visible on the public link before it has been drawn.
- Two different links: `workspaceUrl` is private (sign-in required, where the user edits); `publicUrl` is read-only and exists only when `published` is true. Do not hand out `publicUrl` for an unpublished board.
- `publish_board` may warn that queued diagrams are not drawn yet. Pass that on and ask the user to open the workspace URL first.

## Errors -> what to do

| Message | Action |
|---|---|
| `No board named "X"` | Ask the user whether to create it, then `create_board` |
| `More than one board is named "X"` | Ask the user to rename one or give a more specific name |
| `A board named "X" already exists` | Use `open_board` instead |
| `Board not found` | Call `open_board` / `create_board` again for a valid `boardId` |
| `These edges point at ids that are not in nodes` | Fix the listed edges and call `draw_diagram` again |
| `The diagram is not valid` | Check field types against the tool schema and retry |
| `Unauthorized` / 401 | The user must re-authenticate the `flowforge` server in the client |

## Never

- List, guess or enumerate boards.
- Publish, unpublish or create boards the user did not ask for.
- Claim a diagram is drawn or public when the response says it is only queued.
- Send the same diagram repeatedly "to make sure"; check the response instead.
