import { metadataCorsOptionsRequestHandler, protectedResourceHandlerClerk } from "@clerk/mcp-tools/next";

// Tells MCP clients that /api/mcp is protected and which Clerk server issues its tokens.
const handler = protectedResourceHandlerClerk({ scopes_supported: ["profile", "email"] });
const corsHandler = metadataCorsOptionsRequestHandler();

export { handler as GET, corsHandler as OPTIONS };
