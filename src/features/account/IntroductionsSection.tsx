import { keepPreviousData, useQuery } from "@tanstack/react-query";
import type { MemberProfile } from "@/index";
import { introsQuery } from "@/features/members/queries";
import { EmptySlot, InlineError, Letter, Stamp } from "@/app/layout/app-ui";
import { Locked } from "./shared";

/** Introductions to other members as a strip of stamps (the directory's); each opens the page's MemberDialog. */
export function IntroductionsSection({
  userId, approved, applied, neighborhood: n, onOpen,
}: {
  userId: string;
  approved: boolean;
  /** She has an application on file, so the locked panel needn't offer /join. */
  applied: boolean;
  /** Her neighborhood, or null when she hasn't chosen one. */
  neighborhood: string | null;
  onOpen: (member: MemberProfile) => void;
}) {
  const introsState = useQuery({ ...introsQuery(userId, n), enabled: approved, placeholderData: keepPreviousData });
  const intros = introsState.data ?? [];

  return (
    <Letter id="introductions" no={8} title="Introductions" subtitle={n ? `Neighbors from ${n} first, then across the constellation.` : "Neighbors from across the constellation."}>
      {!approved ? <Locked applied={applied} /> : (
        <>
          {introsState.isError && <InlineError message="We couldn’t load your introductions." onRetry={() => void introsState.refetch()} />}
          {introsState.isSuccess && intros.length === 0 ? (
            <EmptySlot><p>No introductions yet. As more neighbors join the directory, they’ll appear here.</p></EmptySlot>
          ) : intros.length > 0 && (
            // The sheet has no ground of its own, so one introduction is one stamp, never a lone card in an empty panel.
            <div className="air-sheet air-sheet--strip">
              {intros.map((m) => <Stamp key={m.id} member={m} label={`View ${m.name}’s profile`} onClick={() => onOpen(m)} />)}
            </div>
          )}
        </>
      )}
    </Letter>
  );
}
