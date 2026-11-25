// Account-only pieces; the shared kit is src/app/layout/app-ui.tsx (DESIGN.md "Internal tools").
import { Link } from "@tanstack/react-router";
import { cn } from "@/index";
import { ring } from "@/app/layout/app-classes";
import { EmptySlot } from "@/app/layout/app-ui";

/** What a declined account reads where members' things would be: the plain answer, no promise, and who to ask. */
export function DeclinedSlot() {
  return (
    <EmptySlot icon="shield-check">
      <p className="air-empty-title">This part is for members</p>
      <p>Your application wasn’t approved, so it stays closed on your account. Thank you for wanting to be part of the collective.</p>
      <Link to="/contact" className={cn("air-link", ring)}>Have a question? Contact us</Link>
    </EmptySlot>
  );
}

/**
 * Card body before approval: gatherings, headshots and introductions open once she is welcomed in. The /join link
 * shows only to someone who hasn't applied; a pending applicant already has, and a declined one gets DeclinedSlot.
 */
export function Locked({ applied, declined }: { applied: boolean; declined: boolean }) {
  if (declined) return <DeclinedSlot />;
  return (
    <EmptySlot icon="shield-check">
      <p className="air-empty-title">Unlocks once you’re welcomed in</p>
      <p>Members see events, headshot booking, and personal introductions here.</p>
      {!applied && <Link to="/join" className={cn("air-link", ring)}>Haven’t applied yet? Start your application</Link>}
    </EmptySlot>
  );
}
