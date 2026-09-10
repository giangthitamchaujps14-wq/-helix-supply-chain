import type { ReactNode } from "react";
import { Link, useRouterState } from "@tanstack/react-router";
import { Menu, Boxes, X } from "lucide-react";
import { useState } from "react";
import { GROUPS, TOOLS, isToolId } from "@/lib/catalog";
import { cn } from "@/lib/utils";
import { Button } from "./ui/button";

function Nav({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  return (
    <nav className="flex flex-col gap-6">
      <Link
        to="/"
        onClick={onNavigate}
        className={cn(
          "text-sm tracking-wide",
          pathname === "/" ? "text-fg" : "text-muted hover:text-fg",
        )}
      >
        Command center
      </Link>
      {GROUPS.map((group) => (
        <div key={group}>
          <p className="mb-2 text-[11px] uppercase tracking-[0.16em] text-subtle">{group}</p>
          <ul className="flex flex-col gap-1">
            {TOOLS.filter((t) => t.group === group).map((t) => {
              const href = `/tools/${t.id}`;
              const active = pathname === href;
              return (
                <li key={t.id}>
                  <Link
                    to="/tools/$toolId"
                    params={{ toolId: t.id }}
                    onClick={onNavigate}
                    className={cn(
                      "block rounded-md px-3 py-2.5 text-sm leading-snug transition-colors duration-150",
                      active ? "bg-surface-2 text-fg" : "text-muted hover:bg-surface-2 hover:text-fg",
                    )}
                  >
                    {t.name}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const parts = pathname.split("/");
  const toolId = parts[1] === "tools" ? parts[2] : "";
  const title = toolId && isToolId(toolId) ? TOOLS.find((t) => t.id === toolId)?.name : "Helix";

  return (
    <div className="min-h-dvh bg-bg text-fg">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 border-r border-border bg-bg px-5 py-6 lg:flex lg:flex-col">
        <Link to="/" className="mb-8 flex items-center gap-2">
          <Boxes className="size-4 text-accent" />
          <span className="text-sm font-medium tracking-[0.18em]">HELIX</span>
        </Link>
        <Nav />
        <p className="mt-auto pt-8 text-[11px] leading-relaxed text-subtle">
          Supply chain intelligence. Demo snapshot ABC-MART, 07/09/2026.
        </p>
      </aside>

      <header className="sticky top-0 z-20 flex h-14 items-center gap-3 border-b border-border bg-bg/90 px-4 backdrop-blur lg:hidden">
        <Button variant="ghost" size="icon" aria-label="Menu" onClick={() => setOpen(true)}>
          <Menu className="size-5" />
        </Button>
        <span className="text-sm font-medium tracking-wide">{title}</span>
      </header>

      {open ? (
        <div className="fixed inset-0 z-40 lg:hidden">
          <button type="button" className="absolute inset-0 bg-bg/70" onClick={() => setOpen(false)} aria-label="Close menu" />
          <div className="relative h-full w-[min(82vw,288px)] border-r border-border bg-surface p-5">
            <div className="mb-6 flex items-center justify-between">
              <span className="text-sm font-medium tracking-[0.18em]">HELIX</span>
              <Button variant="ghost" size="icon" onClick={() => setOpen(false)} aria-label="Close">
                <X className="size-4" />
              </Button>
            </div>
            <Nav onNavigate={() => setOpen(false)} />
          </div>
        </div>
      ) : null}

      <div className="lg:pl-64">
        <main className="mx-auto w-full max-w-[1280px] px-4 py-6 sm:px-6 lg:px-8 lg:py-8">{children}</main>
      </div>
    </div>
  );
}
