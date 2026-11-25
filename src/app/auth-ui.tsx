// Shared frame for the account-access pages (/auth, /reset-password, /verified): the bare chrome around one stone
// section holding the canvas's sign-in column (`.login`: 460px, eyebrow, heading, pill fields), plus its class
// vocabulary. Styles in twc-forms.css. App-only.
import * as React from "react";
import { AppFooter, AppNav, AppPage } from "@/app/layout/AppLayout";

/** The sign-in column: no card, the fields sit straight on the stone. */
export const authCard = "twc-flogin flex min-w-0 flex-col gap-[18px]";
export const authH = "twc-h2";
export const authEyebrow = "twc-eyebrow";
/** Small underlined link (also used on buttons that look like links). */
export const slink = "cursor-pointer font-sans text-sm font-medium text-sb-blue-ink underline decoration-1 underline-offset-[3px] hover:text-sb-ink focus-visible:rounded-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sb-blue-ink";
/** A form-level failure: wine text in a wine ring (it shakes once inside a `twc-form`). */
export const authAlert = "twc-notice twc-notice--danger text-[15px] text-sb-danger";

/** AppPage → AppNav → main#main (one stone section) → AppFooter. */
export function AuthFrame({ children }: { children: React.ReactNode }) {
  return (
    <AppPage>
      <AppNav bare />
      <main id="main" tabIndex={-1} className="outline-none">
        <section className="twc-fauth twc-c-stone">{children}</section>
      </main>
      <AppFooter bare />
    </AppPage>
  );
}
