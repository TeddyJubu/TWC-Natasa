import * as React from "react";
import { Link } from "@tanstack/react-router";
import { cn } from "@/index";
import { getAuthClient } from "@/app/auth-client";
import { fieldClass, primaryButton, ring, secondaryButton } from "@/app/layout/app-classes";
import { Letter } from "@/app/layout/app-ui";
import { DeleteAccount } from "./DeleteAccount";

/**
 * Account settings, near the page's end: the email she signs in with (changing it goes through the club: an address
 * links her applications, RSVPs and newsletter, so there is no self-serve change), her password, and "Delete my
 * account". A declined account sees this card too: it is about her account, not her membership.
 */
export function AccountSettings({ email, no }: { email?: string; no: number }) {
  return (
    <Letter id="settings" no={no} title="Account settings" subtitle="How you sign in, and your account">
      <div className="air-rule">
        {email && (
          <div className="air-mrow">
            <span className="air-lbl">Email</span>
            <span className="flex min-w-0 flex-col items-end gap-1 text-right">
              <span className="break-all">{email}</span>
              <Link to="/contact" className={cn("air-link", ring)}>Need to change it? Contact us</Link>
            </span>
          </div>
        )}
        <ChangePassword />
        <DeleteAccount />
      </div>
    </Letter>
  );
}

// Better Auth's codes (src/server/auth.server.ts) in her words.
const FAILED: Record<string, string> = {
  INVALID_PASSWORD: "That current password didn’t match. Try again.",
  PASSWORD_TOO_SHORT: "Your new password needs at least 8 characters.",
  PASSWORD_TOO_LONG: "That new password is too long. Try a shorter one.",
};
const GOOGLE = "You sign in with Google, so there’s no password to change here.";
const TOO_MANY = "Too many tries. Wait ten minutes, then try again.";
const GENERIC = "We couldn’t change your password right now. Please try again in a minute.";

/**
 * "Change password": her current password and a new one (Better Auth's changePassword, which checks the current one
 * and signs her other devices out). A Google-only account has no password, so it says so instead.
 */
function ChangePassword() {
  // Until listAccounts answers, assume a password account: the button is harmless, the server refuses otherwise.
  const [hasPassword, setHasPassword] = React.useState(true);
  const [open, setOpen] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [done, setDone] = React.useState(false);
  const headingId = React.useId();
  const opener = React.useRef<HTMLButtonElement>(null);
  const first = React.useRef<HTMLInputElement>(null);
  const opened = React.useRef(false);

  React.useEffect(() => {
    let active = true;
    void getAuthClient()
      .then((auth) => auth.listAccounts())
      .then(({ data }) => { if (active && data) setHasPassword(data.some((a) => a.providerId === "credential")); }, () => {});
    return () => { active = false; };
  }, []);

  // The button and the form swap places, so keyboard focus follows: into the first field, and back on Cancel or done.
  React.useEffect(() => {
    if (open) { opened.current = true; first.current?.focus(); } else if (opened.current) opener.current?.focus();
  }, [open]);

  if (!hasPassword) {
    return (
      <div className="air-mrow">
        <span className="air-lbl">Password</span>
        <span className="text-[13px] font-medium text-app-muted">You sign in with Google</span>
      </div>
    );
  }

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const currentPassword = String(form.get("currentPassword") ?? "");
    const newPassword = String(form.get("newPassword") ?? "");
    setBusy(true); setError(null);
    try {
      const { error } = await (await getAuthClient()).changePassword({ currentPassword, newPassword, revokeOtherSessions: true });
      if (error) {
        if (error.code === "CREDENTIAL_ACCOUNT_NOT_FOUND") setHasPassword(false);
        setError(error.status === 429 ? TOO_MANY : error.code === "CREDENTIAL_ACCOUNT_NOT_FOUND" ? GOOGLE : FAILED[error.code ?? ""] ?? GENERIC);
        return;
      }
    } catch {
      setError(GENERIC);
      return;
    } finally {
      setBusy(false);
    }
    setDone(true);
    setOpen(false);
  }

  return (
    <>
      {open ? (
        <form onSubmit={submit} aria-labelledby={headingId} className="flex flex-col gap-3 border-t border-air-line py-4">
          <h3 id={headingId} className="air-lbl mb-0">Change your password</h3>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="settings-current-password" className="air-lbl mb-0">Current password</label>
            <input
              ref={first} id="settings-current-password" name="currentPassword" type="password" required autoComplete="current-password"
              aria-invalid={error ? true : undefined} aria-describedby={error ? "settings-password-error" : undefined} className={fieldClass}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="settings-new-password" className="air-lbl mb-0">New password</label>
            <input
              id="settings-new-password" name="newPassword" type="password" required minLength={8} maxLength={128} autoComplete="new-password"
              aria-describedby="settings-new-password-hint" className={fieldClass}
            />
            <p id="settings-new-password-hint" className="text-[13px]/[1.5] text-app-muted">
              At least 8 characters. Changing it signs you out on your other devices.
            </p>
          </div>
          {error && <p id="settings-password-error" role="alert" className="text-sm text-danger">{error}</p>}
          <div className="flex flex-wrap gap-3">
            <button type="submit" disabled={busy} aria-busy={busy || undefined} className={primaryButton}>Change password</button>
            <button type="button" onClick={() => { setOpen(false); setError(null); }} className={secondaryButton}>Cancel</button>
          </div>
        </form>
      ) : (
        <div className="air-mrow">
          <span className="air-lbl">Password</span>
          <button ref={opener} type="button" onClick={() => { setDone(false); setOpen(true); }} className={secondaryButton}>Change password</button>
        </div>
      )}
      {/* Mounted before it speaks, so it is announced; the page's save bar holds the page's one role="status". */}
      <p aria-live="polite" className={cn("text-[13px] font-medium text-ink", done ? "pb-3" : "sr-only")}>
        {done ? "Password changed. Your other devices are signed out." : ""}
      </p>
    </>
  );
}
