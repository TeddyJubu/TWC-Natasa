import { useEffect, useRef } from "react";

/**
 * ProximityText — letters swell and lift as the pointer approaches.
 * Inspired by React Bits "Variable Proximity", adapted for Gilda Display
 * (a single-weight serif) by animating scale instead of font weight.
 * Disabled for touch and reduced-motion preferences.
 */
export function ProximityText({ text, radius = 140, className }: { text: string; radius?: number; className?: string }) {
  const rootRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches || !window.matchMedia("(hover: hover)").matches) return;
    const letters = Array.from(root.querySelectorAll<HTMLSpanElement>("[data-letter]"));
    const area = (root.closest("article") as HTMLElement | null) ?? root;
    let frame = 0;
    let px = -9999;
    let py = -9999;

    const paint = () => {
      frame = 0;
      for (const el of letters) {
        const r = el.getBoundingClientRect();
        const d = Math.hypot(px - (r.left + r.width / 2), py - (r.top + r.height / 2));
        const f = Math.max(0, 1 - d / radius);
        el.style.transform = f > 0 ? `translateY(${-f * 0.12}em) scale(${1 + f * 0.28})` : "";
      }
    };
    const onMove = (e: PointerEvent) => {
      px = e.clientX;
      py = e.clientY;
      if (!frame) frame = requestAnimationFrame(paint);
    };
    const onLeave = () => {
      px = py = -9999;
      if (!frame) frame = requestAnimationFrame(paint);
    };
    area.addEventListener("pointermove", onMove, { passive: true });
    area.addEventListener("pointerleave", onLeave);
    return () => {
      area.removeEventListener("pointermove", onMove);
      area.removeEventListener("pointerleave", onLeave);
      cancelAnimationFrame(frame);
    };
  }, [radius]);

  const words = text.split(" ");
  return (
    <span ref={rootRef} className={className}>
      <span className="sr-only">{text}</span>
      <span aria-hidden>
        {words.map((word, wi) => (
          <span key={wi} className="inline-block whitespace-nowrap">
            {Array.from(word).map((ch, ci) => (
              <span key={ci} data-letter className="inline-block origin-bottom transition-transform duration-150 ease-out will-change-transform">
                {ch}
              </span>
            ))}
            {wi < words.length - 1 ? " " : null}
          </span>
        ))}
      </span>
    </span>
  );
}
