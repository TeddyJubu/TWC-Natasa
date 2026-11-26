import * as React from "react";
import { createPortal } from "react-dom";
import { cn } from "../lib/utils";

// The four-point star, inline (img-src allows data:): mostly ink, every third one a constellation band colour
// (lime, purple, sky, butter, red; owner's request, 2026-11-27).
const star = (fill: string) =>
  `data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96 96"><path fill="${fill}" d="M48 4C52 30 66 44 92 48 66 52 52 66 48 92 44 66 30 52 4 48 30 44 44 30 48 4Z"/></svg>`)}`;
const INK = star("#151414");
const starImages = ["#63d873", "#a685e2", "#4fa6de", "#f8de6e", "#ec4a43"].flatMap((c) => [INK, INK, star(c)]);

/** Intrinsic pixel size of the bundled stars (2x the `small` 3rem display size). */
const TRAIL_IMAGE_SIZE = 96;
const FINE_POINTER_QUERY = "(hover: hover) and (pointer: fine)";
const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)";

function subscribeToPointerTraits(onChange: () => void) {
  if (typeof window.matchMedia !== "function") return () => {};
  const queries = [window.matchMedia(FINE_POINTER_QUERY), window.matchMedia(REDUCED_MOTION_QUERY)];
  queries.forEach((query) => query.addEventListener?.("change", onChange));
  return () => queries.forEach((query) => query.removeEventListener?.("change", onChange));
}

/** True only on the client, for a fine pointer that can hover and no reduced-motion preference. */
function canShowTrail() {
  if (typeof window.matchMedia !== "function") return false;
  return window.matchMedia(FINE_POINTER_QUERY).matches && !window.matchMedia(REDUCED_MOTION_QUERY).matches;
}

const serverSnapshot = () => false;

export interface ImageTrailProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Images cycled through as the pointer moves. */
  images?: readonly string[];
  /** Visual scale of each trail image. */
  size?: "tiny" | "small";
  /** Number of reusable trail images. */
  count?: number;
}

/**
 * A decorative React Bits-inspired cursor trail for fine pointers.
 * Renders nothing on the server, for touch and for reduced motion, so those never download the images.
 */
export const ImageTrail = React.forwardRef<HTMLDivElement, ImageTrailProps>(
  ({ images = starImages, size = "tiny", count = 24, className, ...props }, forwardedRef) => {
    const localRef = React.useRef<HTMLDivElement | null>(null);
    const itemRefs = React.useRef<Array<HTMLImageElement | null>>([]);
    const enabled = React.useSyncExternalStore(subscribeToPointerTraits, canShowTrail, serverSnapshot);

    const setRefs = React.useCallback((node: HTMLDivElement | null) => {
      localRef.current = node;
      if (typeof forwardedRef === "function") forwardedRef(node);
      else if (forwardedRef) forwardedRef.current = node;
    }, [forwardedRef]);

    React.useEffect(() => {
      if (!enabled || images.length === 0) return;

      let itemIndex = 0;
      let previousX = -100;
      let previousY = -100;
      let latestEvent: PointerEvent | null = null;
      let frame = 0;

      const paint = () => {
        frame = 0;
        const event = latestEvent;
        if (!event || event.pointerType === "touch") return;

        const distance = Math.hypot(event.clientX - previousX, event.clientY - previousY);
        if (distance < 11) return;

        const item = itemRefs.current[itemIndex % count];
        itemIndex += 1;
        if (!item) return;

        previousX = event.clientX;
        previousY = event.clientY;
        // Glitter: each star lands a little off the pointer at its own size, then flickers out as it turns.
        // The spread is derived from the index, not random, so the trail looks the same on every run.
        const rotation = (itemIndex * 47) % 90;
        const scale = 0.5 + ((itemIndex * 37) % 70) / 100;
        const x = event.clientX + ((itemIndex * 29) % 32) - 16;
        const y = event.clientY + ((itemIndex * 17) % 32) - 16;
        const at = (size: number, turn: number) =>
          `translate3d(${x}px, ${y}px, 0) translate(-50%, -50%) scale(${size}) rotate(${rotation + turn}deg)`;

        item.getAnimations().forEach((animation) => animation.cancel());
        item.animate([
          { opacity: 0, transform: at(0, -45) },
          { opacity: 1, transform: at(scale, 0), offset: 0.18 },
          { opacity: 0.3, transform: at(scale * 0.65, 20), offset: 0.42 },
          { opacity: 1, transform: at(scale * 0.95, 40), offset: 0.62 },
          { opacity: 0.25, transform: at(scale * 0.5, 60), offset: 0.82 },
          { opacity: 0, transform: at(0, 90) },
        ], {
          duration: 900,
          easing: "ease-out",
          fill: "both",
        });
      };

      const handlePointerMove = (event: PointerEvent) => {
        latestEvent = event;
        if (!frame) frame = window.requestAnimationFrame(paint);
      };

      window.addEventListener("pointermove", handlePointerMove, { passive: true });
      return () => {
        window.removeEventListener("pointermove", handlePointerMove);
        if (frame) window.cancelAnimationFrame(frame);
      };
    }, [enabled, count, images.length]);

    if (!enabled || images.length === 0 || count < 1) return null;

    // Portalled to <body>: a transformed ancestor (e.g. a route-in animation) would otherwise become the
    // containing block of this position:fixed layer. `enabled` is false on the server, so this is client-only.
    return createPortal(
      <div
        ref={setRefs}
        aria-hidden="true"
        className={cn("image-trail", className)}
        data-size={size}
        {...props}
      >
        {Array.from({ length: count }, (_, index) => (
          <img
            key={`${images[index % images.length]}-${index}`}
            ref={(node) => { itemRefs.current[index] = node; }}
            src={images[index % images.length]}
            alt=""
            width={TRAIL_IMAGE_SIZE}
            height={TRAIL_IMAGE_SIZE}
            draggable={false}
            className="image-trail-item"
          />
        ))}
      </div>,
      document.body,
    );
  },
);
ImageTrail.displayName = "ImageTrail";