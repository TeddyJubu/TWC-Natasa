// Small shared pieces of the public scrapbook kit (classes in src/app/twc.css). App-only.
import * as React from "react";
import { Link } from "@tanstack/react-router";
import { cn } from "@/index";

const ICONS = {
  pin: <><path d="M20 10c0 4.993-5.539 10.193-7.399 11.799a1 1 0 0 1-1.202 0C9.539 20.193 4 14.993 4 10a8 8 0 0 1 16 0" /><circle cx="12" cy="10" r="3" /></>,
  sparkle: <path d="M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z" />,
  arrow: <><path d="M5 12h14" /><path d="m12 5 7 7-7 7" /></>,
  arrowLeft: <><path d="M19 12H5" /><path d="m12 19-7-7 7-7" /></>,
  arrowUp: <><path d="M7 7h10v10" /><path d="M7 17 17 7" /></>,
  clip: <path d="m21.44 11.05-9.19 9.19a6 6 0 0 1-8.49-8.49l8.57-8.57A4 4 0 1 1 18 8.84l-8.59 8.57a2 2 0 0 1-2.83-2.83l8.49-8.48" />,
  menu: <><path d="M4 6h16" /><path d="M4 12h16" /><path d="M4 18h16" /></>,
  close: <><path d="M18 6 6 18" /><path d="m6 6 12 12" /></>,
  plus: <><path d="M5 12h14" /><path d="M12 5v14" /></>,
  check: <path d="M20 6 9 17l-5-5" />,
  calendar: <><rect x="3" y="4" width="18" height="18" rx="2" /><path d="M16 2v4M8 2v4M3 10h18" /></>,
  clock: <><circle cx="12" cy="12" r="10" /><path d="M12 6v6l4 2" /></>,
  mail: <><rect x="2" y="4" width="20" height="16" rx="2" /><path d="m22 7-10 6L2 7" /></>,
  globe: <><circle cx="12" cy="12" r="10" /><path d="M2 12h20M12 2a15.3 15.3 0 0 1 0 20M12 2a15.3 15.3 0 0 0 0 20" /></>,
  lock: <><rect x="3" y="11" width="18" height="11" rx="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" /></>,
  pause: <><path d="M9 5v14" /><path d="M15 5v14" /></>,
  play: <path d="m7 4 13 8-13 8z" />,
} as const;

export type IconName = keyof typeof ICONS;

/** Decorative stroke icon (aria-hidden); label the control that holds it. */
export function Icon({ name, className }: { name: IconName; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden className={cn("size-4 shrink-0", className)}>
      {ICONS[name]}
    </svg>
  );
}

export const JOIN_HREF = "/join";
export const JOIN_CLASS = "twc-btn";
/** The one join call to action: the canvas's solid ink pill to plain `/join` (no `?area=`; the form asks), worded as the
 *  canvas words it at that spot ("Join", "Join North Brooklyn", "Become a member"…). `className` is for layout and size. */
export function JoinButton({ className, style, onClick, children = "Join us" }: { className?: string; style?: React.CSSProperties; onClick?: () => void; children?: React.ReactNode }) {
  return (
    <Link to={JOIN_HREF} onClick={onClick} style={style} className={cn(JOIN_CLASS, className)}>
      {children} <Icon name="arrow" className="twc-arrow" />
    </Link>
  );
}
