import * as React from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { Container, MemberCard, MemberDialog, type MemberProfile, Section, SectionHeader } from "@/index";
import type { Neighborhood } from "@/features/neighborhoods/queries";
import { toneFor } from "@/features/neighborhoods/tone";
import { introsQuery } from "@/features/members/queries";
import { InlineError, Locked } from "./shared";

/** 03 — introductions to other members, each opening into a MemberDialog. */
export function IntroductionsSection({
  userId, approved, neighborhood: n, hoodList,
}: {
  userId: string;
  approved: boolean;
  /** Her neighborhood, or null when she hasn't chosen one. */
  neighborhood: string | null;
  hoodList: Neighborhood[];
}) {
  const introsState = useQuery({ ...introsQuery(userId, n), enabled: approved, placeholderData: keepPreviousData });
  // The introduction opened into a MemberDialog; the dialog returns focus to its card on close.
  const [openIntro, setOpenIntro] = React.useState<MemberProfile | null>(null);
  const intros = introsState.data ?? [];

  return (
    <>
      <Section tone="night" className="pt-0 md:pt-0">
        <Container className="flex flex-col gap-14">
          <SectionHeader badgeVariant="solid" badge="03 — Introductions" title="Women You Should Meet" intro={n ? `Neighbors from ${n} first, then across the constellation.` : "Neighbors from across the constellation."} />
          {!approved ? <Locked /> : (
            <>
              {introsState.isError && <InlineError message="We couldn’t load your introductions." onRetry={() => void introsState.refetch()} />}
              {introsState.isSuccess && intros.length === 0 ? (
                <p className="text-center text-sm text-ink-muted">No introductions yet. As more neighbors join the directory, they’ll appear here.</p>
              ) : (
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  {intros.map((m) => <MemberCard key={m.id} member={m} variant="catalogue" tone={toneFor(m.neighborhood, hoodList)} catalogueNumber={m.catalogueNumber} onOpen={() => setOpenIntro(m)} />)}
                </div>
              )}
            </>
          )}
        </Container>
      </Section>
      <MemberDialog member={openIntro} onClose={() => setOpenIntro(null)} />
    </>
  );
}
