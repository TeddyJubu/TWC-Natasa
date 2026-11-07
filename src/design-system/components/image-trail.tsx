import * as React from "react";
import { createPortal } from "react-dom";
import cosmos from "../assets/illustrations/trail-flower-cosmos.webp";
import buttercup from "../assets/illustrations/trail-flower-buttercup.webp";
import forgetMeNot from "../assets/illustrations/trail-flower-forgetmenot.webp";
import daisy from "../assets/illustrations/trail-flower-daisy.webp";
import lavender from "../assets/illustrations/trail-flower-lavender.webp";
import { cn } from "../lib/utils";

const flowerImages = [cosmos, buttercup, forgetMeNot, daisy, lavender];

/** Rendered pixel size of the bundled flowers (2x the `small` 3rem display size). */
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
  ({ images = flowerImages, size = "tiny", count = 24, className, ...props }, forwardedRef) => {
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
        const rotation = ((itemIndex * 47) % 42) - 21;
        const driftX = ((itemIndex * 29) % 18) - 9;
        const driftY = 10 + ((itemIndex * 17) % 16);
        const origin = `translate3d(${event.clientX}px, ${event.clientY}px, 0) translate(-50%, -50%)`;

        item.getAnimations().forEach((animation) => animation.cancel());
        item.animate([
          { opacity: 0, transform: `${origin} scale(0.35) rotate(${rotation - 8}deg)` },
          { opacity: 0.96, transform: `${origin} scale(1) rotate(${rotation}deg)`, offset: 0.22 },
          { opacity: 0.84, transform: `translate3d(${event.clientX + driftX}px, ${event.clientY - driftY}px, 0) translate(-50%, -50%) scale(0.92) rotate(${rotation + 4}deg)`, offset: 0.64 },
          { opacity: 0, transform: `translate3d(${event.clientX + driftX * 1.7}px, ${event.clientY - driftY * 2.2}px, 0) translate(-50%, -50%) scale(0.68) rotate(${rotation + 10}deg)` },
        ], {
          duration: 820,
          easing: "cubic-bezier(0.22, 1, 0.36, 1)",
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