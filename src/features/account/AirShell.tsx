// The members' frame for /account, /feed and /directory (DESIGN.md "Member profile"): a canvas top bar over a hairline
// whose name and avatar open the account menu (the account sections, plus Admin for admins), and the page. The admin
// pages keep AppShell's sidebar.
import * as React from "react";
import { Link } from "@tanstack/react-router";
import { Popover, PopoverContent, PopoverTrigger } from "@ui-sdk/react/popover";
import { ConstellationLogo, cn, formatCatalogueNumber, initials } from "@/index";
import { MY_ACCOUNT, useActiveSection } from "@/app/layout/shell-nav";
import { ring } from "@/app/layout/app-classes";
import { Icon } from "@/app/layout/icons";
import { useSignOut } from "@/app/layout/sign-out";
import { useButtonSparkles } from "@/app/layout/sparkles";
import { ConfirmHost } from "@/app/layout/ConfirmHost";

/** The signed-in pages on this frame. */
export type AirPage = "/account" | "/feed" | "/directory";

/** `page` is where she is: the menu's sections are in-page anchors on /account and links back to it elsewhere. */
export function AirShell({ page = "/account", admin, name, avatar, catalogueNumber, children }: {
  page?: AirPage; admin: boolean; name: string; avatar?: string; catalogueNumber: number | null; children: React.ReactNode;
}) {
  const { signOut, error } = useSignOut();
  const active = useActiveSection("/account");
  useButtonSparkles();
  return (
    <div className="app-ground air min-h-screen">
      <ConfirmHost />
      <div className="air-wrap">
        <header className="air-top">
          <Link to="/" aria-label="The Women’s Collective home" className={cn("air-brand", ring)}>
            <ConstellationLogo variant="ink" alt="" sizes="30px" className="w-6.5 lg:w-7.5" />The Women’s Collective
          </Link>
          <div className="air-who">
            <AccountMenu page={page} admin={admin} active={page === "/account" ? active : null} name={name} avatar={avatar} catalogueNumber={catalogueNumber} />
            <button type="button" onClick={signOut} aria-label="Sign out" className={cn("air-icon-btn", ring)}>
              <Icon name="log-out" className="size-4" />
            </button>
          </div>
        </header>
        {error && <p role="alert" className="mt-3 px-4 py-3 text-sm text-danger shadow-[inset_0_0_0_1.5px_currentColor]">{error}</p>}
        {children}
      </div>
    </div>
  );
}

/**
 * Her name and avatar open the account menu: on hover with a mouse, and on click or Enter for touch and keyboard.
 * Escape, a click outside or picking a section closes it.
 */
function AccountMenu({ page, admin, active, name, avatar, catalogueNumber }: {
  page: AirPage; admin: boolean; active: string | null; name: string; avatar?: string; catalogueNumber: number | null;
}) {
  const [open, setOpen] = React.useState(false);
  const close = () => setOpen(false);
  return (
    <Popover open={open} onOpenChange={setOpen} openOnHover delay={0} closeDelay={120}>
    <div className="air-me" data-open={open || undefined}>
      <PopoverTrigger aria-label={`${name || "Your account"}, account menu`} className={cn("air-me-btn", ring)}>
        <span className="air-avatar" aria-hidden>{avatar ? <img src={avatar} alt="" /> : initials(name)}</span>
        <span className="hidden min-w-0 text-left lg:block" aria-hidden>
          <b className="block max-w-44 truncate text-sm font-semibold">{name}</b>
          {catalogueNumber !== null && <small className="air-lbl mb-0 text-[9.5px]">Member No. {formatCatalogueNumber(catalogueNumber)}</small>}
        </span>
        <Icon name="chevron-down" className="air-me-chev size-4" />
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
          <li>
            <Link to="/feed" aria-current={page === "/feed" ? "page" : undefined} onClick={close} className={ring}>
              <Icon name="newspaper" className="size-4" />Newsfeed
            </Link>
          </li>
          <li>
            <Link to="/directory" aria-current={page === "/directory" ? "page" : undefined} onClick={close} className={ring}>
              <Icon name="users" className="size-4" />Member directory
            </Link>
          </li>
          {/* UX only: /admin's guard and every admin server function check again. */}
          {admin && <li><Link to="/admin" onClick={close} className={ring}><Icon name="shield-check" className="size-4" />Admin</Link></li>}
        </ul>
      </nav>
      </PopoverContent>
    </div>
    </Popover>
  );
}
