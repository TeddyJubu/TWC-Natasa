// /account's own frame (DESIGN.md "Member profile"): the airmail desk, a top bar with the account tabs, and the page.
// The admin pages keep AppShell's sidebar; an admin reaches them from the Admin tab here.
import type * as React from "react";
import { Link } from "@tanstack/react-router";
import { ConstellationLogo, cn, formatCatalogueNumber, initials } from "@/index";
import { MY_ACCOUNT, useActiveSection } from "@/app/layout/shell-nav";
import { ring } from "@/app/layout/app-classes";
import { Icon } from "@/app/layout/icons";
import { useSignOut } from "@/app/layout/sign-out";
import { useButtonSparkles } from "@/app/layout/sparkles";

export function AirShell({ admin, name, avatar, catalogueNumber, children }: {
  admin: boolean; name: string; avatar?: string; catalogueNumber: number | null; children: React.ReactNode;
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
          <nav aria-label="My account" className="air-nav">
            <span aria-hidden className="air-lbl mb-0 hidden xl:block">My account</span>
            <ul className="air-tabs">
              {MY_ACCOUNT.map((item) => {
                const current = item.hash === active;
                return (
                  <li key={item.hash}>
                    <a href={`#${item.hash}`} aria-current={current ? "location" : undefined} className={ring}>
                      <Icon name={item.icon} className="size-4" />{item.label}
                    </a>
                  </li>
                );
              })}
              {/* UX only: /admin's guard and every admin server function check again. */}
              {admin && <li><Link to="/admin" className={ring}><Icon name="shield-check" className="size-4" />Admin</Link></li>}
            </ul>
          </nav>
          <div className="air-who">
            <span className="air-avatar" aria-hidden>{avatar ? <img src={avatar} alt="" /> : initials(name)}</span>
            <span className="hidden min-w-0 lg:block">
              <b className="block max-w-44 truncate text-sm font-semibold">{name}</b>
              {catalogueNumber !== null && <small className="air-lbl mb-0 text-[9.5px]">Member No. {formatCatalogueNumber(catalogueNumber)}</small>}
            </span>
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
