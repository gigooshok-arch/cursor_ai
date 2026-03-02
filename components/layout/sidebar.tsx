"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, X } from "lucide-react";
import { useState } from "react";

import { cn } from "@/lib/utils";

type SidebarTab = {
  key: string;
  title: string;
  route: string;
  access: string;
};

type SidebarProps = {
  fullName: string;
  roleName: string;
  tabs: SidebarTab[];
};

export function Sidebar({ fullName, roleName, tabs }: SidebarProps) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  return (
    <>
      <div className="sticky top-0 z-30 border-b border-slate-200 bg-white px-4 py-3 lg:hidden">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="truncate text-sm font-medium">Привет, {fullName}</p>
            <p className="text-xs text-slate-500">Роль: {roleName}</p>
          </div>
          <button
            type="button"
            className="inline-flex h-11 w-11 items-center justify-center rounded-md border border-slate-300 bg-white"
            onClick={() => setOpen((prev) => !prev)}
            aria-label="Открыть меню"
          >
            {open ? <X size={18} /> : <Menu size={18} />}
          </button>
        </div>
      </div>

      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-20 w-72 border-r border-slate-200 bg-white p-4 shadow-sm transition-transform lg:static lg:translate-x-0 lg:shadow-none",
          open ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <div className="mb-4 hidden rounded-lg border border-slate-200 bg-slate-50 p-3 lg:block">
          <p className="text-sm font-medium">Привет, {fullName}</p>
          <p className="text-xs text-slate-600">Роль: {roleName}</p>
        </div>
        <nav className="space-y-1">
          {tabs.map((tab) => (
            <Link
              key={tab.key}
              href={tab.route}
              className={cn(
                "flex min-h-11 items-center justify-between rounded-md px-3 py-2 text-sm",
                pathname.startsWith(tab.route)
                  ? "bg-slate-900 text-white"
                  : "text-slate-700 hover:bg-slate-100",
              )}
              onClick={() => setOpen(false)}
            >
              <span>{tab.title}</span>
              <span className="text-xs opacity-80">{tab.access}</span>
            </Link>
          ))}
        </nav>
        <form action="/logout" method="post" className="mt-4">
          <button
            type="submit"
            className="inline-flex h-11 w-full items-center justify-center rounded-md border border-slate-300 bg-white px-4 text-sm font-medium hover:bg-slate-100"
          >
            Выйти
          </button>
        </form>
      </aside>
    </>
  );
}
