import * as React from "react";
import { useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { cn } from "@/index";
import { getAuthClient } from "@/app/auth-client";
import { emitAuthEvent } from "@/app/auth-events";
import { fieldClass, redButton, secondaryButton } from "@/app/layout/app-classes";
import { viewerQuery } from "@/features/members/queries";

// Better Auth's codes (and ours from src/server/auth.server.ts / account-delete.ts) in her words.
const FAILED: Record<string, string> = {
  INVALID_PASSWORD: "That password didn’t match. Try again.",
  PASSWORD_REQUIRED: "Enter your password to delete your account.",
  CREDENTIAL_ACCOUNT_NOT_FOUND: "Enter your password to delete your account.",
  SESSION_EXPIRED: "For your safety, sign out and sign in again, then delete your account within a day.",
  ADMIN_CANNOT_DELETE: "An admin account can’t be deleted from here. Ask another admin.",
};
const GENERIC = "We couldn’t delete your account right now. Please try again in a minute.";

/**
 * "Delete my account" at the foot of the Membership card: a confirm step, then her password (a Google-only account
 * has none, so Better Auth wants a sign-in from the last day instead). The server refuses admins and deletes her
 * profile, applications and upload folders with the account (src/server/account-delete.ts).
 */
export function DeleteAccount() {
  const admin = useQuery(viewerQuery).data?.admin === true;
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [confirming, setConfirming] = React.useState(false);
  // Until listAccounts answers, assume a password account: the field is harmless, its absence is not.
  const [hasPassword, setHasPassword] = React.useState(true);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const headingId = React.useId();

  React.useEffect(() => {
    if (!confirming) return;
    let active = true;
    void getAuthClient()
      .then((auth) => auth.listAccounts())
      .then(({ data }) => { if (active && data) setHasPassword(data.some((a) => a.providerId === "credential")); }, () => {});
    return () => { active = false; };
  }, [confirming]);

  if (admin) {
    return (
      <div className="air-mrow">
        <span className="air-lbl">Delete account</span>
        <span className="text-[13px] font-medium text-app-muted">Admin accounts can’t be deleted from here.</span>
      </div>
    );
  }

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const password = String(new FormData(e.currentTarget).get("password") ?? "");
    setBusy(true); setError(null);
    try {
      const { error } = await (await getAuthClient()).deleteUser(hasPassword ? { password } : {});
      if (error) {
        setError(FAILED[error.code ?? ""] ?? GENERIC);
        setBusy(false);
        return;
      }
    } catch {
      setError(GENERIC);
      setBusy(false);
      return;
    }
    await queryClient.cancelQueries();
    queryClient.clear();
    emitAuthEvent("SIGNED_OUT");
    navigate({ to: "/", replace: true });
  }

  if (!confirming) {
    return (
      <div className="air-mrow">
        <span className="air-lbl">Delete account</span>
        <button type="button" onClick={() => setConfirming(true)} className={secondaryButton}>Delete my account</button>
      </div>
    );
  }

  return (
    <form onSubmit={submit} aria-labelledby={headingId} className="flex flex-col gap-3 border-t border-air-line py-4">
      <h3 id={headingId} className="air-lbl mb-0">Delete your account?</h3>
      <p className="text-[14px]/[1.5] text-ink">
        This deletes your account, your profile and card, your portrait and logo, your newsfeed posts, loves and replies,
        and your membership applications, for good. It can’t be undone.
      </p>
      {hasPassword ? (
        <div className="flex flex-col gap-1.5">
          <label htmlFor="delete-password" className="air-lbl mb-0">Your password</label>
          <input id="delete-password" name="password" type="password" required autoComplete="current-password"
            aria-invalid={error ? true : undefined} aria-describedby={error ? "delete-error" : undefined} className={fieldClass} />
        </div>
      ) : (
        <p className="text-[13px]/[1.5] text-app-muted">You sign in with Google: if that was more than a day ago, sign out and back in first.</p>
      )}
      {error && <p id="delete-error" role="alert" className="text-sm text-danger">{error}</p>}
      <div className="flex flex-wrap gap-3">
        <button type="submit" disabled={busy} aria-busy={busy || undefined} className={cn(redButton, "air-btn--sm")}>Delete my account for good</button>
        <button type="button" onClick={() => { setConfirming(false); setError(null); }} className={secondaryButton}>Cancel</button>
      </div>
    </form>
  );
}
