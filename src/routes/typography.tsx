import { createFileRoute } from "@tanstack/react-router";
import { Badge, Heading, SectionHeader, Stat, Statement, Text } from "@/index";
import { Shell } from "@/showcase/Shell";

export const Route = createFileRoute("/typography")({
  head: () => ({
    meta: [
      { title: "Typography — The Women’s Collective Design System" },
      { name: "robots", content: "noindex" },
      { name: "description", content: "Gilda Display, Inter, and The Women’s Collective type scale." },
      { property: "og:title", content: "Typography — The Women’s Collective Design System" },
      { property: "og:description", content: "Elegant serif display with a clean sans for body." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Typography,
});

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="motion-scroll-reveal grid gap-3 border-b border-line py-8 md:grid-cols-[14rem_1fr]">
      <code className="text-xs text-ink-muted">{label}</code>
      <div>{children}</div>
    </div>
  );
}

function Typography() {
  return (
    <Shell>
      <div className="flex flex-col gap-14">
        <SectionHeader badge="Foundations" title="Typography" />
        <div className="grid gap-5 md:grid-cols-2">
          <div className="motion-float rounded-card bg-surface p-8"><p className="font-display text-6xl">Gilda Display</p><Text tone="muted" className="mt-3">font-display · 400 · headings, numbers, wordmark</Text></div>
          <div className="motion-float rounded-card bg-surface p-8"><p className="font-sans text-5xl">Inter</p><Text tone="muted" className="mt-3">font-sans · 400, 500 · body, buttons, badges</Text></div>
        </div>
        <div>
          <Row label='<Heading size="display">'><Heading as="h3" size="display">Find Your People</Heading></Row>
          <Row label="<Heading>"><Heading as="h3">Our Constellation</Heading></Row>
          <Row label='<Heading size="title">'><Heading as="h3" size="title">Share What You Do</Heading></Row>
          <Row label="<Statement lead={2}>"><Statement lead={2} text="Every connection makes the whole community stronger." /></Row>
          <Row label="<Stat>"><Stat value="07" label="Neighborhood colors" /></Row>
          <Row label="<Badge>"><Badge>Western Queens</Badge></Row>
          <Row label='<Text size="lg">'><Text size="lg">Large body copy for intros.</Text></Row>
          <Row label="<Text>"><Text>Default body copy stays short and plain.</Text></Row>
          <Row label='<Text tone="muted" size="sm">'><Text tone="muted" size="sm">Captions and fine print.</Text></Row>
        </div>
      </div>
    </Shell>
  );
}
