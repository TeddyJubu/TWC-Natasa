import * as React from "react";
import { Link } from "@tanstack/react-router";
import { Dialog, DialogClose, DialogContent } from "@ui-sdk/react/dialog";
import { Icon, JOIN_CLASS, JoinButton } from "./twc";

const menuCta = { "--d": "460ms" } as React.CSSProperties;
import type { SiteLink } from "./AppLayout";

/** The full-screen menu below lg. Loaded on first open (see AppLayout). */
export default function SiteMenu({ open, onOpenChange, links, signedIn }: {
  open: boolean; onOpenChange: (open: boolean) => void; links: SiteLink[]; signedIn: boolean;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent aria-label="Site menu" className="sb-menu bg-sb-paper text-sb-ink">
          <div className="flex h-full flex-col overflow-y-auto px-5 py-4">
            <div className="flex items-center justify-between">
              <span className="font-display text-3xl font-black tracking-[-0.04em]">find your people.</span>
              <DialogClose aria-label="Close menu" className="grid size-11 place-items-center rounded-full outline-none focus-visible:ring-2 focus-visible:ring-sb-ink">
                <Icon name="close" className="size-6" />
              </DialogClose>
            </div>
            <nav aria-label="Menu" className="mt-8 flex flex-col">
              {links.map((l, i) => (
                <Link
                  key={l.to}
                  to={l.to}
                  onClick={() => onOpenChange(false)}
                  className="sb-menu-item flex items-baseline justify-between border-b border-sb-ink/15 py-3.5 font-display text-[30px] font-extrabold leading-tight tracking-[-0.01em] [font-stretch:75%] underline-offset-4 outline-none focus-visible:underline"
                  style={{ "--d": `${60 + i * 45}ms` } as React.CSSProperties}
                >
                  {l.label}<span aria-hidden="true" className="font-plex text-xs text-sb-ink/75">0{i + 1}</span>
                </Link>
              ))}
            </nav>
            {signedIn ? (
              <Link to="/account" onClick={() => onOpenChange(false)} className={`${JOIN_CLASS} sb-menu-item mt-8 w-full`} style={menuCta}>
                Your account <Icon name="arrow" className="twc-arrow" />
              </Link>
            ) : <JoinButton onClick={() => onOpenChange(false)} className="sb-menu-item mt-8 w-full" style={menuCta} />}
          </div>
        </DialogContent>
    </Dialog>
  );
}
