import * as React from "react";
import { cn } from "@/index";

const STEPS = ["About", "Work", "Community", "WhatsApp", "Spotlight", "Directory", "Headshot", "Events", "Contact", "Guidelines", "Finish"];

/** The section number printed at the start of a `Section`'s index, e.g. 3 for "03 — Community connections". */
const stepOf = (el: Element | null) => Number.parseInt(el?.closest<HTMLElement>("[data-step]")?.dataset.step ?? "", 10) || null;

/**
 * Follows the section at about a third of the way down the screen, and the focused field for keyboard and screen-reader
 * users. It shows the printed section numbers, so step 07 is passed over while the headshot section is hidden.
 */
export function ApplicationProgress({ form, sectionsKey, errorCount, onShowErrors }: {
  form: React.RefObject<HTMLFormElement | null>;
  /** Changes when a section appears or leaves, so the new set is observed. */
  sectionsKey: string;
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
  }, [form, sectionsKey]);

  const label = `Step ${step} of ${STEPS.length}: ${STEPS[step - 1]}`;
  return (
    <div className="sticky top-16 z-30 -mx-5 -mt-5 mb-6 rounded-t-[6px] bg-sb-paper px-5 py-3 shadow-[inset_0_0_0_1px_rgb(31_31_28/0.15)] sm:-mx-12 sm:-mt-12 sm:px-12 lg:top-[88px]">
      <div className="flex min-h-6 items-center justify-between gap-3">
        <p aria-hidden className="twc-ticket__meta min-w-0 justify-start">
          <span className="whitespace-nowrap">Step {String(step).padStart(2, "0")} of {STEPS.length}</span>
          <span className="truncate">{STEPS[step - 1]}</span>
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
      <ol aria-label="Application sections" className="mt-2 grid grid-cols-11 gap-1">
        {STEPS.map((name, i) => (
          <li
            key={name}
            aria-current={i + 1 === step ? "step" : undefined}
            className={cn("h-1.5 rounded-[3px] transition-colors motion-reduce:transition-none", i < step ? "bg-sb-ink" : "bg-sb-ink/15")}
          >
            <span className="sr-only">{i + 1}. {name}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}
