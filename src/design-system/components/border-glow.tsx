import * as React from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import { cn } from "../lib/utils";

type GlowColor = { h: number; s: number; l: number };

function hexToHsl(hex: string): GlowColor {
  const value = hex.trim().replace("#", "");
  if (!/^[\da-f]{3}([\da-f]{3})?$/i.test(value)) return { h: 40, s: 80, l: 80 };
  const parts =
    value.length === 3
      ? value.split("").map((c) => c + c)
      : [value.slice(0, 2), value.slice(2, 4), value.slice(4, 6)];
  const [r, g, b] = parts.map((p) => parseInt(p, 16) / 255);
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  const d = max - min;
  const s = d === 0 ? 0 : d / (1 - Math.abs(2 * l - 1));
  let h = 0;
  if (d !== 0) {
    if (max === r) h = ((g - b) / d) % 6;
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h *= 60;
    if (h < 0) h += 360;
  }
  return { h, s: s * 100, l: l * 100 };
}

function buildBoxShadow(color: GlowColor, intensity: number): string {
  const base = `${color.h}deg ${color.s}% ${color.l}%`;
  const layers: [number, number, number, number, number, boolean][] = [
    [0, 0, 0, 1, 100, true], [0, 0, 1, 0, 60, true], [0, 0, 3, 0, 50, true],
    [0, 0, 6, 0, 40, true], [0, 0, 15, 0, 30, true], [0, 0, 25, 2, 20, true],
    [0, 0, 50, 2, 10, true],
    [0, 0, 1, 0, 60, false], [0, 0, 3, 0, 50, false], [0, 0, 6, 0, 40, false],
    [0, 0, 15, 0, 30, false], [0, 0, 25, 2, 20, false], [0, 0, 50, 2, 10, false],
  ];
  return layers
    .map(([x, y, blur, spread, alpha, inset]) => {
      const a = Math.min(alpha * intensity, 100);
      return `${inset ? "inset " : ""}${x}px ${y}px ${blur}px ${spread}px hsl(${base} / ${a}%)`;
    })
    .join(", ");
}

function easeOutCubic(x: number) {
  return 1 - Math.pow(1 - x, 3);
}
function easeInCubic(x: number) {
  return x * x * x;
}

function animateValue({
  start = 0,
  end = 100,
  duration = 1000,
  delay = 0,
  ease = easeOutCubic,
  onUpdate,
  onEnd,
}: {
  start?: number;
  end?: number;
  duration?: number;
  delay?: number;
  ease?: (t: number) => number;
  onUpdate: (v: number) => void;
  onEnd?: () => void;
}) {
  const t0 = performance.now() + delay;
  function tick() {
    const elapsed = performance.now() - t0;
    const t = Math.min(elapsed / duration, 1);
    onUpdate(start + (end - start) * ease(t));
    if (t < 1) requestAnimationFrame(tick);
    else onEnd?.();
  }
  setTimeout(() => requestAnimationFrame(tick), delay);
}

const GRADIENT_POSITIONS = ["80% 55%", "69% 34%", "8% 6%", "41% 38%", "86% 85%", "82% 18%", "51% 4%"];
const COLOR_MAP = [0, 1, 2, 0, 1, 2, 1];

function meshGradients(color: GlowColor): string[] {
  const tints = [88, 72, 50].map((l) => `hsl(${color.h} ${color.s}% ${l}%)`);
  const gradients: string[] = [];
  for (let i = 0; i < 7; i++) {
    const c = tints[Math.min(COLOR_MAP[i], tints.length - 1)];
    gradients.push(`radial-gradient(at ${GRADIENT_POSITIONS[i]}, ${c} 0px, transparent 50%)`);
  }
  gradients.push(`linear-gradient(${tints[0]} 0 100%)`);
  return gradients;
}

export interface BorderGlowProps extends React.HTMLAttributes<HTMLDivElement> {
  children?: React.ReactNode;
  /** CSS custom property that carries the glow color, e.g. a neighborhood token. */
  glowVar?: string;
  borderRadius?: number;
  glowRadius?: number;
  glowIntensity?: number;
  coneSpread?: number;
  edgeSensitivity?: number;
  fillOpacity?: number;
  animated?: boolean;
}

/**
 * BorderGlow — a mesh-gradient border glow that follows the cursor and
 * intensifies near the edges. Adapted from React Bits "BorderGlow" for the
 * light editorial cards: the glow color is read from a token CSS variable so
 * the effect always uses approved palette colors.
 */
export const BorderGlow = React.forwardRef<HTMLDivElement, BorderGlowProps>(function BorderGlow(
  {
    children,
    className,
    glowVar = "--color-sky",
    borderRadius = 32,
    glowRadius = 40,
    glowIntensity = 0.85,
    coneSpread = 25,
    edgeSensitivity = 30,
    fillOpacity = 0.3,
    animated = false,
    ...props
  },
  ref,
) {
  const cardRef = useRef<HTMLDivElement | null>(null);
  const [glow, setGlow] = useState<GlowColor>({ h: 40, s: 80, l: 80 });
  const [isHovered, setIsHovered] = useState(false);
  const [cursorAngle, setCursorAngle] = useState(45);
  const [edgeProximity, setEdgeProximity] = useState(0);
  const [sweepActive, setSweepActive] = useState(false);
  const reducedRef = useRef(false);

  useEffect(() => {
    reducedRef.current = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  }, []);

  const readGlow = useCallback(() => {
    const card = cardRef.current;
    if (!card) return;
    const styles = getComputedStyle(card);
    const raw = styles.getPropertyValue(glowVar).trim() || styles.getPropertyValue("--bl-sky").trim();
    if (raw) setGlow(hexToHsl(raw));
  }, [glowVar]);

  useEffect(() => {
    readGlow();
  }, [readGlow]);

  const getCenterOfElement = useCallback((el: HTMLElement) => {
    const { width, height } = el.getBoundingClientRect();
    return [width / 2, height / 2];
  }, []);

  const getEdgeProximity = useCallback(
    (el: HTMLElement, x: number, y: number) => {
      const [cx, cy] = getCenterOfElement(el);
      const dx = x - cx;
      const dy = y - cy;
      let kx = Infinity;
      let ky = Infinity;
      if (dx !== 0) kx = cx / Math.abs(dx);
      if (dy !== 0) ky = cy / Math.abs(dy);
      return Math.min(Math.max(1 / Math.min(kx, ky), 0), 1);
    },
    [getCenterOfElement],
  );

  const getCursorAngle = useCallback(
    (el: HTMLElement, x: number, y: number) => {
      const [cx, cy] = getCenterOfElement(el);
      const dx = x - cx;
      const dy = y - cy;
      if (dx === 0 && dy === 0) return 0;
      const radians = Math.atan2(dy, dx);
      let degrees = radians * (180 / Math.PI) + 90;
      if (degrees < 0) degrees += 360;
      return degrees;
    },
    [getCenterOfElement],
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      const card = cardRef.current;
      if (!card || reducedRef.current) return;
      const rect = card.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      setEdgeProximity(getEdgeProximity(card, x, y));
      setCursorAngle(getCursorAngle(card, x, y));
    },
    [getEdgeProximity, getCursorAngle],
  );

  useEffect(() => {
    if (!animated || reducedRef.current) return;
    const angleStart = 110;
    const angleEnd = 465;
    setSweepActive(true);
    setCursorAngle(angleStart);
    animateValue({ duration: 500, onUpdate: (v) => setEdgeProximity(v / 100) });
    animateValue({
      ease: easeInCubic,
      duration: 1500,
      end: 50,
      onUpdate: (v) => setCursorAngle((angleEnd - angleStart) * (v / 100) + angleStart),
    });
    animateValue({
      ease: easeOutCubic,
      delay: 1500,
      duration: 2250,
      start: 50,
      end: 100,
      onUpdate: (v) => setCursorAngle((angleEnd - angleStart) * (v / 100) + angleStart),
    });
    animateValue({
      ease: easeInCubic,
      delay: 2500,
      duration: 1500,
      start: 100,
      end: 0,
      onUpdate: (v) => setEdgeProximity(v / 100),
      onEnd: () => setSweepActive(false),
    });
  }, [animated]);

  const colorSensitivity = edgeSensitivity + 20;
  const isVisible = (isHovered || sweepActive) && !reducedRef.current;
  const borderOpacity = isVisible
    ? Math.max(0, (edgeProximity * 100 - colorSensitivity) / (100 - colorSensitivity))
    : 0;
  const glowOpacity = isVisible
    ? Math.max(0, (edgeProximity * 100 - edgeSensitivity) / (100 - edgeSensitivity))
    : 0;

  const gradients = meshGradients(glow);
  const borderBg = gradients.map((g) => `${g} border-box`);
  const fillBg = gradients.map((g) => `${g} padding-box`);
  const angleDeg = `${cursorAngle.toFixed(3)}deg`;
  const borderMask = `conic-gradient(from ${angleDeg} at center, black ${coneSpread}%, transparent ${coneSpread + 15}%, transparent ${100 - coneSpread - 15}%, black ${100 - coneSpread}%)`;
  const fillMask = [
    "linear-gradient(to bottom, black, black)",
    "radial-gradient(ellipse at 50% 50%, black 40%, transparent 65%)",
    "radial-gradient(ellipse at 66% 66%, black 5%, transparent 40%)",
    "radial-gradient(ellipse at 33% 33%, black 5%, transparent 40%)",
    "radial-gradient(ellipse at 66% 33%, black 5%, transparent 40%)",
    "radial-gradient(ellipse at 33% 66%, black 5%, transparent 40%)",
    `conic-gradient(from ${angleDeg} at center, transparent 5%, black 15%, black 85%, transparent 95%)`,
  ].join(", ");
  const fadeTransition = isVisible ? "opacity 0.25s ease-out" : "opacity 0.75s ease-in-out";

  return (
    <div
      ref={(node) => {
        cardRef.current = node;
        if (typeof ref === "function") ref(node);
        else if (ref) ref.current = node;
      }}
      onPointerMove={handlePointerMove}
      onPointerEnter={() => {
        readGlow();
        setIsHovered(true);
      }}
      onPointerLeave={() => setIsHovered(false)}
      className={cn("relative isolate", className)}
      style={{
        borderRadius: `${borderRadius}px`,
        transform: "translate3d(0, 0, 0.01px)",
      }}
      {...props}
    >
      {/* mesh gradient border */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 rounded-[inherit]"
        style={{
          border: "1px solid transparent",
          background: borderBg.join(", "),
          maskImage: borderMask,
          WebkitMaskImage: borderMask,
          opacity: borderOpacity,
          transition: fadeTransition,
        } as React.CSSProperties}
      />

      {/* mesh gradient fill near edges */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-[1] rounded-[inherit]"
        style={{
          border: "1px solid transparent",
          background: fillBg.join(", "),
          maskImage: fillMask,
          WebkitMaskImage: fillMask,
          maskComposite: "subtract, add, add, add, add, add",
          WebkitMaskComposite: "source-out, source-over, source-over, source-over, source-over, source-over",
          opacity: borderOpacity * fillOpacity,
          mixBlendMode: "normal",
          transition: fadeTransition,
        } as React.CSSProperties}
      />

      {/* outer glow */}
      <span
        aria-hidden
        className="pointer-events-none absolute z-[1] rounded-[inherit]"
        style={{
          inset: `${-glowRadius}px`,
          maskImage: `conic-gradient(from ${angleDeg} at center, black 2.5%, transparent 10%, transparent 90%, black 97.5%)`,
          WebkitMaskImage: `conic-gradient(from ${angleDeg} at center, black 2.5%, transparent 10%, transparent 90%, black 97.5%)`,
          opacity: glowOpacity,
          mixBlendMode: "plus-lighter",
          transition: fadeTransition,
        } as React.CSSProperties}
      >
        <span
          className="absolute rounded-[inherit]"
          style={{
            inset: `${glowRadius}px`,
            boxShadow: buildBoxShadow(glow, glowIntensity),
          }}
        />
      </span>

      <div className="relative z-[1]">{children}</div>
    </div>
  );
});
