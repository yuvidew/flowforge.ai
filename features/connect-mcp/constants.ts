import { getConnectSkill } from "./skill-content"

// A copyable snippet shown inside a connect tab.
export type ConnectSnippet = {
    label: string
    code: string
}

// One tab of the Connect MCP page: short steps plus the snippets they refer to.
export type ConnectTab = {
    id: string
    label: string
    intro: string
    snippets: ConnectSnippet[]
    steps: string[]
}

// Builds the per-client instructions for a given MCP URL (differs between local dev and production).
export const getConnectTabs = (url: string): ConnectTab[] => [
    {
        id: "claude-code",
        label: "Claude Code",
        intro: "Add FlowForge as a remote HTTP server from any terminal.",
        snippets: [
            { label: "Add the server", code: `claude mcp add --transport http flowforge ${url}` },
            { label: "Available in every project (optional)", code: `claude mcp add --transport http --scope user flowforge ${url}` },
        ],
        steps: [
            "Run the command above.",
            "Start a new Claude Code session, then type /mcp and pick flowforge.",
            "Choose Authenticate, sign in to FlowForge in the browser and approve.",
            "Run claude mcp list to confirm flowforge is connected.",
        ],
    },
    {
        id: "cursor",
        label: "Cursor",
        intro: "Add the server to ~/.cursor/mcp.json (all projects) or .cursor/mcp.json (one project).",
        snippets: [
            {
                label: "mcp.json",
                code: JSON.stringify({ mcpServers: { flowforge: { url } } }, null, 2),
            },
        ],
        steps: [
            "Save the snippet in the mcp.json file.",
            "Open Cursor Settings → MCP and find flowforge.",
            "Click connect / login, sign in to FlowForge and approve.",
        ],
    },
    {
        id: "vscode",
        label: "VS Code",
        intro: "Works with GitHub Copilot agent mode. Create .vscode/mcp.json in your project.",
        snippets: [
            {
                label: ".vscode/mcp.json",
                code: JSON.stringify({ servers: { flowforge: { type: "http", url } } }, null, 2),
            },
        ],
        steps: [
            "Save the snippet as .vscode/mcp.json.",
            "Open Copilot Chat in agent mode and use a FlowForge tool.",
            "When VS Code asks to authenticate, sign in to FlowForge and approve.",
        ],
    },
    {
        id: "opencode",
        label: "OpenCode",
        intro: "Add a remote server to opencode.json. OAuth is automatic, so don't add headers.",
        snippets: [
            {
                label: "opencode.json",
                code: JSON.stringify(
                    {
                        $schema: "https://opencode.ai/config.json",
                        mcp: { servers: { flowforge: { type: "remote", url } } },
                    },
                    null,
                    2
                ),
            },
            { label: "Sign in", code: "opencode mcp auth flowforge" },
        ],
        steps: [
            "Add the snippet to opencode.json (project) or your global OpenCode config.",
            "Run the sign-in command, or open /mcps in OpenCode and select flowforge.",
            "Approve access in the browser.",
        ],
    },
    {
        id: "custom-connector",
        label: "Custom connector",
        intro: "For claude.ai, Claude Desktop and ChatGPT. These run online, so they need the production URL (not localhost).",
        snippets: [
            { label: "Name", code: "FlowForge" },
            { label: "Server URL", code: url },
        ],
        steps: [
            "Open Settings → Connectors (claude.ai / Claude Desktop) or Settings → Connectors with Developer mode on (ChatGPT).",
            "Choose Add custom connector.",
            "Enter the name and paste the Server URL above. If asked for authentication, choose OAuth.",
            "Click Connect, sign in to FlowForge and approve.",
            "In a chat, enable the FlowForge connector from the tools menu.",
        ],
    },
    {
        id: "skills",
        label: "Skills",
        intro: "A skill teaches your AI how to connect to FlowForge, step by step, for every client.",
        snippets: [
            { label: "flowforge-connect / SKILL.md", code: getConnectSkill(url) },
            {
                label: "Try it",
                code: 'On FlowForge, create a board called "Connection Test" and draw a small flowchart of a login flow.',
            },
        ],
        steps: [
            "Copy the skill text above.",
            "Save it as SKILL.md inside a folder named flowforge-connect in ~/.claude/skills/ (all projects) or .claude/skills/ (one project).",
            "Ask your AI to connect to FlowForge and it will follow the steps for your client.",
            "Once connected, send the \"Try it\" prompt. Keep the board open in your browser so the diagram gets drawn.",
        ],
    },
]
