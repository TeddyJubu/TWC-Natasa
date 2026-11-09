import type * as React from "react";
import { primaryButton, secondaryButton } from "@/app/layout/app-classes";

/**
 * /account's save bar, sticky at the foot of the page column: Preview and Save. Save submits `formId`, so every
 * profile input (joined with `form=`) is validated natively; it stays disabled until something changed.
 */
export function SaveActions({ formId, dirty, pending, saved, error, onSubmit, onPreview }: {
  formId: string; dirty: boolean; pending: boolean; saved: boolean; error: string | null;
  onSubmit: (e: React.FormEvent<HTMLFormElement>) => void; onPreview: () => void;
}) {
  return (
    <div className="sticky bottom-0 z-10 flex flex-col gap-2 rounded-md bg-app p-3.5 shadow-[inset_0_0_0_1px_var(--color-app-line)]">
      {error && <p role="alert" className="text-sm text-danger">{error}</p>}
      <form id={formId} onSubmit={onSubmit} className="flex flex-wrap items-center justify-end gap-2.5">
        <span role="status" className="mr-auto text-sm text-app-muted">{saved ? "Saved" : ""}</span>
        <button type="button" onClick={onPreview} className={secondaryButton}>Preview card</button>
        <button type="submit" disabled={!dirty || pending} className={primaryButton}>
          {pending ? "Saving…" : <>Save changes <span aria-hidden className="twc-arrow">→</span></>}
        </button>
      </form>
    </div>
  );
}
