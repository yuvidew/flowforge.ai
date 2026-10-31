import type { AuthInfo } from "@modelcontextprotocol/server";
import { createMcpHandler, withMcpAuth } from "mcp-handler";
import { z } from "zod";

import { diagramSchema } from "@/features/workspace/ai/diagram-schema";
import { diagramInputSchema } from "@/features/workspace/ai/mcp-diagram-input";
import { getSystemPrompt } from "@/features/workspace/ai/prompts";
import { verifyClerkToken } from "@clerk/mcp-tools/next";
import { auth, clerkClient } from "@clerk/nextjs/server";
import { resolveAgentName } from "@/lib/ai-live";
import { submitToBoard } from "@/lib/server-draw";

import {
  countPendingDiagrams,
  createBoardForUser,
  findBoardsByName,
  getBoardDiagram,
  getBoardScene,
  getOwnedBoard,
  setBoardPublished,
  type WorkspaceScope,
} from "@/lib/boards";
import { editOpSchema } from "@/features/workspace/schema";


const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

const modeSchema = z
  .enum(["diagram", "flowchart", "architecture", "web", "mobile"])
  .describe("diagram = concept map/timeline/org chart, flowchart, architecture = system design, web = desktop wireframe, mobile = app screens");

// Plain-text tool result; isError tells the AI client the call failed so it can correct itself or ask the user.
const reply = (message: string, isError = false) => ({
  content: [{ type: "text" as const, text: message }],
  ...(isError ? { isError: true } : {}),
});

// Board summary every tool returns: ids and links, plus the publish state so the AI never has to guess it.
const describeBoard = (board: { projectId: string; projectName: string; isPublished: boolean }) =>
  JSON.stringify(
    {
      boardId: board.projectId,
      name: board.projectName,
      workspaceUrl: `${APP_URL}/workspace/${board.projectId}`,
      published: board.isPublished,
      publicUrl: board.isPublished ? `${APP_URL}/view/${board.projectId}` : null,
    },
    null,
    2,
  );

// Email of the user behind the API key; set by verifyKey for every authenticated call.
const getEmail = (authInfo?: AuthInfo) => {
  const email = authInfo?.extra?.email;
  return typeof email === "string" ? email : null;
};

// Team workspaces (Clerk organizations) the signed-in user belongs to.
const getWorkspaces = async (authInfo?: AuthInfo) => {
  const userId = authInfo?.extra?.userId;
  if (typeof userId !== "string") return [];

  const client = await clerkClient();
  const { data } = await client.users.getOrganizationMembershipList({ userId, limit: 100 });
  return data.map((membership) => ({ id: membership.organization.id, name: membership.organization.name, role: membership.role }));
};

// Ids of the user's team workspaces; lets tools open team boards created by other members.
const getOrgIds = async (authInfo?: AuthInfo) => (await getWorkspaces(authInfo)).map((workspace) => workspace.id);

// Turns the optional workspace name into a search/create scope. "Personal" (or a missing name) means the user's own space.
// Returns an error message instead when the name is unknown or ambiguous.
const resolveWorkspace = async (authInfo: AuthInfo | undefined, workspace?: string): Promise<{ scope: WorkspaceScope } | { error: string }> => {
  if (!workspace) return { scope: undefined };
  if (workspace.toLowerCase() === "personal") return { scope: "personal" };

  const workspaces = await getWorkspaces(authInfo);
  const matches = workspaces.filter((item) => item.name.toLowerCase() === workspace.toLowerCase());
  if (matches.length === 0) {
    return { error: `No workspace named "${workspace}". Call list_workspaces to see the user's workspaces, or use "Personal".` };
  }
  if (matches.length > 1) return { error: `More than one workspace is named "${workspace}". Ask the user which one they mean.` };
  return { scope: { orgId: matches[0].id } };
};

const workspaceSchema = z
  .string()
  .trim()
  .min(1)
  .max(100)
  .optional()
  .describe("Workspace name from list_workspaces, or \"Personal\" for the user's own space. Omit to use any of the user's boards (open) or the Personal space (create).");

// Name the AI tool tells us it is (e.g. "Cursor"); shown on its live cursor so people see who is drawing.
const agentNameSchema = z
  .string()
  .trim()
  .max(40)
  .optional()
  .describe("Your product name as the user knows it, e.g. \"Claude Code\", \"Cursor\", \"ChatGPT\". Shown on your live cursor while you draw.");

const handler = createMcpHandler(
  (server) => {
    // The connecting MCP client's own name, when the transport kept it from the initialize call.
    const getClientName = () => server.server.getClientVersion?.()?.name ?? null;

    server.registerTool(
      "list_workspaces",
      {
        title: "List the user's workspaces",
        description:
          "Lists the workspaces the user can use: their Personal space plus every team workspace they are a member of. Pass one of these names as `workspace` to open_board or create_board.",
        inputSchema: z.object({}),
        annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
      },
      async (_args, ctx) => {
        const email = getEmail(ctx.http?.authInfo);
        if (!email) return reply("Unauthorized", true);

        const workspaces = await getWorkspaces(ctx.http?.authInfo);
        return reply(JSON.stringify({ workspaces: [{ name: "Personal", type: "personal" }, ...workspaces.map((item) => ({ name: item.name, type: "team", role: item.role }))] }, null, 2));
      },
    );

    server.registerTool(
      "open_board",
      {
        title: "Open an existing board",
        description:
          "Use when the user wants to work on an EXISTING FlowForge board. Finds it by exact name (case-insensitive) and returns its boardId and workspace URL. Pass `workspace` to look only inside one workspace (see list_workspaces). There is no way to list boards; the user must give the name.",
        inputSchema: z.object({
          name: z.string().trim().min(1).max(50).describe("Exact board name given by the user"),
          workspace: workspaceSchema,
        }),
      },
      async ({ name, workspace }, ctx) => {
        const email = getEmail(ctx.http?.authInfo);
        if (!email) return reply("Unauthorized", true);

        const resolved = await resolveWorkspace(ctx.http?.authInfo, workspace);
        if ("error" in resolved) return reply(resolved.error, true);

        const matches = await findBoardsByName(email, name, resolved.scope);

        if (matches.length === 0) {
          return reply(`No board named "${name}". Ask the user whether to create it with create_board.`, true);
        }
        if (matches.length > 1) {
          return reply(`More than one board is named "${name}". Ask the user to rename one or give a more specific name.`, true);
        }
        return reply(describeBoard(matches[0]));
      },
    );

    server.registerTool(
      "create_board",
      {
        title: "Create a new board",
        description:
          "Use when the user wants a NEW board. Pass `workspace` (from list_workspaces) to create it in a team workspace; omit it for the Personal space. Returns its boardId and workspace URL. Fails if a board with that name already exists in that workspace; then use open_board instead.",
        inputSchema: z.object({
          name: z.string().trim().min(1).max(50).describe("Name for the new board"),
          workspace: workspaceSchema,
        }),
      },
      async ({ name, workspace }, ctx) => {
        const email = getEmail(ctx.http?.authInfo);
        if (!email) return reply("Unauthorized", true);

        // Creating without a workspace keeps the old behaviour: a personal board.
        const resolved = await resolveWorkspace(ctx.http?.authInfo, workspace ?? "Personal");
        if ("error" in resolved) return reply(resolved.error, true);
        const orgId = resolved.scope && resolved.scope !== "personal" ? resolved.scope.orgId : null;

        if ((await findBoardsByName(email, name, resolved.scope)).length > 0) {
          return reply(`A board named "${name}" already exists${workspace ? ` in ${workspace}` : ""}. Use open_board to work on it.`, true);
        }
        return reply(describeBoard(await createBoardForUser(email, name, orgId)));
      },
    );

    server.registerTool(
      "get_board_scene",
      {
        title: "Read what is on a board",
        description:
          "Returns the elements currently saved on the board (shapes with their text, arrows with the shapes they connect, positions, colours). Call open_board first for the boardId. Diagrams that are only queued (a browser tab has the board open and has not drawn them yet) are NOT included. Shapes drawn by FlowForge carry nodeId and diagramId; older shapes have null.",
        inputSchema: z.object({ boardId: z.string().min(1).describe("boardId from open_board or create_board") }),
        annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
      },
      async ({ boardId }, ctx) => {
        const email = getEmail(ctx.http?.authInfo);
        if (!email) return reply("Unauthorized", true);

        const board = await getOwnedBoard(email, boardId, await getOrgIds(ctx.http?.authInfo));
        if (!board) return reply("Board not found. Call open_board or create_board first.", true);

        const scene = await getBoardScene(boardId);
        const note = scene.truncated ? "\n\nThe board is large: only the first elements are shown." : "";

        return reply(`${JSON.stringify(scene)}${note}`);
      }
    )

    server.registerTool(
      "get_drawing_guide",
      {
        title: "Get the diagram design rules",
        description: "Call this BEFORE draw_diagram for a given mode. Returns FlowForge's design rules (sizes, colours, layout, labels) for that mode.",
        inputSchema: z.object({ mode: modeSchema }),
      },
      async ({ mode }) =>
        reply(
          `The rules below describe the diagram format. Do NOT print JSON in chat: pass the diagram as the "diagram" argument of the draw_diagram tool instead.\n\n${getSystemPrompt(mode)}`,
        ),
    );

    server.registerTool(
      "draw_diagram",
      {
        title: "Draw a diagram on a board",
        description:
          "Adds a diagram to the board. Call open_board or create_board first for the boardId, and get_drawing_guide for the mode's rules. Pass agentName (your product name). The diagram is drawn and saved right away (\"Drew\"); anyone with the board open watches it appear live with your named cursor.",
        inputSchema: z.object({
          boardId: z.string().min(1).describe("boardId from open_board or create_board"),
          mode: modeSchema,
          diagram: diagramInputSchema,
          agentName: agentNameSchema,
        }),
      },
      async ({ boardId, mode, diagram, agentName }, ctx) => {
        const email = getEmail(ctx.http?.authInfo);
        if (!email) return reply("Unauthorized", true);

        const board = await getOwnedBoard(email, boardId, await getOrgIds(ctx.http?.authInfo));
        if (!board) return reply("Board not found. Call open_board or create_board first.", true);

        const parsed = diagramSchema.safeParse(diagram);
        if (!parsed.success) return reply("The diagram is not valid. Check the field types and try again.", true);

        // Unknown edge targets are the most common model mistake; naming them lets the AI fix and retry.
        const ids = new Set(parsed.data.nodes.map((node) => node.id));
        const unknown = parsed.data.edges.filter((edge) => !ids.has(edge.from) || !ids.has(edge.to));
        if (unknown.length > 0) {
          return reply(
            `These edges point at ids that are not in nodes: ${unknown.map((edge) => `${edge.from}->${edge.to}`).join(", ")}. Fix them and call again.`,
            true,
          );
        }

        const status = await submitToBoard(boardId, {
          id: crypto.randomUUID(),
          mode,
          spec: parsed.data,
          createdAt: new Date().toISOString(),
        }, resolveAgentName(getClientName(), agentName));

        const summary = `"${parsed.data.title}" (${parsed.data.nodes.length} nodes)`;
        return reply(
          status === "drawn"
            ? `Drew ${summary} on the board; it is saved. The user can open ${APP_URL}/workspace/${boardId}${board.isPublished ? " (it is also on the public link)" : ""}.`
            : `Queued ${summary}. A browser tab with the board open draws it within seconds; otherwise it is drawn the next time the board is opened (${APP_URL}/workspace/${boardId}). It is NOT on the public link until then.`,
        );

      },
    );

    server.registerTool(
      "publish_board",
      {
        title: "Publish a board",
        description:
          "Makes the board viewable by ANYONE who has the public link (read-only). ONLY call this when the user has explicitly asked to publish. Safe to repeat: an already published board keeps the same link.",
        inputSchema: z.object({ boardId: z.string().min(1).describe("boardId from open_board or create_board") }),
        annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
      },
      async ({ boardId }, ctx) => {
        const email = getEmail(ctx.http?.authInfo);
        if (!email) return reply("Unauthorized", true);

        const board = await setBoardPublished(email, boardId, true);
        if (!board) return reply("Board not found. Call open_board or create_board first.", true);

        // Queued diagrams only reach the saved board once the browser draws them, so the public page would miss them.
        const pending = await countPendingDiagrams(boardId);
        const warning =
          pending > 0
            ? `\n\nWarning: ${pending} queued diagram(s) are not drawn yet and will NOT show on the public page until the user opens ${APP_URL}/workspace/${boardId}.`
            : "";

        return reply(`${describeBoard(board)}${warning}`);
      },
    );

    server.registerTool(
      "unpublish_board",
      {
        title: "Unpublish a board",
        description:
          "Takes the public link down so only the owner can see the board again. The board and its content are kept. Safe to repeat.",
        inputSchema: z.object({ boardId: z.string().min(1).describe("boardId from open_board or create_board") }),
        annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
      },
      async ({ boardId }, ctx) => {
        const email = getEmail(ctx.http?.authInfo);
        if (!email) return reply("Unauthorized", true);

        const board = await setBoardPublished(email, boardId, false);
        if (!board) return reply("Board not found. Call open_board or create_board first.", true);

        return reply(describeBoard(board));
      },
    );

    server.registerTool(
      "edit_board",
      {
        title: "Edit shapes already on a board",
        description:
          "Changes shapes drawn by FlowForge without redrawing the diagram: update_text, set_color or delete. Call get_board_scene first and use the diagramId and nodeId it returns; shapes with null ids cannot be edited. Edits are applied and saved right away when the board is not open in a browser, otherwise queued for the open tab. Errors when none of the shapes is found.",
        inputSchema: z.object({
          boardId: z.string().min(1).describe("boardId from open_board or create_board"),
          ops: z.array(editOpSchema).min(1).max(50),
          agentName: agentNameSchema,
        }),
      },
      async ({ boardId, ops, agentName }, ctx) => {
        const email = getEmail(ctx.http?.authInfo);
        if (!email) return reply("Unauthorized", true);

        const board = await getOwnedBoard(email, boardId, await getOrgIds(ctx.http?.authInfo));
        if (!board) return reply("Board not found. Call open_board or create_board first.", true);

        const status = await submitToBoard(boardId, {
          id: crypto.randomUUID(),
          kind: "edit",
          ops,
          createdAt: new Date().toISOString(),
        }, resolveAgentName(getClientName(), agentName));

        if (status === "no-match") {
          return reply("None of these shapes were found on the saved board. Call get_board_scene again for the current diagramId / nodeId values.", true);
        }
        return reply(
          status === "drawn"
            ? `Applied ${ops.length} edit(s); the board is saved.`
            : `Queued ${ops.length} edit(s). An open browser tab applies them within seconds; otherwise they apply the next time the board is opened (${APP_URL}/workspace/${boardId}).`,
        );

      }
    );

    server.registerTool(
      "get_diagram",
      {
        title: "Read one diagram of a board as a spec",
        description: "Returns one diagram saved on the board the same format draw_diagram takes (nodes with ids, labels, shapes and colours; edges with labels), plus its mode and whether it can be revised. Call get_board_scene first for the diagramId. mode is null for diagrams drawn before FlowForge stored it. Diagrams that are only queued (not yet drawn by an open browser tab) are not included.",
        inputSchema: z.object({
          boardId: z.string().min(1).describe("boardId from open_board or create_board"),
          diagramId: z.string().min(1).describe("diagramId from get_board_scene"),
        }),
        annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false }
      },
      async ({ boardId, diagramId }, ctx) => {
        const email = getEmail(ctx.http?.authInfo);
        if (!email) return reply("Unauthorized", true);

        const board = await getOwnedBoard(email, boardId, await getOrgIds(ctx.http?.authInfo));
        if (!board) return reply("Board not found. Call open_board or create_board first.", true);

        const diagram = await getBoardDiagram(boardId, diagramId);
        if (!diagram) {
          return reply(
            "Diagram not found on the saved board. Call get_board_scene for the current diagramIds (diagrams still queued are not saved yet).",
            true,
          );
        }

        return reply(JSON.stringify(diagram));
      }
    );

    server.registerTool(
      "revise_diagram",
      {
        title: "Refraw a diagram with changes",
        description:
          "Changes the STRUCTURE of a diagram already on the board: add, remove or reorder steps or components, add branches, add detail. Call get_board_scene for the diagramId, then get_diagram, change the spec it returns and pass the COMPLETE updated spec as `diagram` (all nodes and edges, not a patch). Keep the ids, labels and colours of nodes you don't change; give new nodes new unique ids; connect new nodes with edges. Positions are recomputed automatically, so x and y can be 0. Not available for web/mobile mockups (draw a new diagram instead). For only renaming, recolouring or deleting shapes use edit_board. The old diagram is replaced in the same place right away when the board is not open in a browser, otherwise when the open tab applies the queued change, and the diagram gets a new diagramId (call get_board_scene again before further changes).",
        inputSchema: z.object({
          boardId: z.string().min(1).describe("boardId from open_board or create_board"),
          diagramId: z.string().min(1).describe("diagramId from get_board_scene"),
          diagram: diagramInputSchema,
          agentName: agentNameSchema,
        }),
      },
      async ({ boardId, diagramId, diagram, agentName }, ctx) => {
        const email = getEmail(ctx.http?.authInfo);
        if (!email) return reply("Unauthorized", true);

        const board = await getOwnedBoard(email, boardId, await getOrgIds(ctx.http?.authInfo));
        if (!board) return reply("Board not found. Call open_board or create_board first.", true);

        // The target must be saved on the board; the server (not the AI) decides the mode and whether it can be redrawn.
        const current = await getBoardDiagram(boardId, diagramId);
        if (!current) {
          return reply(
            "Diagram not found on the saved board. Call get_board_scene for the current diagramIds (diagrams still queued are not saved yet).",
            true,
          );
        }
        if (!current.revisable) {
          return reply("Web and mobile mockups can't be revised. Draw a new mockup with draw_diagram instead.", true);
        }

        const parsed = diagramSchema.safeParse(diagram);
        if (!parsed.success) return reply("The diagram is not valid. Check the field types and try again.", true);

        // Unknown edge targets are the most common model mistake; naming them lets the AI fix and retry.
        const ids = new Set(parsed.data.nodes.map((node) => node.id));
        const unknown = parsed.data.edges.filter((edge) => !ids.has(edge.from) || !ids.has(edge.to));
        if (unknown.length > 0) {
          return reply(
            `These edges point at ids that are not in nodes: ${unknown.map((edge) => `${edge.from}->${edge.to}`).join(", ")}. Fix them and call again.`,
            true,
          );
        };

        const status = await submitToBoard(boardId, {
          id: crypto.randomUUID(),
          kind: "revise",
          diagramId,
          // Diagrams drawn before the mode was stored are laid out top-down, like a flowchart.
          mode: current.mode ?? "flowchart",
          spec: parsed.data,
          createdAt: new Date().toISOString(),
        }, resolveAgentName(getClientName(), agentName));

        if (status === "no-match") {
          return reply("Diagram not found on the saved board. Call get_board_scene for the current diagramIds.", true);
        }
        const summary = `"${parsed.data.title}" (${parsed.data.nodes.length} nodes)`;
        return reply(
          status === "drawn"
            ? `Redrew ${summary} in place and saved it. The diagram has a new diagramId: call get_board_scene before further changes.`
            : `Queued the updated ${summary}. It replaces the old diagram when the board is open in the browser (${APP_URL}/workspace/${boardId}).`,
        );

      }
    )

  },
  { serverInfo: { name: "flowforge", version: "0.1.0" } },
);

// Verifies Clerk's OAuth access token, then looks up the user's email (boards are keyed by email).
// Returning undefined makes the handler answer 401 with a pointer to the OAuth metadata, which starts the login flow.
const verifyToken = async (_req: Request, bearerToken?: string): Promise<AuthInfo | undefined> => {
  if (!bearerToken) return undefined;

  const clerkAuth = await auth({ acceptsToken: "oauth_token" });
  const verified = verifyClerkToken(clerkAuth, bearerToken);
  const userId = verified?.extra?.userId;
  if (!verified || typeof userId !== "string") return undefined;

  // Read from Clerk directly: the users table is only filled by a webhook, which can't reach localhost.
  const client = await clerkClient();
  const email = (await client.users.getUser(userId)).primaryEmailAddress?.emailAddress;
  if (!email) return undefined;

  return { token: bearerToken, clientId: verified.clientId, scopes: verified.scopes, extra: { email, userId } };
};

const authHandler = withMcpAuth(handler, verifyToken, {
  required: true,
  resourceMetadataPath: "/.well-known/oauth-protected-resource/api/mcp",
});

// mcp-handler returns one request handler, so it is re-exported (instead of declared) for both verbs.
export { authHandler as GET, authHandler as POST };



