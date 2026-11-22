import * as React from "react";
import { Link } from "@tanstack/react-router";
import { cn } from "@/index";
import { redButton, ring, secondaryButton } from "@/app/layout/app-classes";
import { Icon } from "@/app/layout/icons";

const storageKey = (userId: string) => `twc-youre-in:v1:${userId}`;

/**
 * One-time welcome after approval: concrete next steps (portrait, polish the draft, turn on visibility).
 * Dismiss is per account in localStorage so a shared browser doesn't hide it for someone else.
 * Unnumbered on purpose — it sits above the account letters and must not steal their Nº 01.
 */
export function YoureIn({ userId }: { userId: string }) {
  const key = storageKey(userId);
  const headingId = React.useId();
  const [open, setOpen] = React.useState(() => {
    try {
      return localStorage.getItem(key) !== "1";
    } catch {
      return true;
    }
  });

  if (!open) return null;

  function dismiss() {
    try {
      localStorage.setItem(key, "1");
    } catch {
      /* private mode: still hide for this visit */
    }
    setOpen(false);
  }

  return (
    <section
      id="youre-in"
      aria-labelledby={headingId}
      className="air-card mb-6 [counter-increment:none]"
    >
      <header className="air-ch">
        <div className="min-w-0">
          <h2 id={headingId}>You’re in</h2>
          <p className="air-sub">Welcome to The Women’s Collective. Your card is a private draft until you choose to show it.</p>
        </div>
        <button type="button" onClick={dismiss} className={cn(secondaryButton, "shrink-0")}>
          Got it
        </button>
      </header>
      <ol className="air-rows text-[14.5px] font-medium text-ink">
        <li className="flex gap-3 px-4 py-4 sm:px-5.5">
          <span className="air-lbl w-8 shrink-0 pt-0.5" aria-hidden>01</span>
          <p>Check the draft we filled from your application — role, business, and anything else you already answered. Edit what needs a polish.</p>
        </li>
        <li className="flex gap-3 px-4 py-4 sm:px-5.5">
          <span className="air-lbl w-8 shrink-0 pt-0.5" aria-hidden>02</span>
          <p>Add a portrait on your pass (the stamp above). Neighbors see initials until you do.</p>
        </li>
        <li className="flex gap-3 px-4 py-4 sm:px-5.5">
          <span className="air-lbl w-8 shrink-0 pt-0.5" aria-hidden>03</span>
          <p>
            When you’re ready to appear, open{" "}
            <a href="#visibility" className={cn("air-link", ring)}>Visibility</a>
            {" "}and turn on the member directory — and the public website only if you want anyone to find you.
          </p>
        </li>
      </ol>
      <div className="flex flex-wrap gap-3 px-4 pb-5 pt-1 sm:px-5.5">
        <a href="#visibility" className={redButton}>
          Open visibility <Icon name="eye" />
        </a>
        <Link to="/directory" className={cn(secondaryButton)}>
          Browse the directory <Icon name="arrow-right" />
        </Link>
      </div>
    </section>
  );
}
