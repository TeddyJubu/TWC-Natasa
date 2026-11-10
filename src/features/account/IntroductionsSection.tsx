import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { MemberCard, type MemberProfile } from "@/index";
import type { Neighborhood } from "@/features/neighborhoods/queries";
import { toneFor } from "@/features/neighborhoods/tone";
import { introsQuery } from "@/features/members/queries";
import { InlineError } from "@/app/layout/app-ui";
import { AirCard, EmptySlot, Locked } from "./shared";

/** Introductions to other members in the black contact-sheet panel; each card opens the page's MemberDialog. */
export function IntroductionsSection({
  userId, approved, applied, neighborhood: n, hoodList, onOpen,
}: {
  userId: string;
  approved: boolean;
  /** She has an application on file, so the locked panel needn't offer /join. */
  applied: boolean;
  /** Her neighborhood, or null when she hasn't chosen one. */
  neighborhood: string | null;
  hoodList: Neighborhood[];
  onOpen: (member: MemberProfile) => void;
}) {
  const introsState = useQuery({ ...introsQuery(userId, n), enabled: approved, placeholderData: keepPreviousData });
  const intros = introsState.data ?? [];

  return (
    <AirCard id="introductions" span={5} no={7} title="Introductions" subtitle={n ? `Neighbors from ${n} first, then across the constellation.` : "Neighbors from across the constellation."}>
      {!approved ? <Locked applied={applied} /> : (
        <>
          {introsState.isError && <InlineError message="We couldn’t load your introductions." onRetry={() => void introsState.refetch()} />}
          {introsState.isSuccess && intros.length === 0 ? (
            <EmptySlot><p>No introductions yet. As more neighbors join the directory, they’ll appear here.</p></EmptySlot>
          ) : intros.length > 0 && (
            <div>
              <div className="grid grid-cols-1 gap-x-5 gap-y-7 rounded-xl bg-black px-4 py-6 sm:grid-cols-2 sm:px-6 sm:pt-7 sm:pb-8">
                {intros.map((m) => <MemberCard key={m.id} member={m} variant="catalogue" tone={toneFor(m.neighborhood, hoodList)} catalogueNumber={m.catalogueNumber} onOpen={() => onOpen(m)} />)}
              </div>
            </div>
          )}
        </>
      )}
    </AirCard>
  );
}
