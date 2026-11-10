// A tiny starry glitter around a button when it's clicked (the app shell's buttons). Decorative: aria-hidden,
// pointer-events none, gone within 0.6 s, and skipped entirely under reduced motion. Positions are runtime numbers,
// set through the CSSOM (style.setProperty), which the CSP allows; the look lives in .twc-spark (src/app/twc.css).
import * as React from "react";

const TONES = ["sun", "blue", "ink"] as const;
const COUNT = 8;
/** A little longer than the .twc-spark animation (550 ms), so a star is removed once it has faded. */
export const SPARK_MS = 700;

/** Scatters COUNT little stars from `button`'s edge; each is removed after SPARK_MS (a timer, not animationend, which
 *  never fires when the animation doesn't run). */
export function burst(button: Element, doc: Document = document): void {
  const r = button.getBoundingClientRect();
  const cx = r.left + r.width / 2;
  const cy = r.top + r.height / 2;
  for (let i = 0; i < COUNT; i++) {
    const angle = (i / COUNT) * 2 * Math.PI + Math.random() * 0.5;
    const [dx, dy] = [Math.cos(angle), Math.sin(angle)];
    const star = doc.createElement("span");
    star.className = `twc-spark twc-spark--${TONES[i % TONES.length]}`;
    star.setAttribute("aria-hidden", "true");
    star.style.setProperty("left", `${cx + (dx * r.width) / 2}px`);
    star.style.setProperty("top", `${cy + (dy * r.height) / 2}px`);
    star.style.setProperty("--spark-size", `${4 + Math.round(Math.random() * 4)}px`);
    star.style.setProperty("--spark-x", `${dx * (8 + Math.random() * 10)}px`);
    star.style.setProperty("--spark-y", `${dy * (8 + Math.random() * 10)}px`);
    doc.body.append(star);
    setTimeout(() => star.remove(), SPARK_MS);
  }
}

/** Glitter on every enabled button clicked inside the page (one listener, delegated). */
export function useButtonSparkles(): void {
  React.useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
      const button = (e.target as Element | null)?.closest?.("button");
      if (button && !button.disabled) burst(button);
    };
    document.addEventListener("click", onClick);
    return () => document.removeEventListener("click", onClick);
  }, []);
}
