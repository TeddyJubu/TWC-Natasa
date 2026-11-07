import * as React from "react";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import { cn } from "../lib/utils";

export interface CurvedLoopProps {
  marqueeText?: string;
  speed?: number;
  curveAmount?: number;
  path?: string;
  viewBox?: string;
  direction?: "left" | "right";
  interactive?: boolean;
  className?: string;
}

/** Auto-advance ends after this much on-screen running time (WCAG 2.2.2 Pause, Stop, Hide). */
const AUTO_STOP_MS = 5000;
/** Longest gap one frame may add, so a throttled or backgrounded tab's pause isn't counted. */
const MAX_FRAME_MS = 100;

/**
 * CurvedLoop — text flows along a gentle wave like a marquee.
 * Adapted from React Bits "CurvedLoop": the marquee is drawn on an SVG path,
 * can be dragged when `interactive` is true, pauses off screen via an
 * IntersectionObserver, and freezes for reduced-motion preferences.
 *
 * Auto-advance stops by itself after 5 seconds of on-screen running time and
 * rests where it is, never restarting automatically: WCAG 2.2.2 (Pause, Stop,
 * Hide) lets moving content that starts on its own run past 5 s only if users
 * can pause it, and this decorative, aria-hidden marquee has no pause control.
 * Time off screen does not count. Dragging (`interactive`) still works after
 * the stop, since user-initiated motion is exempt.
 */
export function CurvedLoop({
  marqueeText = "",
  speed = 1,
  curveAmount = 48,
  path,
  viewBox = "0 0 1440 120",
  direction = "left",
  interactive = false,
  className,
}: CurvedLoopProps) {
  const text = useMemo(() => {
    const hasTrailing = /\s|\u00A0$/.test(marqueeText);
    return ((hasTrailing ? marqueeText.replace(/\s+$/, "") : marqueeText) + "\u00A0").toUpperCase();
  }, [marqueeText]);

  const measureRef = useRef<SVGTextElement | null>(null);
  const textPathRef = useRef<SVGTextPathElement | null>(null);
  const svgRef = useRef<SVGSVGElement | null>(null);
  const [spacing, setSpacing] = useState(0);
  const [ready, setReady] = useState(false);
  const uid = useId();
  const pathId = `curve-${uid}`;
  const pathD = path ?? `M-100,40 Q500,${40 + curveAmount} 1540,40`;

  const dragRef = useRef(false);
  const lastXRef = useRef(0);
  const dirRef = useRef<"left" | "right">(direction);
  const velRef = useRef(0);
  const reducedRef = useRef(false);
  // On-screen running time (ms) and whether auto-advance has ended. Refs, so a re-measure
  // (new `spacing`) or a `speed` change re-runs the effect without resetting the budget.
  const runRef = useRef(0);
  const doneRef = useRef(false);

  const totalText = spacing
    ? Array(Math.ceil(1800 / spacing) + 2)
        .fill(text)
        .join("")
    : text;

  useEffect(() => {
    reducedRef.current = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  }, []);

  useEffect(() => {
    let active = true;
    const measure = () => {
      if (!active || !measureRef.current) return;
      const length = measureRef.current.getComputedTextLength();
      if (length > 0) {
        setSpacing(length);
        setReady(true);
      }
    };
    measure();
    // The first measurement may use a fallback font; measure again once web fonts have loaded.
    const fonts = typeof document === "undefined" ? undefined : (document as Document & { fonts?: FontFaceSet }).fonts;
    fonts?.ready?.then(measure).catch(() => {});
    return () => {
      active = false;
    };
  }, [text, className]);

  useEffect(() => {
    if (!spacing) return;
    textPathRef.current?.setAttribute("startOffset", `${-spacing}px`);
  }, [spacing]);

  useEffect(() => {
    if (!spacing || reducedRef.current || doneRef.current) return;
    const svg = svgRef.current;
    if (!svg) return;
    let frame = 0;
    // Timestamp of the previous frame in this visible stretch; reset whenever the loop
    // stops so off-screen gaps never count toward the auto-stop budget.
    let last: number | undefined;
    const step = (ts: number) => {
      if (last !== undefined) runRef.current += Math.min(ts - last, MAX_FRAME_MS);
      last = ts;
      if (runRef.current >= AUTO_STOP_MS) {
        // Rest where it is; the doneRef guards below keep anything from restarting auto-advance.
        doneRef.current = true;
        frame = 0;
        return;
      }
      if (!dragRef.current && textPathRef.current) {
        const delta = dirRef.current === "right" ? speed : -speed;
        const current = parseFloat(textPathRef.current.getAttribute("startOffset") || "0");
        let next = current + delta;
        if (next <= -spacing) next += spacing;
        if (next > 0) next -= spacing;
        textPathRef.current.setAttribute("startOffset", `${next}px`);
      }
      frame = requestAnimationFrame(step);
    };
    const stop = () => {
      if (frame) cancelAnimationFrame(frame);
      frame = 0;
      last = undefined;
    };
    // No frames run off screen: the observer (which reports once on observe) starts the loop
    // when the marquee is visible and cancels it when hidden.
    const observer = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting)) {
        if (!frame && !doneRef.current) frame = requestAnimationFrame(step);
      } else {
        stop();
      }
    });
    observer.observe(svg);
    return () => {
      observer.disconnect();
      stop();
    };
  }, [spacing, speed]);

  const onPointerDown = (e: React.PointerEvent) => {
    if (!interactive || reducedRef.current) return;
    dragRef.current = true;
    lastXRef.current = e.clientX;
    velRef.current = 0;
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (!interactive || !dragRef.current || !textPathRef.current) return;
    const dx = e.clientX - lastXRef.current;
    lastXRef.current = e.clientX;
    velRef.current = dx;
    const current = parseFloat(textPathRef.current.getAttribute("startOffset") || "0");
    let next = current + dx;
    if (next <= -spacing) next += spacing;
    if (next > 0) next -= spacing;
    textPathRef.current.setAttribute("startOffset", `${next}px`);
  };

  const endDrag = () => {
    if (!interactive) return;
    dragRef.current = false;
    if (velRef.current > 0) dirRef.current = "right";
    else if (velRef.current < 0) dirRef.current = "left";
  };

  return (
    <div
      className={cn("relative w-full select-none", interactive && "cursor-grab active:cursor-grabbing", className)}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={endDrag}
      onPointerLeave={endDrag}
    >
      <span className="sr-only">{marqueeText}</span>
      <svg
        ref={svgRef}
        viewBox={viewBox}
        aria-hidden
        className={cn("block w-full overflow-visible select-none font-medium text-[6rem] leading-none", !ready && "invisible")}
      >
        <text ref={measureRef} xmlSpace="preserve" aria-hidden className="invisible pointer-events-none">
          {text}
        </text>
        <defs>
          <path id={pathId} d={pathD} fill="none" stroke="transparent" />
        </defs>
        {ready && (
          <text xmlSpace="preserve" className="fill-current">
            <textPath ref={textPathRef} href={`#${pathId}`} startOffset="0px" xmlSpace="preserve">
              {totalText}
            </textPath>
          </text>
        )}
      </svg>
    </div>
  );
}
