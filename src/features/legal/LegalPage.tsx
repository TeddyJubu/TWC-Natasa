import * as React from "react";
import { Link } from "@tanstack/react-router";
import { Container, FormNotice, Section, SectionHeader, Text } from "@/index";
import { AppFooter, AppNav, AppPage } from "@/app/layout/AppLayout";
import type { Block, LegalDoc, Rich } from "./content";

const links = [
  { label: "Our mission", href: "/#mission" },
  { label: "Members", href: "/members" },
  { label: "Join", href: "/join" },
];

function RichText({ value }: { value: Rich }) {
  if (typeof value === "string") return value;
  return value.map((part, i) =>
    typeof part === "string" ? <React.Fragment key={i}>{part}</React.Fragment>
    : "strong" in part ? <strong key={i} className="font-medium">{part.strong}</strong>
    : <Link key={i} to={part.href} className="underline underline-offset-4 hover:text-ink-muted">{part.text}</Link>,
  );
}

function LegalBlock({ block }: { block: Block }) {
  if ("h3" in block) return <h3 className="mt-4 font-display text-2xl font-normal text-ink">{block.h3}</h3>;
  if ("ul" in block) {
    return (
      <ul className="flex list-disc flex-col gap-2 pl-5 marker:text-ink-muted">
        {block.ul.map((item, i) => <li key={i}><RichText value={item} /></li>)}
      </ul>
    );
  }
  if ("note" in block) {
    return (
      <aside className="border-l border-line pl-4 text-sm leading-relaxed text-ink-muted">
        <span className="font-medium">{block.note}</span> {block.text}
      </aside>
    );
  }
  return <Text className="leading-relaxed"><RichText value={block.p} /></Text>;
}

/** /privacy, /terms and /code-of-conduct: badge and serif title, an "On this page" list, numbered sections. */
export function LegalPage({ doc }: { doc: LegalDoc }) {
  return (
    <AppPage>
      <AppNav variant="solid" links={links} />
      <main id="main" tabIndex={-1} className="outline-none">
        <Section className="pt-14 md:pt-20">
          <Container className="flex flex-col items-center gap-6">
            <SectionHeader headingAs="h1" badge={doc.badge} title={doc.title} intro={doc.lede} />
            <p className="text-sm text-ink-muted">Last updated {doc.updated} · Version {doc.version}</p>
          </Container>
        </Section>
        <Section className="pt-0 md:pt-0">
          <Container className="grid gap-12 lg:grid-cols-[13rem_minmax(0,42rem)] lg:justify-center lg:gap-20">
            <nav aria-label="On this page" className="lg:sticky lg:top-32 lg:self-start">
              <p className="mb-4 text-xs font-medium uppercase text-ink-muted">On this page</p>
              <ol className="flex flex-col gap-2 text-sm">
                {doc.sections.map((s) => <li key={s.id}><a href={`#${s.id}`} className="text-ink-muted transition-colors hover:text-ink">{s.toc}</a></li>)}
              </ol>
            </nav>
            <div className="flex min-w-0 flex-col gap-14">
              <FormNotice headingAs="h2" title={doc.template.title}>{doc.template.text}</FormNotice>
              {doc.sections.map((s, i) => (
                <section key={s.id} id={s.id} aria-labelledby={`${s.id}-title`} className="scroll-mt-32 border-t border-line pt-6">
                  <h2 id={`${s.id}-title`} className="font-display text-3xl font-normal leading-tight text-ink">{i + 1}. {s.title}</h2>
                  <div className="mt-6 flex flex-col gap-4 text-ink">
                    {s.blocks.map((block, j) => <LegalBlock key={j} block={block} />)}
                  </div>
                </section>
              ))}
            </div>
          </Container>
        </Section>
      </main>
      <AppFooter links={[{ label: "Home", href: "/" }, { label: "Members", href: "/members" }, { label: "Join", href: "/join" }]} />
    </AppPage>
  );
}
