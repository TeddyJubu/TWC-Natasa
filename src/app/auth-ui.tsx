// Shared frame for the account-access pages (/auth, /reset-password, /verified): the site chrome around one
// cream band, plus the auth card's class vocabulary from the design canvas. App-only.
import * as React from "react";
import { AppFooter, AppNav, AppPage } from "@/app/layout/AppLayout";
import { Scallop } from "@/app/layout/twc";

export const authCard = "box-border flex w-full min-w-0 flex-col gap-[18px] rounded-md bg-sb-paper p-10 shadow-[inset_0_0_0_1px_rgb(31_31_28/0.15)] max-[720px]:px-5 max-[720px]:py-7";
export const authH = "font-display text-[40px] leading-[1.08] tracking-[-0.5px] text-balance max-[720px]:text-[34px]";
export const authScript = "twc-eyebrow-script -mb-2.5 text-4xl";
/** Small underlined link (also used on buttons that look like links). */
export const slink = "cursor-pointer font-geist text-sm font-medium text-sb-blue-ink underline decoration-1 underline-offset-[3px] hover:text-sb-ink focus-visible:rounded-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sb-blue-ink";
/** A form-level failure: danger text in a danger ring. */
export const authAlert = "twc-error rounded-md px-4 py-3.5 text-[15px] shadow-[inset_0_0_0_1.5px_var(--color-sb-danger)]";

/** AppPage → AppNav → main#main (a scalloped cream band) → AppFooter. */
export function AuthFrame({ children }: { children: React.ReactNode }) {
  return (
    <AppPage>
      <AppNav />
      <main id="main" tabIndex={-1} className="outline-none">
        <Scallop from="#fcfcfa" to="#f3f0e8" />
        <section className="twc-band twc-band--cream pb-24 pt-16">{children}</section>
        <Scallop from="#f3f0e8" to="#fcfcfa" />
        <div className="h-12" />
      </main>
      <AppFooter />
    </AppPage>
  );
}
