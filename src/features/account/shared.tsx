// Account-only building blocks; the shared card vocabulary lives in src/app/layout/app-ui.tsx.
import { Link } from "@tanstack/react-router";
import { linkClass } from "@/app/layout/app-classes";

/**
 * Card body before approval: gatherings, headshots and introductions open once she is welcomed in. The /join link
 * shows only to someone who hasn't applied; an applicant (pending or declined) already has.
 */
export function Locked({ applied }: { applied: boolean }) {
  return (
    <div className="flex flex-col items-start gap-1.5 px-4 py-4.5 sm:px-5.5">
      <p className="twc-notice__title text-ink">Unlocks once you’re welcomed in</p>
      <p className="text-sm text-app-muted">Members see gatherings, headshot booking, and personal introductions here.</p>
      {!applied && <Link to="/join" className={linkClass}>Haven’t applied yet? Start your application</Link>}
    </div>
  );
}
