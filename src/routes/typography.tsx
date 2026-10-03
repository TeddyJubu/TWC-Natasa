import { createFileRoute } from "@tanstack/react-router";
import { Container, Eyebrow, Heading, Section, SectionHeader, Text } from "@/index";
import { Shell } from "@/showcase/Shell";

export const Route = createFileRoute("/typography")({
  head: () => ({
    meta: [
      { title: "Typography — Keepsake Design System" },
      { name: "description", content: "Cormorant Garamond and Karla, and the full Keepsake type scale." },
      { property: "og:title", content: "Typography — Keepsake Design System" },
      { property: "og:description", content: "Serif display headings with a quiet sans for body." },
    ],
  }),
  component: Typography,
});

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid gap-3 border-b border-line py-8 md:grid-cols-[14rem_1fr]">
      <code className="text-xs text-ink-muted">{label}</code>
      <div>{children}</div>
    </div>
  );
}

function Typography() {
  return (
    <Shell>
      <Section>
        <Container className="flex flex-col gap-14">
          <SectionHeader eyebrow="Foundations" title="Typography" />
          <div className="grid gap-6 md:grid-cols-2">
            <div className="rounded-card bg-surface p-8">
              <p className="font-display text-6xl font-light">Cormorant <em className="text-accent">Garamond</em></p>
              <Text className="mt-3">font-display · 300, 400, 500, italic · headings and display only</Text>
            </div>
            <div className="rounded-card bg-surface p-8">
              <p className="font-sans text-5xl">Karla</p>
              <Text className="mt-3">font-sans · 400, 500, 600 · body, labels, buttons</Text>
            </div>
          </div>
          <div>
            <Row label='<Heading size="display">'><Heading as="h3" size="display">Under <em>golden</em> light</Heading></Row>
            <Row label='<Heading size="section">'><Heading as="h3">How the day unfolds</Heading></Row>
            <Row label='<Heading size="title">'><Heading as="h3" size="title">Dinner, dancing & toasts</Heading></Row>
            <Row label="<Eyebrow>"><Eyebrow>Save the Date</Eyebrow></Row>
            <Row label='<Text size="lg">'><Text size="lg">Join us as we gather the people we love most for an evening in the garden.</Text></Row>
            <Row label='<Text tone="default">'><Text tone="default">Body copy stays relaxed and short — two or three sentences per idea.</Text></Row>
            <Row label='<Text size="sm">'><Text size="sm">Kindly reply by the first of May.</Text></Row>
          </div>
        </Container>
      </Section>
    </Shell>
  );
}
