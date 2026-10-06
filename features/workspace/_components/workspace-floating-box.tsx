import { useRef, useState } from "react";
import type { ExcalidrawElement } from "@excalidraw/excalidraw/element/types";
import type { AppState } from "@excalidraw/excalidraw/types";
import {
  AlignCenterIcon,
  AlignLeftIcon,
  AlignRightIcon,
  ArrowDownToLineIcon,
  ArrowRightIcon,
  ArrowUpToLineIcon,
  CircleIcon,
  CopyIcon,
  DiamondIcon,
  DropletIcon,
  EllipsisIcon,
  GripVerticalIcon,
  LockIcon,
  MinusIcon,
  PaletteIcon,
  PencilIcon,
  SquareIcon,
  Trash2Icon,
  TypeIcon,
  XIcon,
} from "lucide-react";

import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

export type TextAlign = "left" | "center" | "right";

// Subset of element fields the floating box can change.
export type ElementPatch = Partial<
  Pick<
    ExcalidrawElement,
    "type" | "strokeColor" | "backgroundColor" | "strokeWidth" | "strokeStyle" | "opacity" | "width" | "height"
  > & { fontSize: number; fontFamily: number; textAlign: TextAlign; endArrowhead: string | null; startArrowhead: string | null; roundness: { type: number } | null }
>;

interface Props {
  selectedElement: ExcalidrawElement | null;
  canvasState: Pick<AppState, "scrollX" | "scrollY" | "zoom"> | null;
  onChange: (patch: ElementPatch) => void;
  onDuplicate: () => void;
  onToggleLock: () => void;
  onDelete: () => void;
  onBringFront: () => void;
  onSendBack: () => void;
}

// Shapes that can be switched between each other from the bar.
const SHAPE_OPTIONS = [
  { type: "rectangle", label: "Rectangle", icon: SquareIcon },
  { type: "diamond", label: "Diamond", icon: DiamondIcon },
  { type: "ellipse", label: "Ellipse", icon: CircleIcon },
] as const;

// Icon shown in the bar's first slot for each editable element type (images aren't editable here).
const TYPE_ICONS = {
  rectangle: SquareIcon,
  diamond: DiamondIcon,
  ellipse: CircleIcon,
  arrow: ArrowRightIcon,
  line: MinusIcon,
  freedraw: PencilIcon,
  text: TypeIcon,
} as const;

// Excalidraw font ids behind the "Hand / Normal / Mono" choices.
const FONT_FAMILY_OPTIONS = [
  { label: "Hand", value: 5 },
  { label: "Normal", value: 6 },
  { label: "Mono", value: 3 },
];
const FONT_SIZE_OPTIONS = [12, 16, 20, 24, 28, 36, 48];
const ALIGN_OPTIONS = [
  { value: "left", label: "Align left", icon: AlignLeftIcon },
  { value: "center", label: "Align center", icon: AlignCenterIcon },
  { value: "right", label: "Align right", icon: AlignRightIcon },
] as const;
const TEXT_COLORS = ["#1e1e1e", "#e03131", "#f08c00", "#2f9e44", "#1971c2", "#7048e8"];

const ARROWHEAD_OPTIONS = [
  { label: "None", value: "none" },
  { label: "Arrow", value: "arrow" },
  { label: "Triangle", value: "triangle" },
  { label: "Circle", value: "circle" },
  { label: "Bar", value: "bar" },
];
// Excalidraw roundness type 3 = adaptive radius (rounded corners); null = sharp.
const EDGE_OPTIONS = [
  { label: "Sharp", value: "sharp" },
  { label: "Round", value: "round" },
];

// Same palettes as Excalidraw's own property panel (stored colors; Excalidraw inverts them in dark mode).
const STROKE_COLORS = ["#1e1e1e", "#e03131", "#2f9e44", "#1971c2", "#f08c00"];
const BACKGROUND_COLORS = ["transparent", "#ffc9c9", "#b2f2bb", "#a5d8ff", "#ffec99"];
const STROKE_WIDTHS = [1, 2, 4];
const STROKE_STYLES = ["solid", "dashed", "dotted"] as const;

// Approximate bar height/gap, used to flip the bar below the element when there's no room above.
const BOX_HEIGHT = 48;
const BOX_GAP = 12;

/**
 * @component ColorRow
 * @description Row of color swatches; the swatch matching `value` is ringed.
 */
const ColorRow = ({
  label,
  colors,
  value,
  onSelect,
}: {
  label: string;
  colors: string[];
  value: string;
  onSelect: (color: string) => void;
}) => (
  <div className="flex items-center gap-1" role="group" aria-label={label}>
    {colors.map((color) => (
      <button
        key={color}
        type="button"
        aria-label={`${label} ${color}`}
        aria-pressed={value === color}
        onClick={() => onSelect(color)}
        className={cn(
          "size-6 rounded-md border transition hover:scale-110",
          value === color && "ring-2 ring-primary ring-offset-1",
          color === "transparent" &&
            "bg-[linear-gradient(45deg,transparent_45%,#e03131_45%,#e03131_55%,transparent_55%)]",
        )}
        style={color === "transparent" ? undefined : { backgroundColor: color }}
      />
    ))}
  </div>
);

/**
 * @component OptionGroup
 * @description Row of small text buttons for picking one of several discrete values.
 */
const OptionGroup = <T extends string | number>({
  label,
  options,
  value,
  onSelect,
}: {
  label: string;
  options: { label: string; value: T }[];
  value: T | undefined;
  onSelect: (value: T) => void;
}) => (
  <div className="flex items-center gap-0.5 rounded-lg bg-muted p-0.5" role="group" aria-label={label}>
    {options.map((option) => (
      <button
        key={option.label}
        type="button"
        aria-pressed={value === option.value}
        onClick={() => onSelect(option.value)}
        className={cn(
          "h-6 min-w-6 rounded-md px-1.5 text-xs transition hover:bg-primary/20",
          value === option.value && "bg-primary/20 font-medium",
        )}
      >
        {option.label}
      </button>
    ))}
  </div>
);

// Thin vertical separator between button groups.
const Divider = () => <div className="h-6 border-l" />;

// Square icon button used for every action in the bar.
const BarButton = ({
  label,
  active,
  className,
  children,
  ...props
}: React.ComponentProps<"button"> & { label: string; active?: boolean }) => (
  <button
    type="button"
    aria-label={label}
    title={label}
    className={cn(
      "flex size-8 items-center justify-center rounded-lg transition hover:bg-primary/20",
      active && "bg-primary/20",
      className,
    )}
    {...props}
  >
    {children}
  </button>
);

// Titled block inside the options panel, separated from the previous one by a top border.
const Section = ({ title, children }: { title?: string; children: React.ReactNode }) => (
  <div className="flex flex-col gap-2 border-t px-4 py-3">
    {title && <span className="text-xs text-muted-foreground">{title}</span>}
    {children}
  </div>
);

/**
 * @component FloatingBox
 * @description Compact floating action bar shown above the single selected element: shape switcher, color/stroke,
 * opacity, duplicate, lock, delete and a "more" menu with type-specific options (font size, arrowhead, stroke style).
 * @param selectedElement The one selected element, or null (renders nothing).
 * @param canvasState Scroll/zoom, used to convert the element's scene position to canvas pixels.
 * @param onChange Called with the fields to change on the selected element.
 * @param onDuplicate Clones the selected element.
 * @param onToggleLock Locks the selected element (Excalidraw then deselects it).
 * @param onDelete Removes the selected element.
 */
export const FloatingBox = ({
  selectedElement,
  canvasState,
  onChange,
  onDuplicate,
  onToggleLock,
  onDelete,
  onBringFront,
  onSendBack,
}: Props) => {
  // Controls the "more" panel so its close button can dismiss it.
  const [moreOpen, setMoreOpen] = useState(false);
  // User drag offset from the auto position; reset whenever a different element is selected.
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [offsetFor, setOffsetFor] = useState<string | null>(null);
  // Pointer position and offset at drag start; null when not dragging.
  const dragStart = useRef<{ px: number; py: number; ox: number; oy: number } | null>(null);

  if (offsetFor !== (selectedElement?.id ?? null)) {
    setOffsetFor(selectedElement?.id ?? null);
    setOffset({ x: 0, y: 0 });
  }

  if (!selectedElement || !canvasState) return null;

  const { type } = selectedElement;
  if (!(type in TYPE_ICONS)) return null;

  const isText = type === "text";
  const isShape = ["rectangle", "ellipse", "diamond"].includes(type);
  const isArrow = type === "arrow";
  const isFreeDraw = type === "freedraw";

  const CurrentIcon = TYPE_ICONS[type as keyof typeof TYPE_ICONS];

  // Scene -> canvas pixels; centered over the element, flipped below it when it's near the top edge.
  const zoom = canvasState.zoom.value;
  const left = (selectedElement.x + canvasState.scrollX) * zoom + (selectedElement.width * zoom) / 2;
  const top = (selectedElement.y + canvasState.scrollY) * zoom;
  const y =
    top - BOX_HEIGHT - BOX_GAP < 8 ? top + selectedElement.height * zoom + BOX_GAP : top - BOX_HEIGHT - BOX_GAP;

  const fontSize = isText ? (selectedElement as ExcalidrawElement & { fontSize: number }).fontSize : undefined;
  const arrowProps = isArrow
    ? (selectedElement as ExcalidrawElement & { startArrowhead: string | null; endArrowhead: string | null })
    : null;
  const textProps = isText
    ? (selectedElement as ExcalidrawElement & { fontFamily: number; textAlign: TextAlign })
    : null;

  return (
    <div
      className="absolute z-50 flex -translate-x-1/2 items-center gap-1 rounded-2xl border bg-white p-1.5 shadow-xl dark:bg-accent"
      style={{ left: Math.max(left, 160) + offset.x, top: Math.max(y, 8) + offset.y }}
      // Keep clicks on the bar from reaching the canvas underneath (would deselect the element).
      onPointerDown={(e) => e.stopPropagation()}
    >
      {/* Drag handle: moves the bar (not the element) while the pointer is held. */}
      <div
        role="button"
        aria-label="Move toolbar"
        title="Drag to move"
        className="mx-0.5 cursor-grab touch-none rounded p-0.5 text-muted-foreground hover:bg-primary/20 active:cursor-grabbing"
        onPointerDown={(e) => {
          e.currentTarget.setPointerCapture(e.pointerId);
          dragStart.current = { px: e.clientX, py: e.clientY, ox: offset.x, oy: offset.y };
        }}
        onPointerMove={(e) => {
          if (!dragStart.current) return;
          setOffset({
            x: dragStart.current.ox + e.clientX - dragStart.current.px,
            y: dragStart.current.oy + e.clientY - dragStart.current.py,
          });
        }}
        onPointerUp={() => {
          dragStart.current = null;
        }}
        onDoubleClick={() => setOffset({ x: 0, y: 0 })}
      >
        <GripVerticalIcon size={14} aria-hidden />
      </div>

      {/* Shape: switcher for rectangle/diamond/ellipse, plain indicator for other types. */}
      {isShape ? (
        <Popover>
          <PopoverTrigger render={<BarButton label="Shape" active />}>
            <CurrentIcon size={16} />
          </PopoverTrigger>
          <PopoverContent className="w-auto flex-row gap-1 p-1.5" side="top">
            {SHAPE_OPTIONS.map(({ type: shape, label, icon: Icon }) => (
              <BarButton key={shape} label={label} active={type === shape} onClick={() => onChange({ type: shape })}>
                <Icon size={16} />
              </BarButton>
            ))}
          </PopoverContent>
        </Popover>
      ) : (
        <BarButton label={type} active tabIndex={-1}>
          <CurrentIcon size={16} />
        </BarButton>
      )}

      {/* Colors + stroke width: the palette icon underlines the current stroke color. */}
      <Popover>
        <PopoverTrigger render={<BarButton label="Colors and stroke" />}>
          <span className="flex flex-col items-center gap-0.5">
            <PaletteIcon size={16} />
            <span className="h-0.5 w-4 rounded" style={{ backgroundColor: selectedElement.strokeColor }} />
          </span>
        </PopoverTrigger>
        <PopoverContent className="w-auto gap-3 p-3" side="top">
          <ColorRow
            label="Stroke"
            colors={STROKE_COLORS}
            value={selectedElement.strokeColor}
            onSelect={(strokeColor) => onChange({ strokeColor })}
          />
          {isShape && (
            <ColorRow
              label="Background"
              colors={BACKGROUND_COLORS}
              value={selectedElement.backgroundColor}
              onSelect={(backgroundColor) => onChange({ backgroundColor })}
            />
          )}
          {!isText && (
            <OptionGroup
              label="Stroke width"
              options={STROKE_WIDTHS.map((w) => ({ label: `${w}`, value: w }))}
              value={selectedElement.strokeWidth}
              onSelect={(strokeWidth) => onChange({ strokeWidth })}
            />
          )}
        </PopoverContent>
      </Popover>

      {/* Text alignment: cycles left -> center -> right. */}
      {textProps && (
        <BarButton
          label="Text alignment"
          onClick={() => {
            const i = ALIGN_OPTIONS.findIndex((o) => o.value === textProps.textAlign);
            onChange({ textAlign: ALIGN_OPTIONS[(i + 1) % ALIGN_OPTIONS.length].value });
          }}
        >
          {(() => {
            const AlignIcon = ALIGN_OPTIONS.find((o) => o.value === textProps.textAlign)?.icon ?? AlignLeftIcon;
            return <AlignIcon size={16} />;
          })()}
        </BarButton>
      )}

      {/* Opacity */}
      <Popover>
        <PopoverTrigger render={<BarButton label="Opacity" />}>
          <DropletIcon size={16} />
        </PopoverTrigger>
        <PopoverContent className="w-auto flex-row items-center gap-2 p-3" side="top">
          <input
            type="range"
            aria-label="Opacity"
            min={10}
            max={100}
            step={10}
            value={selectedElement.opacity}
            onChange={(e) => onChange({ opacity: Number(e.target.value) })}
            className="w-28 accent-primary"
          />
          <span className="w-8 text-xs text-muted-foreground">{selectedElement.opacity}%</span>
        </PopoverContent>
      </Popover>

      <Divider />

      <BarButton label="Duplicate" onClick={onDuplicate}>
        <CopyIcon size={16} />
      </BarButton>
      <BarButton label="Lock" onClick={onToggleLock}>
        <LockIcon size={16} />
      </BarButton>
      <BarButton label="Delete" onClick={onDelete} className="text-destructive hover:bg-destructive/10">
        <Trash2Icon size={16} />
      </BarButton>

      {/* More: full options panel; its sections depend on the element type. */}
      <Popover open={moreOpen} onOpenChange={setMoreOpen}>
        <PopoverTrigger render={<BarButton label="More options" active={moreOpen} />}>
          <EllipsisIcon size={16} />
        </PopoverTrigger>
        <PopoverContent className="w-72 gap-0 rounded-2xl p-0" side="bottom" sideOffset={8}>
          <div className="flex items-center justify-between px-4 py-3">
            <h3 className="text-sm font-semibold capitalize">{isFreeDraw ? "Draw" : type} options</h3>
            <button
              type="button"
              aria-label="Close"
              onClick={() => setMoreOpen(false)}
              className="rounded-md p-1 text-muted-foreground hover:bg-muted"
            >
              <XIcon size={14} />
            </button>
          </div>

          {/* Layering: every element type. */}
          <div className="grid grid-cols-2 gap-2 border-t px-4 py-3">
            <button type="button" onClick={onBringFront} className="flex items-center justify-center gap-1.5 rounded-lg border px-2 py-1.5 text-xs hover:bg-muted">
              <ArrowUpToLineIcon size={14} /> Bring front
            </button>
            <button type="button" onClick={onSendBack} className="flex items-center justify-center gap-1.5 rounded-lg border px-2 py-1.5 text-xs hover:bg-muted">
              <ArrowDownToLineIcon size={14} /> Send back
            </button>
          </div>

          {/* Text-only: font, size, alignment. */}
          {textProps && (
            <>
              <Section title="Font">
                <div className="grid grid-cols-3 gap-2">
                  {FONT_FAMILY_OPTIONS.map((font) => (
                    <button
                      key={font.value}
                      type="button"
                      aria-pressed={textProps.fontFamily === font.value}
                      onClick={() => onChange({ fontFamily: font.value })}
                      className={cn(
                        "rounded-full border px-2 py-1 text-xs hover:bg-muted",
                        textProps.fontFamily === font.value && "border-primary bg-primary/10",
                      )}
                    >
                      {font.label}
                    </button>
                  ))}
                </div>
              </Section>

              <div className="grid grid-cols-2 gap-3 border-t px-4 py-3">
                <label className="flex flex-col gap-2 text-xs text-muted-foreground">
                  Size
                  <select
                    value={fontSize}
                    onChange={(e) => onChange({ fontSize: Number(e.target.value) })}
                    className="rounded-lg border bg-background px-2 py-1.5 text-sm text-foreground"
                  >
                    {/* Keep the current size selectable even when it is not one of the presets. */}
                    {[...new Set([...FONT_SIZE_OPTIONS, fontSize ?? 20])].sort((a, b) => a - b).map((size) => (
                      <option key={size} value={size}>
                        {size} px
                      </option>
                    ))}
                  </select>
                </label>
                <div className="flex flex-col gap-2 text-xs text-muted-foreground">
                  Alignment
                  <div className="flex gap-1">
                    {ALIGN_OPTIONS.map(({ value, label, icon: Icon }) => (
                      <BarButton
                        key={value}
                        label={label}
                        active={textProps.textAlign === value}
                        onClick={() => onChange({ textAlign: value })}
                        className="size-8 border"
                      >
                        <Icon size={14} />
                      </BarButton>
                    ))}
                  </div>
                </div>
              </div>
            </>
          )}

          {/* Shapes: fill + edges. */}
          {isShape && (
            <>
              <Section title="Background">
                <ColorRow
                  label="Background"
                  colors={BACKGROUND_COLORS}
                  value={selectedElement.backgroundColor}
                  onSelect={(backgroundColor) => onChange({ backgroundColor })}
                />
              </Section>
              {type !== "ellipse" && (
                <Section title="Edges">
                  <OptionGroup
                    label="Edges"
                    options={EDGE_OPTIONS}
                    value={(selectedElement as ExcalidrawElement).roundness ? "round" : "sharp"}
                    onSelect={(edge) => onChange({ roundness: edge === "round" ? { type: 3 } : null })}
                  />
                </Section>
              )}
            </>
          )}

          {/* Arrows: heads on each end. */}
          {arrowProps && (
            <>
              <Section title="Start arrowhead">
                <OptionGroup
                  label="Start arrowhead"
                  options={ARROWHEAD_OPTIONS}
                  value={arrowProps.startArrowhead ?? "none"}
                  onSelect={(head) => onChange({ startArrowhead: head === "none" ? null : head })}
                />
              </Section>
              <Section title="End arrowhead">
                <OptionGroup
                  label="End arrowhead"
                  options={ARROWHEAD_OPTIONS}
                  value={arrowProps.endArrowhead ?? "none"}
                  onSelect={(head) => onChange({ endArrowhead: head === "none" ? null : head })}
                />
              </Section>
            </>
          )}

          {/* Stroke: everything except text. */}
          {!isText && (
            <>
              <Section title="Stroke color">
                <ColorRow
                  label="Stroke"
                  colors={STROKE_COLORS}
                  value={selectedElement.strokeColor}
                  onSelect={(strokeColor) => onChange({ strokeColor })}
                />
              </Section>
              <Section title="Stroke width">
                <OptionGroup
                  label="Stroke width"
                  options={STROKE_WIDTHS.map((w) => ({ label: `${w}`, value: w }))}
                  value={selectedElement.strokeWidth}
                  onSelect={(strokeWidth) => onChange({ strokeWidth })}
                />
              </Section>
              {!isFreeDraw && (
                <Section title="Stroke style">
                  <OptionGroup
                    label="Stroke style"
                    options={STROKE_STYLES.map((st) => ({ label: st, value: st }))}
                    value={selectedElement.strokeStyle}
                    onSelect={(strokeStyle) => onChange({ strokeStyle })}
                  />
                </Section>
              )}
            </>
          )}

          {/* Text color */}
          {isText && (
            <Section title="Text color">
              <ColorRow
                label="Text color"
                colors={TEXT_COLORS}
                value={selectedElement.strokeColor}
                onSelect={(strokeColor) => onChange({ strokeColor })}
              />
            </Section>
          )}

          <Section>
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>Opacity</span>
              <span>{selectedElement.opacity}%</span>
            </div>
            <input
              type="range"
              aria-label="Opacity"
              min={10}
              max={100}
              step={10}
              value={selectedElement.opacity}
              onChange={(e) => onChange({ opacity: Number(e.target.value) })}
              className="accent-primary"
            />
          </Section>
        </PopoverContent>
      </Popover>
    </div>
  );
};
