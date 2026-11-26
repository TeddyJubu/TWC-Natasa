// The members' frame for /feed, /directory, /calendar and /account (DESIGN.md "Member pages"): the canvas's member
// header — the lockup on the left; Feed, Directory, Calendar and My profile on the right, then her round avatar and
// her flag (Member, or Admin) opening the account menu — the page, and the canvas footer. The admin pages keep
// AppShell's sidebar.
import * as React from "react";
import { Link } from "@tanstack/react-router";
import { Popover, PopoverContent, PopoverTrigger } from "@ui-sdk/react/popover";
import { LOCKUP, cn, initials } from "@/index";
import { AppFooter } from "@/app/layout/AppLayout";
import { MY_ACCOUNT, useActiveSection } from "@/app/layout/shell-nav";
import { ring } from "@/app/layout/app-classes";
import { Icon } from "@/app/layout/icons";
import { useSignOut } from "@/app/layout/sign-out";
import { useButtonSparkles } from "@/app/layout/sparkles";
import { ConfirmHost } from "@/app/layout/ConfirmHost";

/** The signed-in pages on this frame. */
export type AirPage = "/account" | "/feed" | "/directory" | "/calendar";

/** The canvas's member nav. Rooms and Upgrade are left out: there is no chat and no paid tier behind them. */
const NAV: { to: AirPage; label: string }[] = [
  { to: "/feed", label: "Feed" },
  { to: "/directory", label: "Directory" },
  { to: "/calendar", label: "Calendar" },
  { to: "/account", label: "My profile" },
];

/** `page` is where she is: the menu's sections are in-page anchors on /account and links back to it elsewhere. */
export function AirShell({ page = "/account", admin, name, avatar, catalogueNumber, children }: {
  page?: AirPage; admin: boolean; name: string; avatar?: string; catalogueNumber: number | null; children: React.ReactNode;
}) {
  const { signOut, error } = useSignOut();
  const active = useActiveSection("/account");
  useButtonSparkles();
  // Her flag says only what is true: an admin, or an approved member (who has a number). Nothing otherwise.
  const flag = admin ? "Admin" : catalogueNumber !== null ? "Member" : null;
  return (
    <div className="app-ground air min-h-screen">
      <ConfirmHost />
      <header className="air-top">
        <Link to="/" aria-label="The Women’s Collective home" className={cn("air-brand", ring)}>
          <img src={LOCKUP.src} width={LOCKUP.width} height={LOCKUP.height} alt="" />
        </Link>
        <nav aria-label="Members" className="air-nav">
          {NAV.map((l) => (
            <Link key={l.to} to={l.to} aria-current={l.to === page ? "page" : undefined} className={ring}>{l.label}</Link>
          ))}
          <AccountMenu
            page={page} admin={admin} active={page === "/account" ? active : null} name={name} avatar={avatar} flag={flag}
            onSignOut={signOut}
          />
        </nav>
      </header>
      {error && <p role="alert" className="mx-4 mb-3 px-4 py-3 text-sm text-danger shadow-[inset_0_0_0_1.5px_currentColor] lg:mx-10">{error}</p>}
      {children}
      <AppFooter />
    </div>
  );
}

/**
 * Her avatar and flag open the account menu: on hover with a mouse, and on click or Enter for touch and keyboard.
 * Escape, a click outside or picking an item closes it.
 */
function AccountMenu({ page, admin, active, name, avatar, flag, onSignOut }: {
  page: AirPage; admin: boolean; active: string | null; name: string; avatar?: string; flag: string | null; onSignOut: () => void;
}) {
  const [open, setOpen] = React.useState(false);
  const close = () => setOpen(false);
  return (
    <Popover open={open} onOpenChange={setOpen} openOnHover delay={0} closeDelay={120}>
    <div className="air-me" data-open={open || undefined}>
      <PopoverTrigger aria-label={`${name || "Your account"}, account menu`} className={cn("air-me-btn", ring)}>
        <span className="air-avatar" aria-hidden>{avatar ? <img src={avatar} alt="" /> : initials(name)}</span>
        {flag && <span aria-hidden className="twc-flag">{flag}</span>}
      </PopoverTrigger>
      <PopoverContent keepMounted side="bottom" align="end" sideOffset={8} className="air-menu">
      <nav aria-label="My account">
        <ul>
          {MY_ACCOUNT.map((item) => (
            <li key={item.hash}>
              {page === "/account" ? (
                <a href={`#${item.hash}`} aria-current={item.hash === active ? "location" : undefined} onClick={close} className={ring}>
                  <Icon name={item.icon} className="size-4" />{item.label}
                </a>
              ) : (
                <Link to="/account" hash={item.hash} onClick={close} className={ring}><Icon name={item.icon} className="size-4" />{item.label}</Link>
              )}
            </li>
          ))}
          {/* UX only: /admin's guard and every admin server function check again. */}
          {admin && <li><Link to="/admin" onClick={close} className={ring}><Icon name="shield-check" className="size-4" />Admin</Link></li>}
          <li><button type="button" onClick={() => { close(); onSignOut(); }} className={ring}><Icon name="log-out" className="size-4" />Sign out</button></li>
        </ul>
      </nav>
      </PopoverContent>
    </div>
    </Popover>
  );
}
