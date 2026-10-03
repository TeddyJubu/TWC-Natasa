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
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
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
  { name: "Input", render: () => <Specimen label='variant="editorial|boxed" · default · filled · focused · error · disabled'>
    <div className="grid w-full gap-8 md:grid-cols-2 lg:grid-cols-3">
      <K.FormField index="01" label="Full name" htmlFor="input-default" hint="Use the name you introduce yourself with."><K.Input id="input-default" aria-describedby="input-default-hint" placeholder="Your name" /></K.FormField>
      <K.FormField index="02" label="Studio" htmlFor="input-filled"><K.Input id="input-filled" defaultValue="Common Thread Studio" /></K.FormField>
      <K.FormField index="03" label="Email" htmlFor="input-error" error="Enter a complete email address."><K.Input id="input-error" aria-invalid aria-describedby="input-error-error" defaultValue="maya@studio" /></K.FormField>
      <K.FormField label="Location" htmlFor="input-boxed"><K.Input id="input-boxed" variant="boxed" placeholder="City, country" /></K.FormField>
      <K.FormField label="Member code" htmlFor="input-disabled"><K.Input id="input-disabled" variant="boxed" disabled value="Assigned after review" readOnly /></K.FormField>
      <K.FormField label="Focus preview" htmlFor="input-focus"><K.Input id="input-focus" variant="boxed" className="border-sky ring-2 ring-ring/20" value="Active field" readOnly /></K.FormField>
    </div>
  </Specimen> },
  { name: "Textarea", render: () => <Specimen label='variant="editorial|boxed" · resize enabled'>
    <div className="grid w-full gap-8 md:grid-cols-2"><K.FormField index="04" label="The work" htmlFor="textarea-a" hint="A few sentences are enough."><K.Textarea id="textarea-a" placeholder="Tell us what you are building and why it matters…" /></K.FormField><K.FormField label="A recent win" htmlFor="textarea-b"><K.Textarea id="textarea-b" variant="boxed" defaultValue="We brought our first collection into three independent stores." /></K.FormField></div>
  </Specimen> },
  { name: "Select", render: () => <Specimen label='variant="editorial|boxed"'>
    <div className="grid w-full gap-8 md:grid-cols-2"><K.FormField index="05" label="Business stage" htmlFor="select-a"><K.Select id="select-a" defaultValue="growing"><option value="starting">Starting out</option><option value="growing">Growing steadily</option><option value="scaling">Scaling a team</option></K.Select></K.FormField><K.FormField label="Time zone" htmlFor="select-b"><K.Select id="select-b" variant="boxed"><option>Europe / London</option><option>America / New York</option><option>Asia / Singapore</option></K.Select></K.FormField></div>
  </Specimen> },
  { name: "Checkbox", render: () => <Specimen label="label · description · checked · disabled">
    <div className="grid w-full gap-6 md:grid-cols-3"><K.Checkbox label="Monthly field notes" description="A considered edit of events and member stories." defaultChecked /><K.Checkbox label="Partner introductions" description="Occasional introductions when there is a clear fit." /><K.Checkbox label="Applications closed" disabled /></div>
  </Specimen> },
  { name: "RadioGroup", render: () => <Specimen label='variant="pills|list"'>
    <div className="grid w-full gap-10 md:grid-cols-2"><K.RadioGroup name="membership-format" legend="Preferred gathering" defaultValue="studio" options={[{ value: "studio", label: "Studio table" }, { value: "salon", label: "Evening salon" }, { value: "online", label: "Online circle" }]} /><K.RadioGroup variant="list" name="membership-pace" legend="Your current pace" defaultValue="building" options={[{ value: "forming", label: "Forming the idea" }, { value: "building", label: "Building momentum" }, { value: "expanding", label: "Expanding the team" }]} /></div>
  </Specimen> },
  { name: "Switch", render: () => <Specimen label="label · description · checked · disabled">
    <div className="grid w-full gap-6 md:grid-cols-2"><K.Switch label="Open to introductions" description="Let the membership team suggest thoughtful connections." defaultChecked /><K.Switch label="Pause event reminders" description="This setting is managed by your studio lead." disabled /></div>
  </Specimen> },
  { name: "FileUpload", render: () => <Specimen label="accept · multiple · disabled">
    <div className="grid w-full gap-6 md:grid-cols-2"><K.FileUpload label="Add a portrait or studio image" hint="JPG or PNG · up to 8 MB" accept="image/png,image/jpeg" /><K.FileUpload label="Supporting work" hint="PDF · up to 12 MB" accept="application/pdf" /></div>
  </Specimen> },
  { name: "Application form", render: () => <Specimen label="FormSection + FormField + FormActions · responsive editorial composition" className="[&>div:first-child]:p-0">
    <form className="tone-light grid w-full overflow-hidden bg-paper lg:grid-cols-3" onSubmit={(e) => e.preventDefault()}>
      <div className="flex min-h-[34rem] flex-col justify-between bg-signal p-7 text-ink md:p-9">
        <div><span className="font-sans text-xs font-medium uppercase">01 — Application</span><h3 className="mt-12 font-display text-5xl font-normal leading-none md:text-6xl">Your Next<br /><em>Chapter</em></h3><p className="mt-6 max-w-xs font-sans text-sm leading-relaxed">A focused application for founders shaping useful, original work.</p></div>
        <div className="flex items-end justify-between border-t border-ink/20 pt-5"><span className="font-sans text-xs uppercase">Bloom membership</span><span className="font-display text-4xl">01</span></div>
      </div>
      <K.FormSection index="02 — Details" title="Introduce Yourself" description="The essentials first." className="border-t-0 p-7 md:p-9">
        <div className="flex flex-col gap-9"><K.FormField index="01" label="Full name" htmlFor="application-name"><K.Input id="application-name" placeholder="Your name" /></K.FormField><K.FormField index="02" label="Work email" htmlFor="application-email"><K.Input id="application-email" type="email" placeholder="you@company.com" /></K.FormField><K.FormField index="03" label="Business stage" htmlFor="application-stage"><K.Select id="application-stage"><option>Choose one</option><option>Starting out</option><option>Growing steadily</option><option>Scaling a team</option></K.Select></K.FormField><K.RadioGroup name="application-focus" legend="What brings you here?" defaultValue="peers" options={[{ value: "peers", label: "Peers" }, { value: "ideas", label: "Ideas" }, { value: "growth", label: "Growth" }]} /></div>
      </K.FormSection>
      <K.FormSection index="03 — Perspective" title="Tell Us More" description="There are no perfect answers." className="border-t-0 bg-canvas p-7 md:p-9">
        <div className="flex h-full flex-col gap-8"><K.FormField index="04" label="What are you building?" htmlFor="application-story"><K.Textarea id="application-story" placeholder="The idea, the ambition, the honest version…" /></K.FormField><K.FileUpload label="Add a portrait" hint="JPG or PNG · optional" accept="image/png,image/jpeg" /><K.Checkbox label="Keep me in the loop" description="Occasional field notes, never noise." defaultChecked /><K.FormActions className="mt-auto"><K.Button type="button" variant="link">Save for later</K.Button><K.Button type="submit" variant="ink" className="min-w-44">Send application <span aria-hidden>↗</span></K.Button></K.FormActions></div>
      </K.FormSection>
    </form>
  </Specimen> },
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
            {shown.map((s) => <a key={s.name} href={`#${s.name}`} className="rounded-xl px-3 py-1.5 text-sm text-ink-muted transition-[transform,background-color,color] duration-300 ease-[var(--ease-snap)] hover:translate-x-1 hover:bg-surface hover:text-ink motion-reduce:transform-none">{s.name}</a>)}
          </nav>
        </aside>
        <div className="flex min-w-0 flex-col gap-16">
          {shown.map((s) => (
            <section key={s.name} id={s.name} className="motion-scroll-reveal flex scroll-mt-8 flex-col gap-6">
              <K.Heading size="title">{s.name}</K.Heading>
              {s.render()}
            </section>
          ))}
        </div>
      </div>
    </Shell>
  );
}
