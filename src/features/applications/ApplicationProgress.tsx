import * as React from "react";
import { cn } from "@/index";

const STEPS = ["About", "Work", "Community", "Events", "Contact", "Guidelines", "Finish"];

/** The section number printed at the start of a `Section`'s index, e.g. 3 for "03 — Community connections". */
const stepOf = (el: Element | null) => Number.parseInt(el?.closest<HTMLElement>("[data-step]")?.dataset.step ?? "", 10) || null;

/**
 * Follows the section at about a third of the way down the screen, and the focused field for keyboard and screen-reader
 * users, by the printed section numbers.
 */
export function ApplicationProgress({ form, errorCount, onShowErrors }: {
  form: React.RefObject<HTMLFormElement | null>;
  errorCount: number;
  onShowErrors: () => void;
}) {
  const [step, setStep] = React.useState(1);

  React.useEffect(() => {
    const root = form.current;
    if (!root) return;
    const onFocus = (event: FocusEvent) => {
      const next = stepOf(event.target as Element);
      if (next) setStep(next);
    };
    root.addEventListener("focusin", onFocus);
    const observer = typeof IntersectionObserver === "undefined" ? null : new IntersectionObserver((entries) => {
      const next = stepOf(entries.find((entry) => entry.isIntersecting)?.target ?? null);
      if (next) setStep(next);
    }, { rootMargin: "-35% 0px -65% 0px" });
    root.querySelectorAll("[data-step]").forEach((section) => observer?.observe(section));
    return () => {
      root.removeEventListener("focusin", onFocus);
      observer?.disconnect();
    };
  }, [form]);

  const label = `Step ${step} of ${STEPS.length}: ${STEPS[step - 1]}`;
  return (
    <div className="twc-fprogress">
      <div className="flex min-h-6 items-center justify-between gap-3">
        <p aria-hidden className="twc-fmono flex min-w-0 gap-4">
          <span className="whitespace-nowrap">Step {String(step).padStart(2, "0")} of {STEPS.length}</span>
          <span className="truncate text-sb-muted">{STEPS[step - 1]}</span>
        </p>
        <span className="sr-only" aria-live="polite">{label}</span>
        {errorCount > 0 && (
          <a
            href="#application-errors"
            onClick={(event) => { event.preventDefault(); onShowErrors(); }}
            className="shrink-0 text-[13px] font-medium text-sb-danger underline underline-offset-2"
          >
            {errorCount} to fix
          </a>
        )}
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
