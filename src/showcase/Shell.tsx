import * as React from "react";
import { Link } from "@tanstack/react-router";
import { Button, Container, Wordmark, cn } from "@/index";

/**
 * Showcase wrapper. The floating design toolbar is for the design-system pages
 * (/colors, /typography, /components); public pages pass `toolbar={false}`.
 */
export function Shell({ children, bare, toolbar = true }: { children: React.ReactNode; bare?: boolean; toolbar?: boolean }) {
  const [dark, setDark] = React.useState(false);
  React.useEffect(() => {
    document.documentElement.classList.toggle("dark", dark);
  }, [dark]);
  const links = [
    { to: "/", label: "Sample page" },
    { to: "/colors", label: "Colors" },
    { to: "/typography", label: "Typography" },
    { to: "/components", label: "Components" },
    { to: "/members", label: "Members" },
    { to: "/join", label: "Join form" },
  ] as const;
  return (
    <div className="min-h-screen bg-canvas text-ink">
      {toolbar && <div className="fixed inset-x-3 bottom-4 z-50 flex items-center gap-1 overflow-x-auto rounded-full border border-line bg-canvas/90 p-1.5 shadow-soft backdrop-blur transition-[background-color,border-color,box-shadow] duration-300 sm:left-1/2 sm:right-auto sm:-translate-x-1/2">
        <Wordmark className="hidden shrink-0 px-3 text-xl sm:inline">TWC</Wordmark>
        {links.map((l) => (
          <Link key={l.to} to={l.to} className={cn("shrink-0 rounded-full px-3 py-1.5 text-sm text-ink-muted transition-[transform,background-color,color] duration-300 ease-[var(--ease-snap)] hover:-translate-y-0.5 hover:bg-surface hover:text-ink active:translate-y-0 motion-reduce:transform-none")} activeProps={{ className: "bg-surface !text-ink" }} activeOptions={{ exact: true }}>
            {l.label}
          </Link>
        ))}
        <Button size="sm" variant="ink" className="shrink-0 rounded-full" onClick={() => setDark((d) => !d)} aria-label="Toggle dark theme">{dark ? "Light" : "Dark"}</Button>
      </div>}
      {bare ? children : <Container className="pb-32 pt-16">{children}</Container>}
    </div>
  );
}

export function Specimen({ label, children, className }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("motion-scroll-reveal flex flex-col gap-3", className)}>
      <div className="flex min-h-24 flex-wrap items-center gap-4 rounded-card border border-line p-6 transition-[border-color,box-shadow] duration-300 hover:border-ink/20 hover:shadow-soft">{children}</div>
      <code className="text-xs text-ink-muted">{label}</code>
    </div>
  );
}
