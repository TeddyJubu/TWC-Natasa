import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "../lib/utils";
import { Eyebrow, Heading, Text } from "./typography";

const frameVariants = cva("overflow-hidden bg-surface", {
  variants: {
    shape: { arch: "rounded-arch", rounded: "rounded-card", circle: "rounded-full aspect-square" },
    ratio: { portrait: "aspect-[4/5]", square: "aspect-square", landscape: "aspect-[5/4]", auto: "" },
  },
  defaultVariants: { shape: "arch", ratio: "portrait" },
});
export interface ImageFrameProps extends React.ImgHTMLAttributes<HTMLImageElement>, VariantProps<typeof frameVariants> {
  alt: string;
}
export const ImageFrame = React.forwardRef<HTMLImageElement, ImageFrameProps>(({ className, shape, ratio, alt, ...p }, ref) => (
  <div className={cn(frameVariants({ shape, ratio }), className)}>
    <img ref={ref} alt={alt} loading="lazy" className="size-full object-cover" {...p} />
  </div>
));
ImageFrame.displayName = "ImageFrame";

export interface HeroProps extends Omit<React.HTMLAttributes<HTMLElement>, "title"> {
  eyebrow?: React.ReactNode;
  title: React.ReactNode;
  description?: React.ReactNode;
  meta?: React.ReactNode[];
  media?: React.ReactNode;
  actions?: React.ReactNode;
}
export const Hero = React.forwardRef<HTMLElement, HeroProps>(
  ({ className, eyebrow, title, description, meta = [], media, actions, ...p }, ref) => (
    <section ref={ref} className={cn("px-6 pb-20 pt-16 md:px-10 md:pt-24", className)} {...p}>
      <div className="mx-auto flex max-w-4xl animate-rise flex-col items-center gap-6 text-center">
        {eyebrow && <Eyebrow>{eyebrow}</Eyebrow>}
        <Heading as="h1" size="display">{title}</Heading>
        {description && <Text size="lg" className="max-w-xl">{description}</Text>}
        {meta.length > 0 && (
          <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 font-display text-xl italic text-ink">
            {meta.map((m, i) => (
              <React.Fragment key={i}>
                {i > 0 && <span aria-hidden className="text-accent">·</span>}
                <span>{m}</span>
              </React.Fragment>
            ))}
          </div>
        )}
        {actions && <div className="flex gap-3 pt-2">{actions}</div>}
      </div>
      {media && <div className="mx-auto mt-14 max-w-md">{media}</div>}
    </section>
  ),
);
Hero.displayName = "Hero";

export interface Milestone { label: string; date: string; description?: string }
export interface TimelineProps extends React.HTMLAttributes<HTMLOListElement> { items: Milestone[] }
export const Timeline = React.forwardRef<HTMLOListElement, TimelineProps>(({ className, items, ...p }, ref) => (
  <ol ref={ref} className={cn("relative flex flex-col gap-8 border-l border-line pl-8", className)} {...p}>
    {items.map((m) => (
      <li key={m.label} className="relative">
        <span aria-hidden className="absolute -left-[37px] top-2 size-2.5 rounded-full bg-accent ring-4 ring-paper" />
        <p className="font-display text-sm italic text-accent">{m.date}</p>
        <h3 className="font-display text-2xl text-ink">{m.label}</h3>
        {m.description && <Text size="sm" className="mt-1">{m.description}</Text>}
      </li>
    ))}
  </ol>
));
Timeline.displayName = "Timeline";

const cardVariants = cva("flex flex-col overflow-hidden rounded-card transition-transform duration-500 ease-[var(--ease-gentle)]", {
  variants: {
    variant: {
      outline: "border border-line bg-paper",
      filled: "bg-surface",
      ink: "bg-ink text-paper [&_h3]:text-paper [&_p]:text-paper/75",
    },
  },
  defaultVariants: { variant: "outline" },
});
export interface EventCardProps extends React.HTMLAttributes<HTMLElement>, VariantProps<typeof cardVariants> {
  label: string;
  title: string;
  details: { term: string; value: string }[];
  image?: string;
  imageAlt?: string;
}
export const EventCard = React.forwardRef<HTMLElement, EventCardProps>(
  ({ className, variant, label, title, details, image, imageAlt = "", children, ...p }, ref) => (
    <article ref={ref} className={cn(cardVariants({ variant }), "hover:-translate-y-1", className)} {...p}>
      {image && <img src={image} alt={imageAlt} loading="lazy" className="aspect-[16/10] w-full object-cover" />}
      <div className="flex flex-1 flex-col gap-4 p-8">
        <Eyebrow>{label}</Eyebrow>
        <h3 className="font-display text-3xl leading-tight text-ink">{title}</h3>
        <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-2 text-sm">
          {details.map((d) => (
            <React.Fragment key={d.term}>
              <dt className="uppercase tracking-widest text-ink-muted opacity-80">{d.term}</dt>
              <dd className="text-ink">{d.value}</dd>
            </React.Fragment>
          ))}
        </dl>
        {children}
      </div>
    </article>
  ),
);
EventCard.displayName = "EventCard";

export interface CountdownProps extends React.HTMLAttributes<HTMLDivElement> {
  target: Date | string;
}
export const Countdown = React.forwardRef<HTMLDivElement, CountdownProps>(({ className, target, ...p }, ref) => {
  const t = new Date(target).getTime();
  const [now, setNow] = React.useState<number | null>(null);
  React.useEffect(() => {
    setNow(Date.now());
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  const diff = now === null ? 0 : Math.max(0, t - now);
  const units = [
    ["Days", Math.floor(diff / 864e5)],
    ["Hours", Math.floor(diff / 36e5) % 24],
    ["Minutes", Math.floor(diff / 6e4) % 60],
    ["Seconds", Math.floor(diff / 1e3) % 60],
  ] as const;
  return (
    <div ref={ref} role="timer" className={cn("grid grid-cols-4 gap-3 md:gap-6", className)} {...p}>
      {units.map(([label, v]) => (
        <div key={label} className="flex flex-col items-center gap-1 rounded-card border border-line px-2 py-5">
          <span className="font-display text-4xl tabular-nums text-ink md:text-6xl">{now === null ? "—" : String(v).padStart(2, "0")}</span>
          <span className="text-[0.7rem] uppercase tracking-[var(--tracking-eyebrow)] text-ink-muted">{label}</span>
        </div>
      ))}
    </div>
  );
});
Countdown.displayName = "Countdown";

export interface ScheduleItem { time: string; title: string; description?: string; image?: string }
export interface ScheduleProps extends React.HTMLAttributes<HTMLOListElement> { items: ScheduleItem[] }
export const Schedule = React.forwardRef<HTMLOListElement, ScheduleProps>(({ className, items, ...p }, ref) => (
  <ol ref={ref} className={cn("divide-y divide-line border-y border-line", className)} {...p}>
    {items.map((it) => (
      <li key={it.time + it.title} className="group grid grid-cols-[5.5rem_1fr] items-center gap-6 py-6 md:grid-cols-[8rem_1fr_6rem]">
        <span className="font-display text-xl italic text-accent">{it.time}</span>
        <div>
          <h3 className="font-display text-2xl text-ink">{it.title}</h3>
          {it.description && <Text size="sm" className="mt-1 max-w-lg">{it.description}</Text>}
        </div>
        {it.image && (
          <img src={it.image} alt="" loading="lazy" className="hidden size-20 rounded-full object-cover grayscale-[40%] transition duration-500 group-hover:grayscale-0 md:block" />
        )}
      </li>
    ))}
  </ol>
));
Schedule.displayName = "Schedule";

export interface GalleryProps extends React.HTMLAttributes<HTMLDivElement> {
  images: { src: string; alt: string }[];
}
export const Gallery = React.forwardRef<HTMLDivElement, GalleryProps>(({ className, images, ...p }, ref) => (
  <div ref={ref} className={cn("grid grid-cols-2 gap-4 md:grid-cols-[1fr_1fr_1.5fr]", className)} {...p}>
    {images.map((im, i) => (
      <ImageFrame key={im.src + i} src={im.src} alt={im.alt} shape={i === 0 ? "arch" : "rounded"} ratio="portrait" className={cn(i === 2 && "col-span-2 md:col-span-1")} />
    ))}
  </div>
));
Gallery.displayName = "Gallery";

export interface AccordionItem { question: string; answer: React.ReactNode }
export interface AccordionProps extends React.HTMLAttributes<HTMLDivElement> { items: AccordionItem[] }
export const Accordion = React.forwardRef<HTMLDivElement, AccordionProps>(({ className, items, ...p }, ref) => (
  <div ref={ref} className={cn("divide-y divide-line border-y border-line", className)} {...p}>
    {items.map((it) => (
      <details key={it.question} className="group">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-6 py-5 font-display text-xl text-ink focus-visible:text-accent focus-visible:outline-none [&::-webkit-details-marker]:hidden">
          {it.question}
          <span aria-hidden className="text-2xl text-accent transition-transform duration-300 group-open:rotate-45">+</span>
        </summary>
        <div className="pb-6 pr-10"><Text>{it.answer}</Text></div>
      </details>
    ))}
  </div>
));
Accordion.displayName = "Accordion";
