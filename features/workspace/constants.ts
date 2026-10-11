import { Monitor, Network, Shapes, Smartphone, Workflow, type LucideIcon } from "lucide-react";
import type { AiModeId } from "./ai/prompts";

// The creation modes offered as icons in the chat composer; a picked mode is sent to the AI as a hint for new diagrams.
export const CHAT_MODES: {
  id: AiModeId;
  label: string;
  icon: LucideIcon;
  placeholder: string;
  example: string;
}[] = [
  {
    id: "diagram",
    label: "Diagram",
    icon: Shapes,
    placeholder: "E.g. Draw how a user request moves through our frontend, API and database…",
    example: "Draw how a user request moves through the frontend, API gateway and database",
  },
  {
    id: "flowchart",
    label: "Flowchart",
    icon: Workflow,
    placeholder: "E.g. Create a customer onboarding flow with signup, email verification and subscription decision…",
    example: "Create a customer onboarding flow with signup, email verification and subscription decision",
  },
  {
    id: "architecture",
    label: "Architecture",
    icon: Network,
    placeholder: "E.g. Design a microservices architecture for an e-commerce platform with a message queue…",
    example: "Design a microservices architecture for an e-commerce platform with a message queue",
  },
  {
    id: "web",
    label: "Web mockup",
    icon: Monitor,
    placeholder: "E.g. A SaaS landing page with a hero, pricing table and footer…",
    example: "A SaaS landing page with a hero section, feature grid, pricing table and footer",
  },
  {
    id: "mobile",
    label: "Mobile mockup",
    icon: Smartphone,
    placeholder: "E.g. A fitness tracking app with a home dashboard and workout details screen…",
    example: "A fitness tracking app with a home dashboard and a workout details screen",
  },
];

// Narrows a stored mode string (customData is free-form, so it may be anything) to a known mode id.
export const isAiModeId = (value: string | null | undefined): value is AiModeId =>
  CHAT_MODES.some((mode) => mode.id === value);

// Starter prompts shown in an empty chat while no mode is picked.
export const CHAT_SUGGESTIONS = [
  "Draw how a user request moves through the frontend, API and database",
  "Create a customer onboarding flowchart",
  "Make the selected shapes red",
];
