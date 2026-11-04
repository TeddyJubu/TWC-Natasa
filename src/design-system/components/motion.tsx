import * as React from "react";
import { cn } from "../lib/utils";

export interface RevealProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Reveal once when the element enters the viewport. */
  once?: boolean;
  /** Adds a restrained editorial blur while entering. */
  blur?: boolean;
}

/** Use for meaningful blocks entering the viewport; never for essential content that must remain hidden without JavaScript. */
export const Reveal = React.forwardRef<HTMLDivElement, RevealProps>(({ className, once = true, blur = false, children, ...p }, forwardedRef) => {
  const localRef = React.useRef<HTMLDivElement | null>(null);
  const [visible, setVisible] = React.useState(false);
  React.useEffect(() => {
    const node = localRef.current;
    if (!node || window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setVisible(true);
      return;
    }
    const observer = new IntersectionObserver(([entry]) => {
      if (!entry) return;
      if (entry.isIntersecting) {
        setVisible(true);
        if (once) observer.unobserve(entry.target);
      } else if (!once) setVisible(false);
    }, { threshold: 0.12, rootMargin: "0px 0px -8%" });
    observer.observe(node);
    return () => observer.disconnect();
  }, [once]);
  const setRefs = React.useCallback((node: HTMLDivElement | null) => {
    localRef.current = node;
    if (typeof forwardedRef === "function") forwardedRef(node);
    else if (forwardedRef) forwardedRef.current = node;
  }, [forwardedRef]);
  return <div ref={setRefs} data-visible={visible} className={cn("motion-observed", blur && "motion-observed-blur", className)} {...p}>{children}</div>;
});
Reveal.displayName = "Reveal";

export type StaggerProps = React.HTMLAttributes<HTMLDivElement>;

/** Use for short groups whose children should enter in sequence. */
export const Stagger = React.forwardRef<HTMLDivElement, StaggerProps>(({ className, ...p }, ref) => (
  <div ref={ref} className={cn("motion-stagger", className)} {...p} />
));
Stagger.displayName = "Stagger";