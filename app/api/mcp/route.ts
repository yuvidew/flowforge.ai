import type { AuthInfo } from "@modelcontextprotocol/server";
import { createMcpHandler, withMcpAuth } from "mcp-handler";
import { z } from "zod";

import { diagramSchema } from "@/features/workspace/ai/diagram-schema";
import { diagramInputSchema } from "@/features/workspace/ai/mcp-diagram-input";
import { getSystemPrompt } from "@/features/workspace/ai/prompts";
import { verifyClerkToken } from "@clerk/mcp-tools/next";
import { auth, clerkClient } from "@clerk/nextjs/server";

import {
  countPendingDiagrams,
  createBoardForUser,
  findBoardsByName,
  getBoardScene,
  getOwnedBoard,
  queueDiagram,
  setBoardPublished,
} from "@/lib/boards";


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

const handler = createMcpHandler(
  (server) => {
    server.registerTool(
      "open_board",
      {
        title: "Open an existing board",
        description:
          "Use when the user wants to work on an EXISTING FlowForge board. Finds it by exact name (case-insensitive) and returns its boardId and workspace URL. There is no way to list boards; the user must give the name.",
        inputSchema: z.object({ name: z.string().trim().min(1).max(50).describe("Exact board name given by the user") }),
      },
      async ({ name }, ctx) => {
        const email = getEmail(ctx.http?.authInfo);
        if (!email) return reply("Unauthorized", true);

        const matches = await findBoardsByName(email, name);

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
          "Use when the user wants a NEW board. Returns its boardId and workspace URL. Fails if a board with that name already exists; then use open_board instead.",
        inputSchema: z.object({ name: z.string().trim().min(1).max(50).describe("Name for the new board") }),
      },
      async ({ name }, ctx) => {
        const email = getEmail(ctx.http?.authInfo);
        if (!email) return reply("Unauthorized", true);

        if ((await findBoardsByName(email, name)).length > 0) {
          return reply(`A board named "${name}" already exists. Use open_board to work on it.`, true);
        }
        return reply(describeBoard(await createBoardForUser(email, name)));
      },
    );

    server.registerTool(
      "get_board_scene",
      {
        title: "Read what is on a board",
        description:
          "Returns the elements currently saved on the board (shapes with their text, arrows with the shapes they connect, positions, colours). Call open_board first for the boardId. Diagrams still queued and not yet drawn in the browser are NOT included.",
        inputSchema: z.object({ boardId: z.string().min(1).describe("boardId from open_board or create_board") }),
        annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
      },
      async ({ boardId }, ctx) => {
        const email = getEmail(ctx.http?.authInfo);
        if (!email) return reply("Unauthorized", true);

        const board = await getOwnedBoard(email, boardId);
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
          "Adds a diagram to the board. Call open_board or create_board first for the boardId, and get_drawing_guide for the mode's rules. The diagram is queued and drawn the next time the board is open in the browser.",
        inputSchema: z.object({
          boardId: z.string().min(1).describe("boardId from open_board or create_board"),
          mode: modeSchema,
          diagram: diagramInputSchema,
        }),
      },
      async ({ boardId, mode, diagram }, ctx) => {
        const email = getEmail(ctx.http?.authInfo);
        if (!email) return reply("Unauthorized", true);

        const board = await getOwnedBoard(email, boardId);
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

        await queueDiagram(boardId, {
          id: crypto.randomUUID(),
          mode,
          spec: parsed.data,
          createdAt: new Date().toISOString(),
        });

        return reply(
          `Queued "${parsed.data.title}" (${parsed.data.nodes.length} nodes). It is drawn when the board is open in the browser, so tell the user to open ${APP_URL}/workspace/${boardId}. It is NOT visible on the public link until then.`,
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

  return { token: bearerToken, clientId: verified.clientId, scopes: verified.scopes, extra: { email } };
};

const authHandler = withMcpAuth(handler, verifyToken, {
  required: true,
  resourceMetadataPath: "/.well-known/oauth-protected-resource/api/mcp",
});

// mcp-handler returns one request handler, so it is re-exported (instead of declared) for both verbs.
export { authHandler as GET, authHandler as POST };



