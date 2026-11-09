import * as React from "react";
import { Link } from "@tanstack/react-router";
import { AppFooter, AppNav, AppPage } from "@/app/layout/AppLayout";
import { codeOfConduct, privacy, terms, type Block, type LegalDoc, type Rich } from "./content";

const DOCS = [
  { to: "/privacy", label: "Privacy policy", doc: privacy },
  { to: "/terms", label: "Terms of membership", doc: terms },
  { to: "/code-of-conduct", label: "Code of conduct", doc: codeOfConduct },
] as const;

const num = (i: number) => String(i + 1).padStart(2, "0");
const focusRing = "outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sb-blue-ink";

function RichText({ value }: { value: Rich }) {
  if (typeof value === "string") return value;
  return value.map((part, i) =>
    typeof part === "string" ? <React.Fragment key={i}>{part}</React.Fragment>
    : "strong" in part ? <strong key={i} className="font-semibold">{part.strong}</strong>
    : <Link key={i} to={part.href} className={`twc-inlink ${focusRing}`}>{part.text}</Link>,
  );
}

function LegalBlock({ block }: { block: Block }) {
  if ("h3" in block) return <h3 className="mt-2 font-display text-xl leading-snug">{block.h3}</h3>;
  if ("ul" in block) {
    return (
      <ul className="flex list-disc flex-col gap-2 pl-5 marker:text-sb-muted">
        {block.ul.map((item, i) => <li key={i}><RichText value={item} /></li>)}
      </ul>
    );
  }
  if ("note" in block) {
    return (
      <aside className="border-l border-sb-ink/15 pl-4 text-sm leading-relaxed text-sb-muted">
        <span className="font-semibold">{block.note}</span> {block.text}
      </aside>
    );
  }
  return <p><RichText value={block.p} /></p>;
}

/** The section whose heading was last scrolled past, for the "On this page" highlight. */
function useActiveSection(ids: readonly string[]) {
  const [active, setActive] = React.useState(ids[0]);
  React.useEffect(() => {
    const els = ids.map((id) => document.getElementById(id)).filter((el) => el !== null);
    const io = new IntersectionObserver(
      (entries) => {
        const hit = entries.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
        if (hit) setActive(hit.target.id);
      },
      { rootMargin: "-110px 0px -60% 0px" },
    );
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, [ids]);
  return active;
}

/** /privacy, /terms and /code-of-conduct: document tabs, eyebrow + h1, the TEMPLATE flag, a sticky
 *  "On this page" list and numbered sections. */
export function LegalPage({ doc }: { doc: LegalDoc }) {
  const current = DOCS.find((d) => d.doc === doc);
  const ids = React.useMemo(() => doc.sections.map((s) => s.id), [doc]);
  const active = useActiveSection(ids);
  return (
    <AppPage>
      <AppNav />
      <main id="main" tabIndex={-1} className="twc-wrap flex flex-col gap-12 pb-[104px] pt-14 outline-none">
        <div className="flex flex-col gap-8">
          <nav aria-label="Legal documents" className="flex flex-wrap gap-2">
            {DOCS.map((d) => (
              <Link
                key={d.to}
                to={d.to}
                aria-current={d.doc === doc ? "page" : undefined}
                className={`twc-choice text-sb-ink no-underline hover:shadow-[inset_0_0_0_1px_var(--color-sb-ink)] aria-[current=page]:bg-sb-ink aria-[current=page]:text-sb-paper aria-[current=page]:shadow-none ${focusRing}`}
              >
                {d.label}
              </Link>
            ))}
          </nav>
          <div className="flex max-w-[820px] flex-col gap-4">
            {current && <span className="twc-eyebrow">{current.label}</span>}
            <h1 className="text-balance font-display text-[42px] leading-[1.03] tracking-[-1px] md:text-[64px]">{doc.title}</h1>
            <p className="twc-lede max-w-[60ch]">{doc.lede}</p>
            <p className="font-fragment text-[13px] uppercase leading-[19.5px] tracking-[1px] text-sb-muted">
              Last updated {doc.updated} · Version {doc.version}
            </p>
            <div role="note" aria-labelledby="template-title" className="flex max-w-[65ch] flex-col gap-1.5 self-start rounded-md bg-sb-sun px-[18px] py-3 text-sb-ink">
              <h2 id="template-title" className="font-fragment text-[13px] leading-normal tracking-[1px]">{doc.template.title}</h2>
              <p className="text-sm leading-relaxed">{doc.template.text}</p>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-start gap-14 border-t border-sb-ink/15 pt-10">
          <nav aria-label="On this page" className="flex min-w-0 max-w-[260px] flex-[1_1_220px] flex-col gap-0.5 max-lg:max-w-none lg:sticky lg:top-[104px]">
            <span className="twc-eyebrow">On this page</span>
            <ol className="mt-2 flex flex-col">
              {doc.sections.map((s, i) => (
                <li key={s.id}>
                  <a
                    href={`#${s.id}`}
                    aria-current={active === s.id ? "true" : undefined}
                    className={`flex items-baseline gap-3 border-b border-sb-ink/15 py-[7px] text-sm leading-[1.4] text-sb-ink no-underline hover:text-sb-blue-ink aria-[current=true]:font-semibold ${focusRing}`}
                  >
                    <span className="twc-index min-w-5 text-xs">{num(i)}</span> {s.toc}
                  </a>
                </li>
              ))}
            </ol>
          </nav>
          <article className="flex min-w-0 max-w-[65ch] flex-[999_1_480px] flex-col gap-11 text-[17px] leading-[1.65]">
            {doc.sections.map((s, i) => (
              <section key={s.id} id={s.id} aria-labelledby={`${s.id}-title`} className="flex scroll-mt-28 flex-col gap-3.5">
                <h2 id={`${s.id}-title`} className="flex items-baseline gap-3.5 font-display text-[26px] leading-tight">
                  <span className="twc-index">{num(i)}</span> {s.title}
                </h2>
                {s.blocks.map((block, j) => <LegalBlock key={j} block={block} />)}
              </section>
            ))}
          </article>
        </div>
      </main>
      <AppFooter />
    </AppPage>
  );
}
