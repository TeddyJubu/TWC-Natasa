import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "../lib/utils";

export const buttonVariants = cva(
  "group inline-flex items-center justify-center gap-2 rounded-control font-sans font-normal shadow-none transition-[transform,box-shadow,background-color,color,filter,opacity] duration-300 ease-[var(--ease-snap)] hover:-translate-y-0.5 hover:shadow-soft active:translate-y-0 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-canvas motion-reduce:transform-none motion-reduce:transition-none disabled:pointer-events-none disabled:opacity-45 disabled:shadow-none",
  {
    variants: {
      variant: {
        primary: "bg-sky text-sky-ink hover:brightness-110",
        white: "bg-white text-black hover:bg-surface-strong",
        ink: "bg-ink text-canvas hover:opacity-85",
        sun: "bg-sun text-sun-ink hover:brightness-105",
        outline: "border border-line text-ink hover:bg-surface",
        link: "rounded-none text-ink underline underline-offset-4 hover:translate-y-0 hover:text-sky hover:shadow-none active:scale-100",
      },
      size: { sm: "h-10 px-4 text-sm", md: "h-[3.25rem] px-6 text-base", lg: "h-14 px-8 text-lg" },
    },
    compoundVariants: [{ variant: "link", className: "h-auto px-0" }],
    defaultVariants: { variant: "primary", size: "md" },
  },
);

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {
  loading?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, loading, disabled, children, ...p }, ref) => (
    <button ref={ref} className={cn(buttonVariants({ variant, size }), className)} disabled={disabled || loading} aria-busy={loading || undefined} {...p}>
      {loading && <span aria-hidden className="size-4 animate-spin rounded-full border-2 border-current border-t-transparent" />}
      {children}
    </button>
  ),
);
Button.displayName = "Button";
