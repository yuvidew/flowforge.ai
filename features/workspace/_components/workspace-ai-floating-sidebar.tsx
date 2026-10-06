"use client";

import { useEffect, useRef, useState } from "react";
import type { ExcalidrawImperativeAPI } from "@excalidraw/excalidraw/types";
import {
  ArrowUp,
  Monitor,
  Network,
  Shapes,
  Smartphone,
  Sparkles,
  WandSparkles,
  Workflow,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import {
  Popover,
  PopoverContent,
  PopoverDescription,
  PopoverTitle,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { useGenerateDiagram } from "../hook/use-generate-diagram";
import { diagramToElements } from "../ai/diagram-to-elements";
import { findEmptyOrigin, hideLoadingCard, insertDiagram, showLoadingCard, startLoadingPulse } from "../ai/scene";

// What the user can ask the AI to create; each mode shares one generation pipeline and only changes the prompt hints.
const MODES = [
  {
    id: "diagram",
    label: "Generate Diagram",
    hint: "Create visual diagrams",
    icon: Shapes,
    placeholder: "E.g. Draw how a user request moves through our frontend, API and database…",
    example: "Draw how a user request moves through the frontend, API gateway and database",
  },
  {
    id: "flowchart",
    label: "Flowchart",
    hint: "Visualize workflows",
    icon: Workflow,
    placeholder:
      "E.g. Create a customer onboarding flow with signup, email verification and subscription decision…",
    example: "Create a customer onboarding flow with signup, email verification and subscription decision",
  },
  {
    id: "architecture",
    label: "Architecture",
    hint: "Design system architecture",
    icon: Network,
    placeholder: "E.g. Design a microservices architecture for an e-commerce platform with a message queue…",
    example: "Design a microservices architecture for an e-commerce platform with a message queue",
  },
  {
    id: "web",
    label: "Web Mockup",
    hint: "Generate web wireframes",
    icon: Monitor,
    placeholder: "E.g. A SaaS landing page with a hero, pricing table and footer…",
    example: "A SaaS landing page with a hero section, feature grid, pricing table and footer",
  },
  {
    id: "mobile",
    label: "Mobile Mockup",
    hint: "Generate app wireframes",
    icon: Smartphone,
    placeholder: "E.g. A fitness tracking app with a home dashboard and workout details screen…",
    example: "A fitness tracking app with a home dashboard and a workout details screen",
  },
] as const;

type AiMode = (typeof MODES)[number]["id"];

/**
 * @component ModeCard
 * @description Selectable card for one creation mode in the AI Helper popover.
 */
const ModeCard = ({
  mode,
  selected,
  onSelect,
}: {
  mode: (typeof MODES)[number];
  selected: boolean;
  onSelect: () => void;
}) => {
  const Icon = mode.icon;

  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onSelect}
      className={cn(
        "relative flex items-center gap-2.5 rounded-xl border p-2.5 text-left transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
        selected ? "border-primary/60 bg-primary/5" : "border-border hover:bg-muted",
      )}
    >
      <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
        <Icon className="size-4" />
      </span>
      <span className="min-w-0">
        <span className="block truncate text-sm font-medium">{mode.label}</span>
        <span className="block truncate text-xs text-muted-foreground">{mode.hint}</span>
      </span>
      {selected && <span className="absolute right-2 top-2 size-1.5 rounded-full bg-primary" />}
    </button>
  );
};

/**
 * @component WorkspaceAiFloatingSidebar
 * @description Bottom-right AI button on the whiteboard that opens the "AI Helper" popover, where the user picks
 * what to create and describes it. The result is drawn in empty canvas space, with a loading card while it runs.
 * @param excalidrawApi Imperative API of the whiteboard canvas (null until Excalidraw has mounted).
 */
export const WorkspaceAiFloatingSidebar = ({
  excalidrawApi,
}: {
  excalidrawApi: ExcalidrawImperativeAPI | null;
}) => {
  // Controlled so the header close button can dismiss the popover.
  const [open, setOpen] = useState(false);
  const [modeId, setModeId] = useState<AiMode>("diagram");
  const [prompt, setPrompt] = useState("");
  const { mutate, isPending } = useGenerateDiagram();
  // Stops the loading-card pulse and removes the card; set while a generation is running, also used on unmount.
  const cleanupLoader = useRef<(() => void) | null>(null);
  // True from the click until the run finishes; covers the async setup before the mutation reports isPending.
  const busy = useRef(false);

  useEffect(() => {
    return () => cleanupLoader.current?.();
  }, []);

  const mode = MODES.find((item) => item.id === modeId) ?? MODES[0];

  // Shows the loading card in empty canvas space, asks the AI for a diagram, then swaps the card for the result.
  const handleGenerate = async () => {
    if (!excalidrawApi || busy.current) return;
    busy.current = true;
    const idea = prompt;

    const origin = await findEmptyOrigin(excalidrawApi);
    await showLoadingCard(excalidrawApi, origin);
    const stopPulse = await startLoadingPulse(excalidrawApi);
    cleanupLoader.current = () => {
      stopPulse();
      void hideLoadingCard(excalidrawApi);
      cleanupLoader.current = null;
      busy.current = false;
    };

    setOpen(false);
    setPrompt("");

    mutate(
      { mode: modeId, prompt: idea },
      {
        onSuccess: async (spec) => {
          // Cleared by unmount cleanup — nothing left to draw on.
          if (!cleanupLoader.current) return;
          try {
            const elements = await diagramToElements(spec, origin, modeId);
            cleanupLoader.current?.();
            await insertDiagram(excalidrawApi, elements);
          } catch {
            cleanupLoader.current?.();
          }
        },
        onError: () => cleanupLoader.current?.(),
      },
    );
  };

  return (
    // Pinned to the canvas' bottom-right corner.
    <div className="absolute right-15 bottom-10 z-50">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger render={<Button />}>
          <Sparkles /> AI
        </PopoverTrigger>
        <PopoverContent
          side="top"
          align="end"
          sideOffset={12}
          className="max-h-[80vh] w-104 gap-0 overflow-y-auto rounded-2xl p-0"
        >
          {/* Header */}
          <div className="flex items-start gap-3 bg-linear-to-b from-primary/10 to-transparent p-4">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground">
              <Sparkles className="size-5" />
            </span>
            <div className="min-w-0 flex-1">
              <PopoverTitle className="text-base">AI Helper</PopoverTitle>
              <PopoverDescription className="text-xs">Turn your ideas into visual content</PopoverDescription>
            </div>
            <Button variant="ghost" size="icon-xs" aria-label="Close" onClick={() => setOpen(false)}>
              <X />
            </Button>
          </div>

          {/* Mode picker */}
          <div className="border-t px-4 py-3">
            <p className="mb-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
              What do you want to create?
            </p>
            <div className="grid grid-cols-2 gap-2">
              {MODES.map((item) => (
                <ModeCard
                  key={item.id}
                  mode={item}
                  selected={item.id === modeId}
                  onSelect={() => setModeId(item.id)}
                />
              ))}
            </div>
          </div>

          {/* Prompt */}
          <div className="border-t px-4 py-3">
            <div className="mb-2 flex items-start justify-between gap-2">
              <div>
                <p className="text-sm font-medium">Describe your idea</p>
                <p className="text-xs text-muted-foreground">AI will generate it directly on your canvas</p>
              </div>
              <Button
                variant="ghost"
                size="icon-xs"
                aria-label="Use an example prompt"
                title="Use an example prompt"
                className="text-primary"
                disabled={isPending}
                onClick={() => setPrompt(mode.example)}
              >
                <WandSparkles />
              </Button>
            </div>

            <div className="rounded-xl border bg-muted/30 focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/50">
              <Textarea
                value={prompt}
                onChange={(event) => setPrompt(event.target.value)}
                placeholder={mode.placeholder}
                disabled={isPending}
                className="min-h-24 resize-none border-0 bg-transparent shadow-none focus-visible:ring-0 dark:bg-transparent"
              />
              <div className="flex items-center justify-between gap-2 border-t p-2">
                <span className="truncate rounded-full border bg-background px-2.5 py-1 text-xs font-medium">
                  {mode.label}
                </span>
                <Button onClick={handleGenerate} disabled={isPending || !excalidrawApi || !prompt.trim()}>
                  {isPending ? (
                    <>
                      <Spinner /> Generating…
                    </>
                  ) : (
                    <>
                      Generate <ArrowUp />
                    </>
                  )}
                </Button>
              </div>
            </div>
          </div>

          {/* Footnote */}
          <div className="flex items-center justify-between px-4 pb-3 text-xs text-muted-foreground">
            <span>AI generated content can be edited afterwards</span>
            <span className="flex items-center gap-1">
              <Sparkles className="size-3" /> AI
            </span>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
};
