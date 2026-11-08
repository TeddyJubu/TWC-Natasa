import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { MemberCard, type MemberProfile } from "@/index";
import type { Neighborhood } from "@/features/neighborhoods/queries";
import { toneFor } from "@/features/neighborhoods/tone";
import { introsQuery } from "@/features/members/queries";
import { Card, InlineError } from "@/app/layout/app-ui";
import { Locked } from "./shared";

/** Introductions to other members in the black contact-sheet panel; each card opens the page's MemberDialog. */
export function IntroductionsSection({
  userId, approved, neighborhood: n, hoodList, onOpen,
}: {
  userId: string;
  approved: boolean;
  /** Her neighborhood, or null when she hasn't chosen one. */
  neighborhood: string | null;
  hoodList: Neighborhood[];
  onOpen: (member: MemberProfile) => void;
}) {
  const introsState = useQuery({ ...introsQuery(userId, n), enabled: approved, placeholderData: keepPreviousData });
  const intros = introsState.data ?? [];

  return (
    <Card id="introductions" title="Introductions" subtitle={n ? `Neighbors from ${n} first, then across the constellation.` : "Neighbors from across the constellation."}>
      {!approved ? <Locked /> : (
        <>
          {introsState.isError && <InlineError message="We couldn’t load your introductions." onRetry={() => void introsState.refetch()} />}
          {introsState.isSuccess && intros.length === 0 ? (
            <p className="px-5.5 py-4 text-[15px] text-app-muted">No introductions yet. As more neighbors join the directory, they’ll appear here.</p>
          ) : intros.length > 0 && (
            <div className="p-3">
              <div className="grid grid-cols-1 gap-3 rounded-[10px] bg-black p-3 sm:grid-cols-2 xl:grid-cols-4">
                {intros.map((m) => <MemberCard key={m.id} member={m} variant="catalogue" tone={toneFor(m.neighborhood, hoodList)} catalogueNumber={m.catalogueNumber} onOpen={() => onOpen(m)} />)}
              </div>
            </div>
          )}
        </>
      )}
    </Card>
  );
}
