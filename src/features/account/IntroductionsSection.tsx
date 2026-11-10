import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { MemberCard, type MemberProfile } from "@/index";
import type { Neighborhood } from "@/features/neighborhoods/queries";
import { toneFor } from "@/features/neighborhoods/tone";
import { introsQuery } from "@/features/members/queries";
import { InlineError } from "@/app/layout/app-ui";
import { EmptySlot, Letter } from "@/app/layout/app-ui";
import { Locked } from "./shared";

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
    <Letter id="introductions" no={8} title="Introductions" subtitle={n ? `Neighbors from ${n} first, then across the constellation.` : "Neighbors from across the constellation."}>
      {!approved ? <Locked applied={applied} /> : (
        <>
          {introsState.isError && <InlineError message="We couldn’t load your introductions." onRetry={() => void introsState.refetch()} />}
          {introsState.isSuccess && intros.length === 0 ? (
            <EmptySlot><p>No introductions yet. As more neighbors join the directory, they’ll appear here.</p></EmptySlot>
          ) : intros.length > 0 && (
            <div>
              {/* The contact sheet hugs its cards (up to four), so one introduction isn't lost in an empty black panel. */}
              <div className="flex flex-wrap gap-x-5 gap-y-7 rounded-xl bg-black px-4 py-6 sm:w-fit sm:px-6 sm:pt-7 sm:pb-8">
                {intros.map((m) => <MemberCard key={m.id} member={m} variant="catalogue" tone={toneFor(m.neighborhood, hoodList)} catalogueNumber={m.catalogueNumber} onOpen={() => onOpen(m)} className="w-full sm:w-[300px] lg:w-[236px]" />)}
              </div>
            </div>
          )}
        </>
      )}
    </Letter>
  );
}
