import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "../lib/utils";

export const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 rounded-full font-sans tracking-wide transition-all duration-300 ease-[var(--ease-gentle)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-paper disabled:pointer-events-none disabled:opacity-45",
  {
    variants: {
      variant: {
        solid: "bg-ink text-paper hover:bg-accent hover:text-accent-ink hover:-translate-y-0.5",
        accent: "bg-accent text-accent-ink hover:-translate-y-0.5 hover:shadow-lift",
        outline: "border border-ink/30 text-ink hover:border-accent hover:text-accent",
        ghost: "text-ink hover:bg-surface",
        link: "rounded-none px-0 text-ink underline decoration-accent underline-offset-4 hover:text-accent",
      },
      size: { sm: "h-9 px-4 text-sm", md: "h-11 px-6 text-sm", lg: "h-13 px-8 text-base" },
    },
    compoundVariants: [{ variant: "link", className: "h-auto px-0" }],
    defaultVariants: { variant: "solid", size: "md" },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  loading?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, loading, disabled, children, ...p }, ref) => (
    <button
      ref={ref}
      className={cn(buttonVariants({ variant, size }), className)}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...p}
    >
      {loading && <span aria-hidden className="size-3.5 animate-spin rounded-full border border-current border-t-transparent" />}
      {children}
    </button>
  ),
);
Button.displayName = "Button";
