import * as React from "react";
import { cn } from "@/index";
import { countRequired, type RequiredCount } from "./form-state";

const STEPS = ["About", "Work", "Community", "Events", "Contact", "Guidelines", "Finish"];

/** The section number printed at the start of a `Section`'s index, e.g. 3 for "03 — Community connections". */
const stepOf = (el: Element | null) => Number.parseInt(el?.closest<HTMLElement>("[data-step]")?.dataset.step ?? "", 10) || null;

/** "12 of 19 required answered": what is done, not where she has scrolled to. */
const countText = ({ answered, required }: RequiredCount) =>
  (answered === required ? `All ${required} required answered` : `${answered} of ${required} required answered`);

/**
 * Follows the section at about a third of the way down the screen, and the focused field for keyboard and screen-reader
 * users, by the printed section numbers; beside it, how many of the required answers are in.
 */
export function ApplicationProgress({ form, errorCount, onShowErrors }: {
  form: React.RefObject<HTMLFormElement | null>;
  errorCount: number;
  onShowErrors: () => void;
}) {
  const [step, setStep] = React.useState(1);
  // Null until the browser has the form, so the server's HTML matches.
  const [count, setCount] = React.useState<RequiredCount | null>(null);
  const recount = React.useCallback(() => {
    const root = form.current;
    if (!root) return;
    const next = countRequired(root);
    setCount((current) => (current?.answered === next.answered && current.required === next.required ? current : next));
  }, [form]);

  // After every render, a frame later: a restored draft, a prefill or a follow-up that just opened is in place by then.
  React.useEffect(() => {
    const frame = requestAnimationFrame(recount);
    return () => cancelAnimationFrame(frame);
  });

  React.useEffect(() => {
    const root = form.current;
    if (!root) return;
    const onFocus = (event: FocusEvent) => {
      const next = stepOf(event.target as Element);
      if (next) setStep(next);
    };
    root.addEventListener("focusin", onFocus);
    // Typing, ticking and choosing: each answer counts as it is given.
    root.addEventListener("input", recount);
    root.addEventListener("change", recount);
    const observer = typeof IntersectionObserver === "undefined" ? null : new IntersectionObserver((entries) => {
      const next = stepOf(entries.find((entry) => entry.isIntersecting)?.target ?? null);
      if (next) setStep(next);
    }, { rootMargin: "-35% 0px -65% 0px" });
    root.querySelectorAll("[data-step]").forEach((section) => observer?.observe(section));
    return () => {
      root.removeEventListener("focusin", onFocus);
      root.removeEventListener("input", recount);
      root.removeEventListener("change", recount);
      observer?.disconnect();
    };
  }, [form, recount]);

  const label = `Step ${step} of ${STEPS.length}: ${STEPS[step - 1]}`;
  return (
    <div className="twc-fprogress">
      <div className="flex min-h-6 flex-wrap items-center justify-between gap-x-4 gap-y-1">
        <p aria-hidden className="twc-fmono flex min-w-0 gap-4">
          <span className="whitespace-nowrap">Step {String(step).padStart(2, "0")} of {STEPS.length}</span>
          <span className="truncate text-sb-muted">{STEPS[step - 1]}</span>
        </p>
        <span className="sr-only" aria-live="polite">{label}</span>
        <div className="flex shrink-0 items-center gap-4">
          {/* Not a live region: read on the way past, never announced on every keystroke. */}
          {count && <p className="twc-fmono whitespace-nowrap">{countText(count)}</p>}
          {errorCount > 0 && (
            <a
              href="#application-errors"
              onClick={(event) => { event.preventDefault(); onShowErrors(); }}
              className="text-[13px] font-medium text-sb-danger underline underline-offset-2"
            >
              {errorCount} to fix
            </a>
          )}
        </div>
      </div>
      <ol aria-label="Application sections" className="mt-2 grid grid-cols-7 gap-1">
        {STEPS.map((name, i) => (
          <li
            key={name}
            aria-current={i + 1 === step ? "step" : undefined}
            className={cn("h-1.5 transition-colors motion-reduce:transition-none", i < step ? "bg-sb-ink" : "bg-sb-ink/15")}
          >
            <span className="sr-only">{i + 1}. {name}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}
