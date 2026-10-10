// Markdown code fence, kept in a variable so the template below stays readable.
const FENCE = "```"

// Builds the text of the flowforge-connect skill for a given MCP URL so users can copy it into their AI tool.
export const getConnectSkill = (url: string) => `---
name: flowforge-connect
description: Use when the user wants to connect, set up, add, authenticate, switch or troubleshoot the FlowForge MCP server in an AI client such as Claude Code, OpenCode, Cursor, VS Code, Claude Desktop / claude.ai or ChatGPT. Gives exact copy-paste steps per client, how to verify the connection, and fixes for common errors.
---

# Connect an AI tool to FlowForge

One MCP server, one URL, sign-in with the user's FlowForge account. No API keys and no headers: the client opens a browser window, the user signs in and approves access, and the client stores a short-lived token and refreshes it by itself.

## Before you start

| Item | Value |
|---|---|
| MCP URL | \`${url}\` |
| Transport | Remote, "streamable HTTP" |
| Auth | OAuth through Clerk (the same account as the FlowForge website) |

- The user needs a FlowForge account. Sign up on the site first if they have none.
- ChatGPT and claude.ai (web) run on the internet, so they can only use a public HTTPS URL, never \`localhost\`.

## Claude Code

Add the server (run in any terminal):

${FENCE}bash
claude mcp add --transport http flowforge ${url}
${FENCE}

Where it is available is decided by \`--scope\`:

| Scope | Effect |
|---|---|
| \`local\` (default) | Only in the current project folder, private to the user |
| \`user\` | In every project (add \`--scope user\`) |
| \`project\` | Written to \`.mcp.json\` so the whole team gets it (safe: it holds no secret) |

Then sign in:

1. Start a **new** Claude Code session (a running session does not pick up new servers).
2. Type \`/mcp\`, choose \`flowforge\`, choose **Authenticate**.
3. The browser opens. Sign in to FlowForge and approve. Return to the terminal.

Verify: \`claude mcp list\` shows \`flowforge\` as connected, and \`/mcp\` lists seven tools (\`open_board\`, \`create_board\`, \`get_drawing_guide\`, \`draw_diagram\`, \`get_board_scene\`, \`publish_board\`, \`unpublish_board\`).

Switch or remove:

${FENCE}bash
claude mcp remove flowforge
claude mcp add --transport http flowforge <new-url>
${FENCE}

## OpenCode

Add the server to \`opencode.json\` in the project, or to the global OpenCode config:

${FENCE}jsonc
{
  "$schema": "https://opencode.ai/config.json",
  "mcp": {
    "servers": {
      "flowforge": {
        "type": "remote",
        "url": "${url}"
      }
    }
  }
}
${FENCE}

OAuth is on by default for remote servers; do not add headers or \`oauth: false\`. OpenCode finds the login server on its own, uses PKCE and registers itself.

Sign in: run \`opencode mcp auth flowforge\`, or open \`/mcps\` inside OpenCode, select \`flowforge\` and finish in the browser.

Note: older OpenCode versions put servers directly under \`"mcp"\` (\`"mcp": { "flowforge": { "type": "remote", "url": "..." } }\`). If OpenCode rejects the config above, check \`opencode --version\` and use the layout from that version's docs. The fields \`type\` and \`url\` stay the same.

## Cursor

Create or edit \`~/.cursor/mcp.json\` (all projects) or \`.cursor/mcp.json\` (one project):

${FENCE}json
{
  "mcpServers": {
    "flowforge": {
      "url": "${url}"
    }
  }
}
${FENCE}

Open Cursor Settings -> MCP, find \`flowforge\` and click its connect / login button. Sign in to FlowForge in the browser and approve.

## VS Code (GitHub Copilot agent mode)

Create \`.vscode/mcp.json\` (or run "MCP: Add Server" from the command palette and choose HTTP):

${FENCE}json
{
  "servers": {
    "flowforge": {
      "type": "http",
      "url": "${url}"
    }
  }
}
${FENCE}

VS Code shows an authenticate prompt on first use. Sign in and approve.

## Claude Desktop and claude.ai (web)

1. Open Settings -> Connectors (the menu name can vary by plan).
2. Choose **Add custom connector**.
3. Name: \`FlowForge\`. URL: \`${url}\`.
4. Click **Connect**, sign in to FlowForge and approve.

## ChatGPT

1. Open Settings -> Connectors. Custom MCP connectors may require **Developer mode** and a plan that allows them.
2. Create a new connector with the URL \`${url}\`, authentication **OAuth**.
3. Create it, then sign in to FlowForge and approve when asked.
4. In a chat, enable the FlowForge connector from the tools menu.

Menu names change often; follow the current ChatGPT connector docs if the labels differ.

## Any other MCP client

Look for "remote MCP server", "streamable HTTP" or "custom connector" in its settings and enter the MCP URL. Choose OAuth if asked. Do not set an Authorization header.

If the client supports only local (stdio) servers, bridge with \`mcp-remote\`:

${FENCE}bash
npx -y mcp-remote ${url}
${FENCE}

Use that command as the server's \`command\`/\`args\` in the client's config.

## Check that it works

After signing in, give the AI this prompt:

> On FlowForge, create a board called "Connection Test" and draw a small flowchart of a login flow.

Expected: the AI calls \`create_board\`, then \`get_drawing_guide\`, then \`draw_diagram\`, and returns a workspace link. Open that link while signed in to the same account; the diagram appears within a few seconds. (It is only drawn while the board is open in the browser.)

## Troubleshooting

| Symptom | Cause and fix |
|---|---|
| Server shows "needs authentication" / 401 | Normal before sign-in. Authenticate it (\`/mcp\` in Claude Code, \`opencode mcp auth flowforge\`, or the connect button). |
| Tools list is empty or the server is missing | Start a **new** session after adding the server. In Claude Code, run \`claude mcp list\`. |
| Browser login works but the client still says unauthorized | Run authenticate again. Make sure the URL ends with \`/api/mcp\` and has no trailing path. |
| "No board named ..." | Boards cannot be listed. Give the exact board name, or ask the AI to create a new board. |
| Diagram says "Queued" but nothing appears | The board must be open in a browser tab, signed in to the **same** account. Open the workspace link the AI gave. |
| Signed in with a different account than expected | Boards belong to the account used at sign-in. Remove the server and add it again, or sign out of FlowForge in the browser first. |
| Token expired | Authenticate again; clients normally refresh tokens by themselves. |
`
