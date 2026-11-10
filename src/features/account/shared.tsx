// Account-only building blocks; the shared card vocabulary lives in src/app/layout/app-ui.tsx.
import { Link } from "@tanstack/react-router";
import { linkClass } from "@/app/layout/app-classes";

/**
 * Card body before approval: gatherings, headshots and introductions open once she is welcomed in. The /join link
 * shows only to someone who hasn't applied; an applicant (pending or declined) already has.
 */
export function Locked({ applied }: { applied: boolean }) {
  return (
    <div className="p-4 sm:p-5.5">
      <div className="twc-notice items-start">
        <p className="twc-notice__title">Unlocks once you’re welcomed in</p>
        <p className="text-sm text-app-muted">Members see gatherings, headshot booking, and personal introductions here.</p>
        {!applied && <Link to="/join" className={linkClass}>Haven’t applied yet? Start your application</Link>}
      </div>
    </div>
  );
}
