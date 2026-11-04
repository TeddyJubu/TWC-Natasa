import { createFileRoute } from "@tanstack/react-router";
import { SectionHeader } from "@/index";
import { Shell } from "@/showcase/Shell";

export const Route = createFileRoute("/colors")({
  head: () => ({
    meta: [
      { title: "Colors — The Women’s Collective Design System" },
      { name: "description", content: "The Women’s Collective color tokens, including seven neighborhood colors." },
      { property: "og:title", content: "Colors — The Women’s Collective Design System" },
      { property: "og:description", content: "Editorial foundations and neighborhood constellation colors." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
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
  ["bg-paper", "Editorial form panels", "bg-paper text-ink"],
  ["bg-mint", "Selected stories, accents", "bg-mint text-black"],
  ["bg-lilac", "Supporting editorial panels", "bg-lilac text-black"],
  ["bg-signal", "High-energy feature panels", "bg-signal text-black"],
  ["bg-lic", "Long Island City", "bg-lic text-white"],
  ["bg-sunnyside", "Sunnyside", "bg-sunnyside text-white"],
  ["bg-astoria", "Astoria", "bg-astoria text-white"],
  ["bg-jackson-heights", "Jackson Heights", "bg-jackson-heights text-white"],
  ["bg-elmhurst", "Elmhurst", "bg-elmhurst text-white"],
  ["bg-forest-hills", "Forest Hills", "bg-forest-hills text-white"],
  ["bg-rego-park", "Rego Park", "bg-rego-park text-white"],
  ["bg-greenpoint", "Greenpoint", "bg-greenpoint text-white"],
  ["bg-williamsburg", "Williamsburg", "bg-williamsburg text-white"],
  ["bg-bushwick", "Bushwick", "bg-bushwick text-white"],
] as const;

function Colors() {
  return (
    <Shell>
      <div className="flex flex-col gap-14">
        <SectionHeader badge="Foundations" title="Colors" intro="Wrap any block in tone-night (or toggle Dark) and every token inverts." />
        {["", "tone-night rounded-panel p-8"].map((wrap) => (
          <div key={wrap} className={`grid grid-cols-2 gap-5 md:grid-cols-4 ${wrap}`}>
            {tokens.map(([name, role, cls]) => (
              <div key={name} className="motion-scroll-reveal group flex flex-col gap-3">
                <div className={`${cls} flex aspect-[4/3] items-end rounded-card border border-line p-5 font-display text-3xl transition-[transform,box-shadow] duration-300 ease-[var(--ease-snap)] group-hover:-translate-y-1 group-hover:shadow-soft motion-reduce:transform-none`}>Aa</div>
                <div><code className="text-sm text-ink">{name}</code><p className="text-sm text-ink-muted">{role}</p></div>
              </div>
            ))}
          </div>
        ))}
      </div>
    </Shell>
  );
}
