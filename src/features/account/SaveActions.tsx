import type * as React from "react";
import { cn } from "@/index";
import { linkClass, primaryButton, secondaryButton } from "@/app/layout/app-classes";
import { Icon } from "@/app/layout/icons";

/**
 * /account's save bar: a glass pill at the foot of the page column that is only there when there is something to
 * say — unsaved changes (Discard, Preview, Save), a save in flight, a failed save, or "saved" for a moment after
 * one. Otherwise it is inert and out of sight (`app-savebar`), so a page with nothing to save shows no Save button.
 * Save submits `formId`, so every profile input (joined with `form=`) is validated natively. The status sits
 * outside the bar and stays mounted: it is the live region.
 */
export function SaveActions({ formId, dirty, pending, saved, error, onSubmit, onDiscard, onPreview }: {
  formId: string; dirty: boolean; pending: boolean; saved: boolean; error: string | null;
  onSubmit: (e: React.FormEvent<HTMLFormElement>) => void; onDiscard: () => void; onPreview: () => void;
}) {
  const open = dirty || pending || saved || !!error;
  const status = pending ? "Saving…" : dirty ? "Unsaved changes" : saved ? "All changes saved" : "";
  return (
    <div className="sticky bottom-3 z-10">
      <p role="status" className="sr-only">{status}</p>
      <div inert={!open} className="app-savebar app-glass flex flex-col gap-2 rounded-[28px] p-2.5">
        {error && <p role="alert" className="rounded-2xl bg-app px-4 py-2.5 text-sm text-danger">{error}</p>}
        <form id={formId} onSubmit={onSubmit} className="flex flex-wrap items-center justify-end gap-x-2.5 gap-y-2">
          <span aria-hidden className="mr-auto inline-flex items-center gap-2 pl-3 text-sm text-ink">
            <span className={cn("size-2 rounded-full", dirty || pending ? "bg-app-pending" : "bg-app-gel-green")} />
            {status}
          </span>
          {(dirty || pending) && (
            <>
              <button type="button" onClick={onDiscard} disabled={pending} className={cn(linkClass, "mr-1.5 text-ink-muted disabled:opacity-50")}>
                Discard<span className="sr-only"> changes</span>
              </button>
              <button type="button" onClick={onPreview} className={secondaryButton}><span>Preview<span className="sr-only sm:not-sr-only"> card</span></span></button>
              <button type="submit" disabled={pending} className={primaryButton}>
                {pending ? "Saving…" : <>Save changes <Icon name="arrow-right" className="twc-arrow size-3.5" /></>}
              </button>
            </>
          )}
        </form>
      </div>
    </div>
  );
}
