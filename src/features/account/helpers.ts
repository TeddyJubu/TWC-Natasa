import type * as React from "react";

/** Inline `--hood` for a neighborhood color, consumed via `bg-(--hood)` / `text-(--hood)`. */
export const hoodStyle = (color?: string) => (color ? ({ "--hood": color } as React.CSSProperties) : undefined);

export const errorMessage = (error: unknown) =>
  (error as { message?: string } | null)?.message || "Something went wrong. Please try again.";
