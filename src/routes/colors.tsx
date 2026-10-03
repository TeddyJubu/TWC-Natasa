import { createFileRoute } from "@tanstack/react-router";
import { Container, Section, SectionHeader } from "@/index";
import { Shell } from "@/showcase/Shell";

export const Route = createFileRoute("/colors")({
  head: () => ({
    meta: [
      { title: "Colors — Keepsake Design System" },
      { name: "description", content: "Every Keepsake color token with its role, in light and dark." },
      { property: "og:title", content: "Colors — Keepsake Design System" },
      { property: "og:description", content: "Paper, ink, rose and sage color tokens." },
    ],
  }),
  component: Colors,
});

const tokens = [
  ["paper", "Page background", "bg-paper", "text-ink"],
  ["surface", "Raised / alternate band", "bg-surface", "text-ink"],
  ["ink", "Primary text, solid buttons", "bg-ink", "text-paper"],
  ["ink-muted", "Secondary text", "bg-ink-muted", "text-paper"],
  ["accent", "Rose accent, eyebrows, CTAs", "bg-accent", "text-accent-ink"],
  ["sage", "Supporting botanical tone", "bg-sage", "text-paper"],
  ["line", "Hairlines and borders", "bg-line", "text-ink"],
  ["danger", "Errors", "bg-danger", "text-paper"],
] as const;

function Colors() {
  return (
    <Shell>
      <Section>
        <Container className="flex flex-col gap-14">
          <SectionHeader eyebrow="Foundations" title="Colors" intro="Toggle dark in the header to verify every token in both themes." />
          <div className="grid grid-cols-2 gap-6 md:grid-cols-4">
            {tokens.map(([name, role, bg, fg]) => (
              <div key={name} className="flex flex-col gap-3">
                <div className={`${bg} ${fg} flex aspect-[4/5] items-end rounded-arch border border-line p-5 font-display text-2xl italic`}>Aa</div>
                <div>
                  <code className="text-sm text-ink">{bg}</code>
                  <p className="text-sm text-ink-muted">{role}</p>
                </div>
              </div>
            ))}
          </div>
        </Container>
      </Section>
    </Shell>
  );
}
