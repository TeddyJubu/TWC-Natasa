// Account-only pieces; the shared airmail kit is src/app/layout/app-ui.tsx (DESIGN.md "Internal tools").
import { Link } from "@tanstack/react-router";
import { cn } from "@/index";
import { ring } from "@/app/layout/app-classes";
import { EmptySlot } from "@/app/layout/app-ui";

/**
 * Card body before approval: gatherings, headshots and introductions open once she is welcomed in. The /join link
 * shows only to someone who hasn't applied; an applicant (pending or declined) already has.
 */
export function Locked({ applied }: { applied: boolean }) {
  return (
    <EmptySlot icon="shield-check">
      <p className="air-empty-title">Unlocks once you’re welcomed in</p>
      <p>Members see gatherings, headshot booking, and personal introductions here.</p>
      {!applied && <Link to="/join" className={cn("air-link", ring)}>Haven’t applied yet? Start your application</Link>}
    </EmptySlot>
  );
}
