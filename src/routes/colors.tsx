import { createFileRoute } from "@tanstack/react-router";
import { SectionHeader } from "@/index";
import { Shell } from "@/showcase/Shell";

export const Route = createFileRoute("/colors")({
  head: () => ({
    meta: [
      { title: "Colors — Bloom Design System" },
      { name: "description", content: "Bloom color tokens: canvas, ink, sky, sun and night." },
      { property: "og:title", content: "Colors — Bloom Design System" },
      { property: "og:description", content: "Canvas, ink, sky blue, sunflower yellow and night black." },
    ],
  }),
  component: Colors,
});

const tokens = [
  ["bg-canvas", "Page background", "bg-canvas text-ink"],
  ["bg-surface", "Badges, inputs, soft cards", "bg-surface text-ink"],
  ["bg-surface-strong", "Tags, hover fills", "bg-surface-strong text-ink"],
  ["bg-ink", "Headlines, dots, lines", "bg-ink text-canvas"],
  ["text-ink-muted", "Secondary copy", "bg-ink-muted text-canvas"],
  ["text-ink-faint", "Fading statement words, idle tabs", "bg-ink-faint text-ink"],
  ["bg-sky", "Primary buttons, hero sky", "bg-sky text-sky-ink"],
  ["bg-sun", "Ribbons, highlights", "bg-sun text-sun-ink"],
] as const;

function Colors() {
  return (
    <Shell>
      <div className="flex flex-col gap-14">
        <SectionHeader badge="Foundations" title="Colors" intro="Wrap any block in tone-night (or toggle Dark) and every token inverts." />
        {["", "tone-night rounded-panel p-8"].map((wrap) => (
          <div key={wrap} className={`grid grid-cols-2 gap-5 md:grid-cols-4 ${wrap}`}>
            {tokens.map(([name, role, cls]) => (
              <div key={name} className="flex flex-col gap-3">
                <div className={`${cls} flex aspect-[4/3] items-end rounded-card border border-line p-5 font-display text-3xl`}>Aa</div>
                <div><code className="text-sm text-ink">{name}</code><p className="text-sm text-ink-muted">{role}</p></div>
              </div>
            ))}
          </div>
        ))}
      </div>
    </Shell>
  );
}
