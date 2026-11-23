import * as React from "react";
import { Switch as SwitchRoot, SwitchThumb } from "@ui-sdk/react/switch";
import { cn } from "../lib/utils";

export interface SwitchProps extends Omit<React.ComponentProps<typeof SwitchRoot>, "children" | "className"> {
  label: React.ReactNode;
  description?: React.ReactNode;
  className?: string;
}
export function Switch({ className, label, description, ...p }: SwitchProps) {
  return (
    <label className={cn("group flex cursor-pointer items-start justify-between gap-5 border-y border-line py-4 transition-colors hover:border-ink-muted has-[:disabled]:cursor-not-allowed has-[:disabled]:opacity-50", className)}>
      <span><span className="block font-sans text-sm text-ink">{label}</span>{description && <span className="mt-1 block font-sans text-xs leading-relaxed text-ink-muted">{description}</span>}</span>
      <SwitchRoot {...p} className="relative mt-0.5 h-6 w-11 shrink-0 cursor-[inherit] rounded-full bg-surface-strong transition-[transform,background-color] duration-300 ease-[var(--ease-snap)] group-hover:scale-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-canvas data-checked:bg-ink motion-reduce:transition-none">
        <SwitchThumb className="absolute top-1 left-1 size-4 rounded-full bg-ink transition-[translate,background-color] duration-300 ease-[var(--ease-snap)] data-checked:translate-x-5 data-checked:bg-canvas motion-reduce:transition-none" />
      </SwitchRoot>
    </label>
  );
}
