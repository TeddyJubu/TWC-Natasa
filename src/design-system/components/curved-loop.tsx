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

/**
 * CurvedLoop — text flows along a gentle wave like a marquee.
 * Adapted from React Bits "CurvedLoop": the marquee is drawn on an SVG path,
 * can be dragged when `interactive` is true, pauses off screen via an
 * IntersectionObserver, and freezes for reduced-motion preferences.
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
    if (!spacing || reducedRef.current) return;
    const svg = svgRef.current;
    if (!svg) return;
    let frame = 0;
    const step = () => {
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
    };
    // No frames run off screen: the observer (which reports once on observe) starts the loop
    // when the marquee is visible and cancels it when hidden.
    const observer = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting)) {
        if (!frame) frame = requestAnimationFrame(step);
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
