import * as React from "react";
import { Link } from "@tanstack/react-router";
import { Button, Container, Monogram, cn } from "@/index";

export function Shell({ children }: { children: React.ReactNode }) {
  const [dark, setDark] = React.useState(false);
  React.useEffect(() => {
    document.documentElement.classList.toggle("dark", dark);
  }, [dark]);
  const links = [
    { to: "/", label: "Overview" },
    { to: "/colors", label: "Colors" },
    { to: "/typography", label: "Typography" },
    { to: "/components", label: "Components" },
  ] as const;
  return (
    <div className="min-h-screen bg-paper text-ink">
      <header className="sticky top-0 z-40 border-b border-line bg-paper/90 backdrop-blur">
        <Container width="wide" className="flex h-14 items-center justify-between gap-4">
          <Link to="/" className="flex items-baseline gap-3">
            <Monogram>K</Monogram>
            <span className="hidden text-xs uppercase tracking-[var(--tracking-eyebrow)] text-ink-muted sm:inline">Keepsake</span>
          </Link>
          <nav className="flex gap-1 overflow-x-auto">
            {links.map((l) => (
              <Link
                key={l.to}
                to={l.to}
                className={cn("rounded-full px-3 py-1.5 text-sm text-ink-muted hover:text-ink")}
                activeProps={{ className: "bg-surface !text-ink" }}
                activeOptions={{ exact: true }}
              >
                {l.label}
              </Link>
            ))}
          </nav>
          <Button size="sm" variant="outline" onClick={() => setDark((d) => !d)} aria-label="Toggle dark theme">
            {dark ? "Light" : "Dark"}
          </Button>
        </Container>
      </header>
      {children}
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
