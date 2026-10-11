import { getEditSystemPrompt, getEditUserPrompt } from "@/features/workspace/ai/prompts";
import { editOpsResultSchema } from "@/features/workspace/schema";
import type { EditDiagramRequest } from "@/features/workspace/types/types";
import { generateObjectWithFallback } from "@/lib/ai-model";

// Asks the model for edit operations that carry out `request.prompt` on the given shapes.
// Used by the chat route for its edit action.
export const generateEditOps = (request: EditDiagramRequest) =>
  generateObjectWithFallback({
    schema: editOpsResultSchema,
    system: getEditSystemPrompt(),
    prompt: getEditUserPrompt(request),
  });
