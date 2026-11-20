import Image from "next/image";
import { cn } from "@/lib/utils";

/*
 * B&W satellite imagery. Files in /public/imagery are pre-graded
 * (grayscale, contrast curve, ink-matched blacks) by scripts/grade-imagery.mjs.
 * The CSS filter is a safety net so an ungraded file still reads on-system.
 */
export type Scene = "florida" | "fire" | "terrain";

export const SCENE_ALT: Record<Scene, string> = {
  florida: "Astronaut photograph of Cape Canaveral and the Indian River Lagoon, Florida",
  fire: "Landsat view of the Camp Fire smoke plume over the Sierra Nevada foothills",
  terrain: "Landsat view of folded ridges and salt glaciers in the Zagros Mountains",
};

export function Satellite({
  scene,
  className,
  imgClassName,
  priority,
  sizes = "50vw",
  position = "50% 50%",
  shade = 0,
}: {
  scene: Scene;
  className?: string;
  imgClassName?: string;
  priority?: boolean;
  sizes?: string;
  position?: string;
  /** 0–1: ink overlay strength, for text over imagery. */
  shade?: number;
}) {
  return (
    <div className={cn("absolute inset-0 overflow-hidden bg-ink-2", className)}>
      <Image
        src={`/imagery/${scene}.jpg`}
        alt={SCENE_ALT[scene]}
        fill
        priority={priority}
        sizes={sizes}
        className={cn("object-cover grayscale contrast-[1.08]", imgClassName)}
        style={{ objectPosition: position }}
      />
      {shade > 0 ? (
        <div aria-hidden className="absolute inset-0 bg-ink" style={{ opacity: shade }} />
      ) : null}
    </div>
  );
}
