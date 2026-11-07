import { Link } from "@tanstack/react-router";
import { Button } from "@/index";

export function InlineError({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div role="alert" className="flex flex-wrap items-center gap-4 text-sm text-ink-muted">
      <p>{message}</p>
      <Button type="button" size="sm" variant="outline" onClick={onRetry}>Retry</Button>
    </div>
  );
}

export function Locked() {
  return (
    <div className="mx-auto flex max-w-lg flex-col items-center gap-5 rounded-panel border border-dashed border-line p-10 text-center">
      <span aria-hidden className="grid size-12 place-items-center rounded-full bg-surface text-xl">✦</span>
      <p className="font-display text-2xl">Unlocks once you’re welcomed in</p>
      <p className="text-sm text-ink-muted">Members see gatherings, headshot booking, and personal introductions here.</p>
      <Link to="/join" className="text-sm underline underline-offset-4">Haven’t applied yet? Start your application</Link>
    </div>
  );
}
