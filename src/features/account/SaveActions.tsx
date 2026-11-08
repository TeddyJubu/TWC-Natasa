import type * as React from "react";
import { primaryButton, secondaryButton } from "@/app/layout/app-classes";
import { Icon } from "@/app/layout/icons";

/**
 * /account's top-bar actions: Preview and Save. Save submits `formId`, so every profile input (joined with `form=`)
 * is validated natively; it stays disabled until something changed. A failed save hangs below the bar.
 */
export function SaveActions({ formId, dirty, pending, saved, error, onSubmit, onPreview }: {
  formId: string; dirty: boolean; pending: boolean; saved: boolean; error: string | null;
  onSubmit: (e: React.FormEvent<HTMLFormElement>) => void; onPreview: () => void;
}) {
  return (
    <>
      <form id={formId} onSubmit={onSubmit} className="flex items-center gap-2.5">
        <span role="status" className="sr-only text-sm text-app-muted md:not-sr-only">{saved ? "Saved" : ""}</span>
        <button type="button" onClick={onPreview} className={secondaryButton}>
          <Icon name="eye" className="size-3.75 text-ink-muted" /><span>Preview<span className="sr-only sm:not-sr-only"> card</span></span>
        </button>
        <button type="submit" disabled={!dirty || pending} className={primaryButton}>{pending ? "Saving…" : "Save changes"}</button>
      </form>
      {error && <p role="alert" className="absolute top-full right-4 mt-2 max-w-sm rounded-lg border border-app-line bg-app px-3 py-2 text-sm text-danger shadow-[0_6px_18px_rgb(0_0_0/0.08)] sm:right-8">{error}</p>}
    </>
  );
}
