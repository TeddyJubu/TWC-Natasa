import * as React from "react";
import { Tabs as TabsRoot, TabsList, TabsPanel, TabsTab } from "@ui-sdk/react/tabs";
import { cn } from "../lib/utils";

/* ---------- Tabs: serif tabs with underline ---------- */
export interface TabsProps extends Omit<React.HTMLAttributes<HTMLDivElement>, "defaultValue"> {
  items: { label: string; content: React.ReactNode }[];
  defaultIndex?: number;
}
export const Tabs = React.forwardRef<HTMLDivElement, TabsProps>(({ className, items, defaultIndex = 0, ...p }, ref) => {
  const [active, setActive] = React.useState<string | null>(items[defaultIndex]?.label ?? null);
  return (
    <TabsRoot ref={ref} value={active} onValueChange={(next) => setActive(next)} className={cn("flex flex-col gap-12", className)} {...p}>
      <TabsList className="grid border-b border-line" style={{ gridTemplateColumns: `repeat(${items.length}, minmax(0,1fr))` }}>
        {items.map((it) => (
          <TabsTab
            key={it.label}
            value={it.label}
            className={cn(
              "-mb-px rounded-sm border-b-2 pb-10 font-display text-2xl transition-colors md:text-3xl focus-visible:text-sky focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-canvas",
              active === it.label ? "border-ink text-ink" : "border-transparent text-ink-faint hover:text-ink-muted",
            )}
          >
            {it.label}
          </TabsTab>
        ))}
      </TabsList>
      {/* Every panel exists so each aria-controls resolves; only the active one mounts its content
          (inactive content would fetch and keep state for nothing). Unhiding replays motion-panel-in. */}
      {items.map((it) => (
        <TabsPanel key={it.label} value={it.label} keepMounted className="motion-panel-in">
          {active === it.label ? it.content : null}
        </TabsPanel>
      ))}
    </TabsRoot>
  );
});
Tabs.displayName = "Tabs";
