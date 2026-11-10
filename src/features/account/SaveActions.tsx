import type * as React from "react";
import { cn } from "@/index";
import { primaryButton, secondaryButton } from "@/app/layout/app-classes";
import { Icon } from "@/app/layout/icons";

/**
 * /account's save bar, a glass pill sticky at the foot of the page column: where the draft stands, Preview and Save.
 * Save submits `formId`, so every profile input (joined with `form=`) is validated natively; it stays disabled until
 * something changed. The status is a live region, so "Unsaved changes" and "All changes saved" are announced once each.
 */
export function SaveActions({ formId, dirty, pending, error, onSubmit, onPreview }: {
  formId: string; dirty: boolean; pending: boolean; error: string | null;
  onSubmit: (e: React.FormEvent<HTMLFormElement>) => void; onPreview: () => void;
}) {
  return (
    <div className="app-glass sticky bottom-3 z-10 flex flex-col gap-2 rounded-[28px] p-2.5">
      {error && <p role="alert" className="px-3 pt-1 text-sm text-danger">{error}</p>}
      <form id={formId} onSubmit={onSubmit} className="flex flex-wrap items-center justify-end gap-2.5">
        <span role="status" className="mr-auto inline-flex items-center gap-2 pl-3 text-[13px] text-app-muted">
          <span aria-hidden className={cn("size-1.5 rounded-full", dirty ? "bg-app-pending" : "bg-app-gel-green")} />
          {pending ? "Saving…" : dirty ? "Unsaved changes" : "All changes saved"}
        </span>
        <button type="button" onClick={onPreview} className={secondaryButton}>Preview<span className="sr-only sm:not-sr-only">&nbsp;card</span></button>
        <button type="submit" disabled={!dirty || pending} className={primaryButton}>
          {pending ? "Saving…" : <>Save changes <Icon name="arrow-right" className="twc-arrow size-3.5" /></>}
        </button>
      </form>
    </div>
  );
}
