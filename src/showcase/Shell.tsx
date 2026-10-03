import * as React from "react";
import { Link } from "@tanstack/react-router";
import { Button, Container, Wordmark, cn } from "@/index";

export function Shell({ children, bare }: { children: React.ReactNode; bare?: boolean }) {
  const [dark, setDark] = React.useState(false);
  React.useEffect(() => {
    document.documentElement.classList.toggle("dark", dark);
  }, [dark]);
  const links = [
    { to: "/", label: "Sample page" },
    { to: "/colors", label: "Colors" },
    { to: "/typography", label: "Typography" },
    { to: "/components", label: "Components" },
  ] as const;
  return (
    <div className="min-h-screen bg-canvas text-ink">
      <div className="fixed bottom-4 left-1/2 z-50 flex -translate-x-1/2 items-center gap-1 rounded-full border border-line bg-canvas/90 p-1.5 shadow-soft backdrop-blur">
        <Wordmark className="px-3 text-xl">Bloom</Wordmark>
        {links.map((l) => (
          <Link key={l.to} to={l.to} className={cn("rounded-full px-3 py-1.5 text-sm text-ink-muted hover:text-ink")} activeProps={{ className: "bg-surface !text-ink" }} activeOptions={{ exact: true }}>
            {l.label}
          </Link>
        ))}
        <Button size="sm" variant="ink" className="rounded-full" onClick={() => setDark((d) => !d)} aria-label="Toggle dark theme">{dark ? "Light" : "Dark"}</Button>
      </div>
      {bare ? children : <Container className="pb-32 pt-16">{children}</Container>}
    </div>
  );
}

export function Specimen({ label, children, className }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("flex flex-col gap-3", className)}>
      <div className="flex min-h-24 flex-wrap items-center gap-4 rounded-card border border-line p-6">{children}</div>
      <code className="text-xs text-ink-muted">{label}</code>
    </div>
  );
}
