import { z } from "zod";

// Strict, self-describing twin of diagramSchema for the MCP tool: plain types plus per-field descriptions so the
// connected AI can build a valid diagram. draw_diagram still runs the result through diagramSchema for defaults.
export const diagramInputSchema = z.object({
  title: z.string().max(60).describe("Short diagram title, max 60 characters"),
  nodes: z
    .array(
      z.object({
        id: z.string().describe('Unique id within this diagram, e.g. "n1" or "s0_btn"'),
        label: z.string().describe('Text inside the shape; use "\\n" for line breaks. Empty only for frames/containers'),
        shape: z.enum(["rectangle", "ellipse", "diamond"]),
        x: z.number().optional().describe("Left edge in px. Use 0 for diagram, flowchart and architecture modes (layout is automatic)"),
        y: z.number().optional().describe("Top edge in px. Use 0 for diagram, flowchart and architecture modes (layout is automatic)"),
        width: z.number().positive().describe("Width in px, large enough for the label"),
        height: z.number().positive().describe("Height in px, large enough for the label"),
        fill: z.string().describe('Hex colour such as "#dbeafe", or "transparent"'),
        stroke: z.string().describe('Hex colour such as "#1d4ed8"'),
        strokeStyle: z.enum(["solid", "dashed"]).optional(),
        fontSize: z.number().positive().optional().describe("Defaults to 16"),
      }),
    )
    .min(1)
    .max(80),
  edges: z
    .array(
      z.object({
        from: z.string().describe("Id of an existing node"),
        to: z.string().describe("Id of an existing node"),
        label: z.string().optional().describe("Short text on the arrow"),
        style: z.enum(["solid", "dashed"]).optional(),
        arrowhead: z.enum(["arrow", "none"]).optional(),
      }),
    )
    .max(150)
    .describe("Connections between nodes; may be empty for single-page layouts"),
  texts: z
    .array(z.object({ text: z.string(), x: z.number(), y: z.number(), fontSize: z.number().positive().optional() }))
    .max(20)
    .optional()
    .describe("Optional free-floating text such as a legend"),
});
