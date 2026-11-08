// Account-only building blocks; the shared card vocabulary lives in src/app/layout/app-ui.tsx.
import { Link } from "@tanstack/react-router";
import { linkClass } from "@/app/layout/app-classes";

/** Card body for applicants: gatherings, headshots and introductions open once she is approved. */
export function Locked() {
  return (
    <div className="flex flex-col items-start gap-2 px-5.5 py-5 text-[15px]">
      <p className="text-ink">Unlocks once you’re welcomed in</p>
      <p className="text-[13.5px]/5 text-app-muted">Members see gatherings, headshot booking, and personal introductions here.</p>
      <Link to="/join" className={linkClass}>Haven’t applied yet? Start your application</Link>
    </div>
  );
}
