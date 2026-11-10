// /account's own frame (DESIGN.md "Member profile"): the airmail desk, a top bar whose name and avatar open the account
// menu (the account sections, plus Admin for admins), and the page. The admin pages keep AppShell's sidebar.
import * as React from "react";
import { Link } from "@tanstack/react-router";
import { ConstellationLogo, cn, formatCatalogueNumber, initials } from "@/index";
import { MY_ACCOUNT, useActiveSection } from "@/app/layout/shell-nav";
import { ring } from "@/app/layout/app-classes";
import { Icon } from "@/app/layout/icons";
import { useSignOut } from "@/app/layout/sign-out";
import { useButtonSparkles } from "@/app/layout/sparkles";

/** `page` is where she is: the menu's sections are in-page anchors on /account and links back to it elsewhere. */
export function AirShell({ page = "/account", admin, name, avatar, catalogueNumber, children }: {
  page?: "/account" | "/directory"; admin: boolean; name: string; avatar?: string; catalogueNumber: number | null; children: React.ReactNode;
}) {
  const { signOut, error } = useSignOut();
  const active = useActiveSection("/account");
  useButtonSparkles();
  return (
    <div className="app-ground air min-h-screen">
      <div className="air-wrap">
        <header className="air-top">
          <Link to="/" aria-label="The Women’s Collective home" className={cn("air-brand", ring)}>
            <ConstellationLogo variant="ink" alt="" className="w-6.5 lg:w-7.5" />The Women’s Collective
          </Link>
          <div className="air-who">
            <AccountMenu page={page} admin={admin} active={page === "/account" ? active : null} name={name} avatar={avatar} catalogueNumber={catalogueNumber} />
            <button type="button" onClick={signOut} aria-label="Sign out" className={cn("air-icon-btn", ring)}>
              <Icon name="log-out" className="size-4" />
            </button>
          </div>
        </header>
        {error && <p role="alert" className="mt-3 rounded-xl bg-app px-4 py-3 text-sm text-danger">{error}</p>}
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
  page: "/account" | "/directory"; admin: boolean; active: string | null; name: string; avatar?: string; catalogueNumber: number | null;
}) {
  const [open, setOpen] = React.useState(false);
  const root = React.useRef<HTMLDivElement>(null);
  const button = React.useRef<HTMLButtonElement>(null);
  const menuId = React.useId();

  React.useEffect(() => {
    if (!open) return;
    const outside = (e: PointerEvent) => { if (!root.current?.contains(e.target as Node)) setOpen(false); };
    const escape = (e: KeyboardEvent) => { if (e.key === "Escape") { setOpen(false); button.current?.focus(); } };
    document.addEventListener("pointerdown", outside);
    document.addEventListener("keydown", escape);
    return () => { document.removeEventListener("pointerdown", outside); document.removeEventListener("keydown", escape); };
  }, [open]);

  const close = () => setOpen(false);
  return (
    <div ref={root} className="air-me" data-open={open || undefined}>
      <button
        ref={button} type="button" aria-expanded={open} aria-controls={menuId} aria-label={`${name || "Your account"}, account menu`}
        onClick={() => setOpen((o) => !o)} className={cn("air-me-btn", ring)}
      >
        <span className="air-avatar" aria-hidden>{avatar ? <img src={avatar} alt="" /> : initials(name)}</span>
        <span className="hidden min-w-0 text-left lg:block" aria-hidden>
          <b className="block max-w-44 truncate text-sm font-semibold">{name}</b>
          {catalogueNumber !== null && <small className="air-lbl mb-0 text-[9.5px]">Member No. {formatCatalogueNumber(catalogueNumber)}</small>}
        </span>
        <Icon name="chevron-down" className="air-me-chev size-4" />
      </button>
      <nav id={menuId} aria-label="My account" className="air-menu">
        <ul>
          {MY_ACCOUNT.map((item) => (
            <li key={item.hash}>
              {page === "/account" ? (
                <a href={`#${item.hash}`} aria-current={item.hash === active ? "location" : undefined} onClick={close} className={ring}>
                  <Icon name={item.icon} className="size-4" />{item.label}
                </a>
              ) : (
                <Link to="/account" hash={item.hash} className={ring}><Icon name={item.icon} className="size-4" />{item.label}</Link>
              )}
            </li>
          ))}
          <li>
            <Link to="/directory" aria-current={page === "/directory" ? "page" : undefined} onClick={close} className={ring}>
              <Icon name="users" className="size-4" />Member directory
            </Link>
          </li>
          {/* UX only: /admin's guard and every admin server function check again. */}
          {admin && <li><Link to="/admin" className={ring}><Icon name="shield-check" className="size-4" />Admin</Link></li>}
        </ul>
      </nav>
    </div>
  );
}
