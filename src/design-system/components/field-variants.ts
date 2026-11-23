import { cva } from "class-variance-authority";

export const fieldVariants = cva(
  "peer w-full font-sans text-base text-ink placeholder:text-ink-muted/85 transition-[border-color,background-color,box-shadow,transform] duration-300 ease-[var(--ease-snap)] hover:border-ink-muted focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50 aria-[invalid=true]:border-danger aria-[invalid=true]:focus-visible:ring-danger/20 motion-reduce:transition-none",
  {
    variants: {
      variant: {
        editorial: "border-x-0 border-b border-t-0 border-line bg-transparent px-0 focus-visible:border-sky focus-visible:shadow-[inset_0_-1px_0_var(--bl-sky)] focus-visible:ring-0",
        boxed: "rounded-control border border-line bg-surface px-4 focus-visible:-translate-y-0.5 focus-visible:border-sky focus-visible:bg-canvas focus-visible:ring-2 focus-visible:ring-ring/20",
      },
    },
    defaultVariants: { variant: "editorial" },
  },
);
