import * as React from "react";
import { createFileRoute } from "@tanstack/react-router";
import * as K from "@/index";
import { Shell, Specimen } from "@/showcase/Shell";
import hero from "@/assets/photography/hero.jpg";
import p1 from "@/assets/photography/portrait-1.jpg";
import p2 from "@/assets/photography/portrait-2.jpg";
import p3 from "@/assets/photography/portrait-3.jpg";
import event from "@/assets/photography/event.jpg";
import flower from "@/assets/illustrations/flower.png";

export const Route = createFileRoute("/components")({
  head: () => ({
    meta: [
      { title: "Components — Bloom Design System" },
      { name: "description", content: "Every Bloom component with its variants and states." },
      { property: "og:title", content: "Components — Bloom Design System" },
      { property: "og:description", content: "Hero, badges, tabs, ribbons, timelines, forms and more." },
    ],
  }),
  component: Components,
});

const sections: { name: string; render: () => React.ReactNode }[] = [
  { name: "Button", render: () => (<>
    <Specimen label='variant="primary|white|ink|sun|outline|link"'>
      {(["primary", "white", "ink", "sun", "outline", "link"] as const).map((v) => <K.Button key={v} variant={v} className={v === "white" ? "border border-line" : ""}>Join now</K.Button>)}
    </Specimen>
    <Specimen label='size="sm|md|lg" · disabled · loading'>
      <K.Button size="sm">Small</K.Button><K.Button>Medium</K.Button><K.Button size="lg">Large</K.Button><K.Button disabled>Disabled</K.Button><K.Button loading>Sending</K.Button>
    </Specimen></>) },
  { name: "Badge", render: () => <Specimen label='variant="soft|glass|solid"'><K.Badge>Our Story</K.Badge><div className="rounded-card bg-sky p-4"><K.Badge variant="glass">Over photos</K.Badge></div><div className="tone-night rounded-card p-4"><K.Badge variant="solid">On night</K.Badge></div></Specimen> },
  { name: "Typography", render: () => <Specimen label="Heading · Statement · Stat · Wordmark"><div className="flex w-full flex-col gap-6"><K.Wordmark>Bloom</K.Wordmark><K.Heading size="title">Evening Mixer</K.Heading><K.Statement lead={1} text="Ink leads, the rest fades away softly." /><K.Stat value="2019" /></div></Specimen> },
  { name: "Hero", render: () => <Specimen label="image · badge · title · info · highlight · nav"><K.Hero className="min-h-0 w-full rounded-card pb-12" image={hero} badge="Community" title="Bold Ideas" description="Short intro line." info={{ image: event, text: "Rooftop Hall" }} highlight={{ value: "24", label: "April" }} /></Specimen> },
  { name: "Navbar", render: () => (<>
    <Specimen label='variant="solid"'><K.Navbar className="static" brand={<K.Wordmark>Bloom</K.Wordmark>} links={[{ label: "About", href: "#" }, { label: "Events", href: "#" }]} action={<K.Button size="sm">Join</K.Button>} /></Specimen>
    <Specimen label='variant="overlay" (on photos)'><div className="relative h-28 w-full overflow-hidden rounded-card bg-sky"><K.Navbar variant="overlay" brand={<K.Wordmark>Bloom</K.Wordmark>} links={[{ label: "About", href: "#" }]} action={<K.Button size="sm" variant="white">Join</K.Button>} /></div></Specimen></>) },
  { name: "Section", render: () => <Specimen label='tone="light|night|dome"'><div className="grid w-full gap-3 md:grid-cols-3">{(["light", "night", "dome"] as const).map((t) => <K.Section key={t} tone={t} className="rounded-b-card border border-line py-10 md:py-12"><p className="text-center font-display text-2xl">{t}</p></K.Section>)}</div></Specimen> },
  { name: "SectionHeader", render: () => <Specimen label="badge · title · intro"><K.SectionHeader badge="Agenda" title="Shape of the Day" intro="Short intro under the headline." /></Specimen> },
  { name: "CurvedGallery", render: () => <Specimen label="images"><K.CurvedGallery className="w-full" images={[{ src: p1, alt: "" }, { src: p2, alt: "" }, { src: p3, alt: "" }]} /></Specimen> },
  { name: "Ribbon", render: () => <Specimen label="text"><K.Ribbon className="w-full" text="Mentorship" /></Specimen> },
  { name: "Tabs", render: () => <Specimen label="items"><K.Tabs className="w-full" items={[{ label: "Mentorship", content: <K.Text>Panel one.</K.Text> }, { label: "Masterclasses", content: <K.Text>Panel two.</K.Text> }, { label: "Gatherings", content: <K.Text>Panel three.</K.Text> }]} /></Specimen> },
  { name: "FeatureCard", render: () => <Specimen label='variant="soft|photo"'><div className="grid w-full gap-3 md:grid-cols-3"><K.FeatureCard tag="Level 12" title="Summit" /><K.FeatureCard variant="photo" image={event} title="Talks & Dinner" description="Over a photo." /><K.FeatureCard tag="7:00 PM" title="Mixer" /></div></Specimen> },
  { name: "BigCountdown", render: () => <Specimen label="target · ornament · unit"><K.BigCountdown className="w-full text-8xl" target="2027-04-24" ornament={flower} /></Specimen> },
  { name: "Timeline", render: () => <Specimen label="items"><K.Timeline className="w-full" items={[{ time: "09:00 AM", title: "Arrival", description: "Coffee.", image: event }, { time: "10:30 AM", title: "Keynote", image: p2 }]} /></Specimen> },
  { name: "ImageFrame", render: () => <Specimen label='shape="card|panel|thumb"'><div className="grid w-full grid-cols-3 gap-4"><K.ImageFrame src={p1} alt="" /><K.ImageFrame src={p2} alt="" shape="panel" /><K.ImageFrame src={p3} alt="" shape="thumb" ratio="square" /></div></Specimen> },
  { name: "Accordion", render: () => <Specimen label="items"><K.Accordion className="w-full" items={[{ question: "Who can apply?", answer: "Anyone building something." }, { question: "Is there a trial?", answer: "Yes, 14 days." }]} /></Specimen> },
  { name: "Form fields", render: () => (<>
    <Specimen label="FormField + Input · hint · error · disabled">
      <div className="grid w-full gap-4 md:grid-cols-3">
        <K.FormField label="Name" htmlFor="a" hint="As on your ID"><K.Input id="a" placeholder="Jane Smith" /></K.FormField>
        <K.FormField label="Email" htmlFor="b" error="Please enter a valid email"><K.Input id="b" aria-invalid defaultValue="jane@" /></K.FormField>
        <K.FormField label="Code" htmlFor="c"><K.Input id="c" disabled placeholder="Locked" /></K.FormField>
      </div>
    </Specimen>
    <Specimen label="Select · Textarea · Checkbox · RadioGroup">
      <div className="grid w-full gap-4 md:grid-cols-2">
        <K.FormField label="Plan" htmlFor="d"><K.Select id="d"><option>Founder</option><option>Studio</option></K.Select></K.FormField>
        <K.FormField label="Message" htmlFor="e"><K.Textarea id="e" placeholder="Tell us more" /></K.FormField>
        <K.Checkbox label="Send me the newsletter" />
        <K.RadioGroup name="r" legend="Billing" defaultValue="y" options={[{ value: "m", label: "Monthly" }, { value: "y", label: "Yearly" }]} />
      </div>
    </Specimen></>) },
  { name: "Footer", render: () => <Specimen label="brand · statement · contacts · links"><K.Footer className="w-full rounded-card" brand={<K.Wordmark>Bloom</K.Wordmark>} statement="A closing line." contacts={[{ label: "Email", value: "hello@example.com" }]} links={[{ label: "Privacy", href: "#" }]} note="© 2027" /></Specimen> },
];

function Components() {
  const [q, setQ] = React.useState("");
  const shown = sections.filter((s) => s.name.toLowerCase().includes(q.toLowerCase()));
  return (
    <Shell>
      <div className="grid gap-10 md:grid-cols-[13rem_1fr]">
        <aside className="md:sticky md:top-8 md:self-start">
          <K.Input aria-label="Search components" placeholder="Search…" value={q} onChange={(e) => setQ(e.target.value)} className="h-11" />
          <nav className="mt-4 flex flex-col">
            {shown.map((s) => <a key={s.name} href={`#${s.name}`} className="rounded-xl px-3 py-1.5 text-sm text-ink-muted hover:bg-surface hover:text-ink">{s.name}</a>)}
          </nav>
        </aside>
        <div className="flex min-w-0 flex-col gap-16">
          {shown.map((s) => (
            <section key={s.name} id={s.name} className="flex scroll-mt-8 flex-col gap-6">
              <K.Heading size="title">{s.name}</K.Heading>
              {s.render()}
            </section>
          ))}
        </div>
      </div>
    </Shell>
  );
}
