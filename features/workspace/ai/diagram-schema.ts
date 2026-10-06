import { z } from "zod";

// Validates the diagram JSON an LLM (the AI route) returns; mirrors the contract in prompts.ts.
// Deliberately forgiving: smaller models often omit fields or send null for optional ones, so those get defaults
// instead of failing the whole diagram. Only structurally unusable output (e.g. no nodes array) is rejected.
export const diagramSchema = z.object({
  title: z.string().default("Diagram"),
  nodes: z.array(
    z.object({
      id: z.coerce.string(),
      label: z.string().nullish().transform((value) => value ?? ""),
      shape: z.enum(["rectangle", "ellipse", "diamond"]).catch("rectangle"),
      x: z.number().catch(0),
      y: z.number().catch(0),
      width: z.number().positive().catch(180),
      height: z.number().positive().catch(70),
      fill: z.string().catch("#dbeafe"),
      stroke: z.string().catch("#1d4ed8"),
      strokeStyle: z.enum(["solid", "dashed"]).nullish().catch(undefined),
      fontSize: z.number().positive().nullish().catch(undefined),
    }),
  ),
  edges: z
    .array(
      z.object({
        from: z.coerce.string(),
        to: z.coerce.string(),
        label: z.string().nullish().catch(undefined),
        style: z.enum(["solid", "dashed"]).nullish().catch(undefined),
        arrowhead: z.enum(["arrow", "none"]).nullish().catch(undefined),
      }),
    )
    .catch([]),
  texts: z
    .array(
      z.object({
        text: z.string(),
        x: z.number().catch(0),
        y: z.number().catch(0),
        fontSize: z.number().positive().nullish().catch(undefined),
      }),
    )
    .nullish()
    .catch(undefined),
});

export type DiagramSpec = z.infer<typeof diagramSchema>;
