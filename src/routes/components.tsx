import * as React from "react";
import { createFileRoute } from "@tanstack/react-router";
import * as K from "@/index";
import { Shell, Specimen } from "@/showcase/Shell";
import bouquet from "@/assets/photography/bouquet.jpg";
import table from "@/assets/photography/table.jpg";

export const Route = createFileRoute("/components")({
  head: () => ({
    meta: [
      { title: "Components — Keepsake Design System" },
      { name: "description", content: "Every Keepsake component with its variants and states." },
      { property: "og:title", content: "Components — Keepsake Design System" },
      { property: "og:description", content: "Buttons, cards, schedules, forms and more." },
    ],
  }),
  component: Components,
});

const sections: { name: string; render: () => React.ReactNode }[] = [
  { name: "Button", render: () => (<>
    <Specimen label='variant="solid|accent|outline|ghost|link"'>
      {(["solid", "accent", "outline", "ghost", "link"] as const).map((v) => <K.Button key={v} variant={v}>Reply</K.Button>)}
    </Specimen>
    <Specimen label='size="sm|md|lg" · disabled · loading'>
      <K.Button size="sm">Small</K.Button><K.Button>Medium</K.Button><K.Button size="lg">Large</K.Button>
      <K.Button disabled>Disabled</K.Button><K.Button variant="accent" loading>Sending</K.Button>
    </Specimen></>) },
  { name: "Typography", render: () => <Specimen label="Eyebrow · Heading · Text"><div className="flex flex-col gap-2"><K.Eyebrow>Our Story</K.Eyebrow><K.Heading size="title">A quiet beginning</K.Heading><K.Text>Short, warm copy.</K.Text></div></Specimen> },
  { name: "Divider", render: () => <Specimen label="ornament · ornament={false}"><div className="flex w-full flex-col gap-6"><K.Divider /><K.Divider ornament={false} /></div></Specimen> },
  { name: "Monogram", render: () => <Specimen label='size="sm|md|lg"'><K.Monogram>E&J</K.Monogram><K.Monogram size="md">E&J</K.Monogram><K.Monogram size="lg">E&J</K.Monogram></Specimen> },
  { name: "ImageFrame", render: () => <Specimen label='shape="arch|rounded|circle"'><div className="grid w-full grid-cols-3 gap-4"><K.ImageFrame src={bouquet} alt="Roses" /><K.ImageFrame src={bouquet} alt="Roses" shape="rounded" /><K.ImageFrame src={bouquet} alt="Roses" shape="circle" ratio="auto" /></div></Specimen> },
  { name: "SectionHeader", render: () => <Specimen label="align=center|start"><K.SectionHeader eyebrow="Schedule" title="How the day unfolds" intro="A gentle rhythm from arrival to farewell." /></Specimen> },
  { name: "EventCard", render: () => <Specimen label='variant="outline|filled|ink"'><div className="grid w-full gap-4 md:grid-cols-3">{(["outline", "filled", "ink"] as const).map((v) => <K.EventCard key={v} variant={v} image={v === "outline" ? table : undefined} label="Reception" title="Supper on the lawn" details={[{ term: "Time", value: "7:00 PM" }]} />)}</div></Specimen> },
  { name: "Timeline", render: () => <Specimen label="items"><K.Timeline items={[{ date: "2019", label: "First hello" }, { date: "2024", label: "The question" }]} /></Specimen> },
  { name: "Countdown", render: () => <Specimen label="target"><K.Countdown target="2027-06-12T16:00:00" className="w-full" /></Specimen> },
  { name: "Schedule", render: () => <Specimen label="items"><K.Schedule className="w-full" items={[{ time: "4:00 PM", title: "Ceremony", description: "Promises under the walnut tree.", image: bouquet }, { time: "7:00 PM", title: "Supper" }]} /></Specimen> },
  { name: "Gallery", render: () => <Specimen label="images"><K.Gallery className="w-full" images={[{ src: bouquet, alt: "Roses" }, { src: table, alt: "Table" }, { src: table, alt: "Table" }]} /></Specimen> },
  { name: "Accordion", render: () => <Specimen label="items"><K.Accordion className="w-full" items={[{ question: "Is there parking?", answer: "Yes, from 3 PM." }, { question: "Can I bring a guest?", answer: "If your invitation names one." }]} /></Specimen> },
  { name: "Form fields", render: () => (<>
    <Specimen label="FormField + Input · hint · error · disabled">
      <div className="grid w-full gap-4 md:grid-cols-3">
        <K.FormField label="Name" htmlFor="a" hint="As on the invitation"><K.Input id="a" placeholder="Eleanor Hart" /></K.FormField>
        <K.FormField label="Email" htmlFor="b" error="Please enter a valid email"><K.Input id="b" aria-invalid defaultValue="eleanor@" /></K.FormField>
        <K.FormField label="Code" htmlFor="c"><K.Input id="c" disabled placeholder="Locked" /></K.FormField>
      </div>
    </Specimen>
    <Specimen label="Select · Textarea · Checkbox · RadioGroup">
      <div className="grid w-full gap-4 md:grid-cols-2">
        <K.FormField label="Meal" htmlFor="d"><K.Select id="d"><option>Garden vegetable</option><option>Roast chicken</option></K.Select></K.FormField>
        <K.FormField label="Note" htmlFor="e"><K.Textarea id="e" placeholder="Anything we should know?" /></K.FormField>
        <K.Checkbox label="I'll need a ride from the station" />
        <K.RadioGroup name="r" legend="Attending" defaultValue="yes" options={[{ value: "yes", label: "Yes" }, { value: "no", label: "No" }]} />
      </div>
    </Specimen></>) },
  { name: "Navbar & Footer", render: () => (<>
    <Specimen label="Navbar"><K.Navbar className="static w-full" brand={<K.Monogram>E&J</K.Monogram>} links={[{ label: "Story", href: "#" }, { label: "Schedule", href: "#" }]} action={<K.Button size="sm" variant="accent">Reply</K.Button>} /></Specimen>
    <Specimen label="Footer"><K.Footer className="w-full" brand={<K.Monogram size="md">E&J</K.Monogram>} statement="Thank you for being part of our story." note="© 2027" links={[{ label: "Privacy", href: "#" }]} /></Specimen></>) },
];

function Components() {
  const [q, setQ] = React.useState("");
  const shown = sections.filter((s) => s.name.toLowerCase().includes(q.toLowerCase()));
  return (
    <Shell>
      <K.Container width="wide" className="grid gap-10 py-12 md:grid-cols-[14rem_1fr]">
        <aside className="md:sticky md:top-20 md:self-start">
          <K.Input aria-label="Search components" placeholder="Search…" value={q} onChange={(e) => setQ(e.target.value)} className="h-10" />
          <nav className="mt-4 flex flex-col">
            {shown.map((s) => <a key={s.name} href={`#${s.name}`} className="rounded-soft px-3 py-1.5 text-sm text-ink-muted hover:bg-surface hover:text-ink">{s.name}</a>)}
          </nav>
        </aside>
        <div className="flex flex-col gap-16">
          {shown.map((s) => (
            <section key={s.name} id={s.name} className="flex scroll-mt-24 flex-col gap-6">
              <K.Heading size="title">{s.name}</K.Heading>
              {s.render()}
            </section>
          ))}
        </div>
      </K.Container>
    </Shell>
  );
}
