import type * as React from "react";
import { cn } from "@/index";
import { ring } from "@/app/layout/app-classes";
import { Icon } from "@/app/layout/icons";

/**
 * /account's save bar: paper with an airmail edge at the foot of the page column that is only there when there is something to
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
    <div className="sticky bottom-3 z-10 col-span-full">
      <p role="status" className="sr-only">{status}</p>
      <div inert={!open} className="app-savebar air-savebar">
        {error && <p role="alert" className="w-full text-sm text-danger">{error}</p>}
        <form id={formId} onSubmit={onSubmit} className="contents">
          <span aria-hidden className="air-saved">
            <i className={cn((dirty || pending) && "air-saved--dirty")}><Icon name={dirty || pending ? "pencil" : "check"} /></i>
            {status}
          </span>
          {(dirty || pending) && (
            <>
              <button type="button" onClick={onDiscard} disabled={pending} className={cn("air-link mr-1.5", ring)}>
                Discard<span className="sr-only"> changes</span>
              </button>
              <button type="button" onClick={onPreview} className={cn("air-btn air-btn--line", ring)}>
                <Icon name="eye" /><span>Preview<span className="sr-only sm:not-sr-only"> card</span></span>
              </button>
              <button type="submit" disabled={pending} className={cn("air-btn air-btn--red", ring)}>
                {pending ? "Saving…" : <>Save changes <Icon name="arrow-right" /></>}
              </button>
            </>
          )}
        </form>
      </div>
    </div>
  );
}
