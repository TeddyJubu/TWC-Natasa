import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "../lib/utils";
import { Badge, Blossom, Heading, Text } from "./typography";

/* ---------- ImageFrame ---------- */
const frameVariants = cva("overflow-hidden bg-surface", {
  variants: {
    shape: { card: "rounded-card", panel: "rounded-panel", thumb: "rounded-2xl" },
    ratio: { portrait: "aspect-[4/5]", square: "aspect-square", landscape: "aspect-[4/3]", auto: "" },
  },
  defaultVariants: { shape: "card", ratio: "portrait" },
});
export interface ImageFrameProps extends React.ImgHTMLAttributes<HTMLImageElement>, VariantProps<typeof frameVariants> {
  alt: string;
}
export const ImageFrame = React.forwardRef<HTMLImageElement, ImageFrameProps>(({ className, shape, ratio, alt, ...p }, ref) => (
  <div className={cn(frameVariants({ shape, ratio }), "group", className)}>
    <img ref={ref} alt={alt} loading="lazy" className="size-full object-cover transition-transform duration-700 ease-[var(--ease-gentle)] group-hover:scale-[1.03] motion-reduce:transform-none motion-reduce:transition-none" {...p} />
  </div>
));
ImageFrame.displayName = "ImageFrame";

/* ---------- Hero ---------- */
export interface HeroProps extends Omit<React.HTMLAttributes<HTMLElement>, "title"> {
  image: string;
  imageAlt?: string;
  badge?: React.ReactNode;
  title: React.ReactNode;
  description?: React.ReactNode;
  /** Glass info card at the bottom (thumbnail + caption). */
  info?: { image?: string; text: React.ReactNode };
  /** Big stat beside the info card, e.g. a date. */
  highlight?: { value: string; label: string };
  nav?: React.ReactNode;
}
export const Hero = React.forwardRef<HTMLElement, HeroProps>(
  ({ className, image, imageAlt = "", badge, title, description, info, highlight, nav, ...p }, ref) => (
    <section ref={ref} className={cn("relative isolate min-h-[60rem] overflow-hidden bg-sky text-white", className)} {...p}>
      <img src={image} alt={imageAlt} className="absolute inset-0 -z-10 size-full object-cover" />
      <div aria-hidden className="absolute inset-0 -z-10 bg-sky-fade" />
      <div aria-hidden className="absolute inset-x-0 bottom-0 -z-10 h-48 bg-gradient-to-t from-canvas to-transparent" />
      {nav}
      <div className="mx-auto grid max-w-[80rem] gap-10 px-6 pt-44 md:grid-cols-[1fr_auto] md:items-end md:px-[4.5rem]">
        <div className="motion-stagger flex flex-col items-start gap-8">
          {badge && <Badge variant="glass">{badge}</Badge>}
          <Heading as="h1" size="display" className="max-w-2xl text-white">{title}</Heading>
        </div>
        {description && <Text size="md" className="motion-reveal max-w-[15rem] pb-4 text-white md:text-right">{description}</Text>}
      </div>
      {(info || highlight) && (
        <>
          <div aria-hidden className="mt-24 h-px w-full bg-white/60" />
          <div className="mx-auto flex max-w-3xl flex-wrap items-center justify-center gap-6 px-6 pt-14">
            {info && (
              <div className="motion-float flex items-center gap-5 rounded-card border border-glass-line bg-glass p-3 pr-6 backdrop-blur-md">
                {info.image && <img src={info.image} alt="" className="size-32 rounded-xl object-cover" />}
                <p className="max-w-40 text-base">{info.text}</p>
              </div>
            )}
            {highlight && (
              <div className="flex flex-col items-center gap-1 border-l border-white/70 px-6 py-4">
                <span className="font-display text-7xl leading-none">{highlight.value}</span>
                <span className="text-base">{highlight.label}</span>
              </div>
            )}
          </div>
        </>
      )}
    </section>
  ),
);
Hero.displayName = "Hero";

/* ---------- CurvedGallery: tilted photos along an arc ---------- */
export interface CurvedGalleryProps extends React.HTMLAttributes<HTMLDivElement> {
  images: { src: string; alt: string }[];
}
export const CurvedGallery = React.forwardRef<HTMLDivElement, CurvedGalleryProps>(({ className, images, ...p }, ref) => {
  const mid = (images.length - 1) / 2;
  return (
    <div ref={ref} className={cn("flex justify-center gap-4 overflow-hidden py-12", className)} {...p}>
      {images.map((im, i) => {
        const d = i - mid;
        return (
          <img
            key={im.src + i}
            src={im.src}
            alt={im.alt}
            loading="lazy"
            className="motion-gallery-item aspect-[4/5] w-56 shrink-0 object-cover transition-[filter,opacity] duration-700 md:w-80"
            style={{ transform: `translateY(${d * d * 14}px) rotate(${d * 3}deg)` }}
          />
        );
      })}
    </div>
  );
});
CurvedGallery.displayName = "CurvedGallery";

/* ---------- Ribbon: yellow scrolling marquee ---------- */
export interface RibbonProps extends React.HTMLAttributes<HTMLDivElement> {
  text: string;
}
export const Ribbon = React.forwardRef<HTMLDivElement, RibbonProps>(({ className, text, ...p }, ref) => (
  <div ref={ref} className={cn("overflow-hidden bg-sun py-2 text-sun-ink", className)} {...p}>
    <div className="flex w-max animate-marquee gap-6 whitespace-nowrap">
      {Array.from({ length: 12 }).map((_, i) => (
        <span key={i} className="flex items-center gap-6 text-sm"><span>{text}</span><Blossom /></span>
      ))}
    </div>
  </div>
));
Ribbon.displayName = "Ribbon";

/* ---------- Tabs: serif tabs with underline ---------- */
export interface TabsProps extends React.HTMLAttributes<HTMLDivElement> {
  items: { label: string; content: React.ReactNode }[];
  defaultIndex?: number;
}
export const Tabs = React.forwardRef<HTMLDivElement, TabsProps>(({ className, items, defaultIndex = 0, ...p }, ref) => {
  const [active, setActive] = React.useState(defaultIndex);
  const id = React.useId();
  return (
    <div ref={ref} className={cn("flex flex-col gap-12", className)} {...p}>
      <div role="tablist" className="grid border-b border-line" style={{ gridTemplateColumns: `repeat(${items.length}, minmax(0,1fr))` }}>
        {items.map((it, i) => (
          <button
            key={it.label}
            role="tab"
            id={`${id}-t${i}`}
            aria-selected={active === i}
            aria-controls={`${id}-p${i}`}
            onClick={() => setActive(i)}
            className={cn(
              "-mb-px border-b-2 pb-10 font-display text-2xl transition-colors md:text-3xl focus-visible:outline-none focus-visible:text-sky",
              active === i ? "border-ink text-ink" : "border-transparent text-ink-faint hover:text-ink-muted",
            )}
          >
            {it.label}
          </button>
        ))}
      </div>
      <div key={active} role="tabpanel" id={`${id}-p${active}`} aria-labelledby={`${id}-t${active}`} className="motion-panel-in">{items[active]?.content}</div>
    </div>
  );
});
Tabs.displayName = "Tabs";

/* ---------- FeatureCard ---------- */
const featureVariants = cva("group relative flex min-h-80 flex-col justify-end overflow-hidden rounded-card p-7 transition-[transform,box-shadow] duration-300 ease-[var(--ease-snap)] hover:-translate-y-1 hover:shadow-soft motion-reduce:transform-none motion-reduce:transition-none", {
  variants: {
    variant: {
      soft: "bg-surface text-ink",
      photo: "text-white",
    },
  },
  defaultVariants: { variant: "soft" },
});
export interface FeatureCardProps extends Omit<React.HTMLAttributes<HTMLElement>, "title">, VariantProps<typeof featureVariants> {
  title: React.ReactNode;
  description?: React.ReactNode;
  tag?: React.ReactNode;
  image?: string;
}
export const FeatureCard = React.forwardRef<HTMLElement, FeatureCardProps>(
  ({ className, variant, title, description, tag, image, ...p }, ref) => (
    <article ref={ref} className={cn(featureVariants({ variant }), className)} {...p}>
      {variant === "photo" && image && (
        <>
          <img src={image} alt="" loading="lazy" className="absolute inset-0 -z-0 size-full object-cover transition-transform duration-700 ease-[var(--ease-gentle)] group-hover:scale-[1.03] motion-reduce:transform-none motion-reduce:transition-none" />
          <div aria-hidden className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
        </>
      )}
      <div className="relative flex flex-1 flex-col gap-6">
        {tag && <span className="self-start rounded-xl bg-surface-strong px-3 py-2 text-base text-ink">{tag}</span>}
        <span aria-hidden className={cn("h-28 w-px", variant === "photo" ? "bg-white" : "bg-ink")} />
        <div className="mt-auto flex flex-col gap-4">
          <h3 className="font-display text-3xl leading-tight">{title}</h3>
          {description && <p className={cn("text-base leading-relaxed", variant === "photo" ? "text-white/90" : "text-ink-muted")}>{description}</p>}
        </div>
      </div>
    </article>
  ),
);
FeatureCard.displayName = "FeatureCard";

/* ---------- BigCountdown: "120 ✿ Days" ---------- */
export interface BigCountdownProps extends React.HTMLAttributes<HTMLDivElement> {
  target: Date | string;
  /** Optional cut-out image placed between number and word. */
  ornament?: string;
  unit?: string;
}
export const BigCountdown = React.forwardRef<HTMLDivElement, BigCountdownProps>(({ className, target, ornament, unit = "Days", ...p }, ref) => {
  const [days, setDays] = React.useState<number | null>(null);
  React.useEffect(() => {
    setDays(Math.max(0, Math.ceil((new Date(target).getTime() - Date.now()) / 864e5)));
  }, [target]);
  return (
    <div ref={ref} role="timer" aria-label={`${days ?? ""} ${unit} to go`} className={cn("flex items-start justify-center gap-2 font-display text-[clamp(5rem,14vw,12rem)] leading-none text-ink", className)} {...p}>
      <span className="tabular-nums">{days ?? "—"}</span>
      {ornament && <img src={ornament} alt="" className="-mt-4 h-[1.6em] w-auto" />}
      <span>{unit}</span>
    </div>
  );
});
BigCountdown.displayName = "BigCountdown";

/* ---------- Timeline: center line, alternating sides ---------- */
export interface TimelineItem { time: string; title: string; description?: string; image?: string }
export interface TimelineProps extends React.HTMLAttributes<HTMLOListElement> { items: TimelineItem[] }
export const Timeline = React.forwardRef<HTMLOListElement, TimelineProps>(({ className, items, ...p }, ref) => (
  <ol ref={ref} className={cn("relative mx-auto max-w-5xl", className)} {...p}>
    <span aria-hidden className="absolute left-4 top-0 h-full w-px bg-ink/80 md:left-1/2" />
    {items.map((it, i) => {
      const left = i % 2 === 1;
      return (
        <li key={it.time + it.title} className="motion-scroll-reveal group relative grid py-10 pl-12 md:grid-cols-2 md:pl-0">
          <span aria-hidden className="absolute left-4 top-12 size-4 -translate-x-1/2 rounded-full bg-ink md:left-1/2" />
          <div className={cn("flex flex-col gap-4", left ? "md:col-start-1 md:items-end md:pr-16 md:text-right" : "md:col-start-2 md:pl-16")}>
            <span className="text-base text-ink">{it.time}</span>
            <h3 className="font-display text-3xl text-ink">{it.title}</h3>
            {it.description && <p className="max-w-md text-base text-ink-muted">{it.description}</p>}
            {it.image && <img src={it.image} alt="" loading="lazy" className="size-28 rounded-2xl object-cover transition-transform duration-700 ease-[var(--ease-gentle)] group-hover:scale-[1.04] motion-reduce:transform-none" />}
          </div>
        </li>
      );
    })}
  </ol>
));
Timeline.displayName = "Timeline";

/* ---------- Accordion ---------- */
export interface AccordionItem { question: string; answer: React.ReactNode }
export interface AccordionProps extends React.HTMLAttributes<HTMLDivElement> { items: AccordionItem[] }
export const Accordion = React.forwardRef<HTMLDivElement, AccordionProps>(({ className, items, ...p }, ref) => (
  <div ref={ref} className={cn("flex flex-col gap-3", className)} {...p}>
    {items.map((it) => (
      <details key={it.question} className="group rounded-card bg-surface px-7 transition-[transform,box-shadow,background-color] duration-300 open:bg-surface-strong open:shadow-soft hover:-translate-y-0.5 motion-reduce:transform-none">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-6 py-6 font-display text-xl text-ink focus-visible:text-sky focus-visible:outline-none [&::-webkit-details-marker]:hidden">
          {it.question}
          <span aria-hidden className="grid size-9 shrink-0 place-items-center rounded-full bg-canvas text-xl transition-transform duration-300 group-open:rotate-45">+</span>
        </summary>
        <div className="grid grid-rows-[0fr] transition-[grid-template-rows] duration-500 ease-[var(--ease-gentle)] group-open:grid-rows-[1fr]"><div className="overflow-hidden"><Text tone="muted" className="pb-7 pr-12">{it.answer}</Text></div></div>
      </details>
    ))}
  </div>
));
Accordion.displayName = "Accordion";
