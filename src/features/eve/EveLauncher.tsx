// The floating "Eve" button on every admin page. The chat itself (and its libraries) loads on the first open.
// The root route remounts its page on every navigation, so Eve has its own small React root: the conversation
// survives moving between admin pages and is dropped on leaving the admin area.
import * as React from "react";
import { createRoot, type Root } from "react-dom/client";
import { QueryClientProvider, useQueryClient, type QueryClient } from "@tanstack/react-query";
import { Collapsible, CollapsiblePanel, CollapsibleTrigger } from "@ui-sdk/react/collapsible";
import { ConstellationLogo } from "@/index";

const EveChat = React.lazy(() => import("@eve-chat"));
const RECHECK_MS = 400;

function EveDock() {
  const [open, setOpen] = React.useState(false);
  const [opened, setOpened] = React.useState(false);
  const trigger = React.useRef<HTMLButtonElement>(null);
  const change = (next: boolean) => {
    setOpen(next);
    if (next) setOpened(true);
  };
  const close = () => {
    setOpen(false);
    trigger.current?.focus();
  };

  return (
    <Collapsible open={open} onOpenChange={change} className="eve-dock">
      <CollapsiblePanel
        keepMounted
        role="region"
        aria-label="Eve, your admin assistant"
        className="eve-panel"
        onKeyDown={(event) => { if (event.key === "Escape" && !event.defaultPrevented) close(); }}
      >
        {opened && (
          <React.Suspense fallback={<p role="status" className="p-4 text-sm">Opening Eve…</p>}>
            <EveChat onClose={close} />
          </React.Suspense>
        )}
      </CollapsiblePanel>
      <CollapsibleTrigger ref={trigger} aria-label={open ? "Close Eve" : "Open Eve"} className="eve-trigger">
        <ConstellationLogo variant="ink" alt="" sizes="20px" className="w-5 shrink-0" />
        <span>Eve</span>
      </CollapsibleTrigger>
    </Collapsible>
  );
}

let dock: { root: Root; host: HTMLElement } | null = null;
let holders = 0;
let timer: number | undefined;

function removeWhenLeft() {
  window.clearTimeout(timer);
  timer = window.setTimeout(() => {
    if (holders > 0 || !dock) return;
    if (/^\/admin(\/|$)/.test(window.location.pathname)) return removeWhenLeft();
    dock.root.unmount();
    dock.host.remove();
    dock = null;
  }, RECHECK_MS);
}

function holdDock(queryClient: QueryClient) {
  holders += 1;
  window.clearTimeout(timer);
  if (!dock) {
    const host = document.createElement("div");
    document.body.append(host);
    const root = createRoot(host);
    root.render(<QueryClientProvider client={queryClient}><EveDock /></QueryClientProvider>);
    dock = { root, host };
  }
  return () => {
    holders -= 1;
    if (holders === 0) removeWhenLeft();
  };
}

export function EveLauncher() {
  const queryClient = useQueryClient();
  React.useEffect(() => holdDock(queryClient), [queryClient]);
  return null;
}
