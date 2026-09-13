"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { createClient } from "@/lib/supabase/client";
import { backendMode } from "@/lib/backend";
import type { Character } from "@/lib/types";
import XPBar from "@/components/XPBar";

// Animated gold count that "ticks" and pops on change.
function GoldCounter({
  gold,
  className = "",
  label,
}: {
  gold: number;
  className?: string;
  label?: string;
}) {
  const prev = useRef(gold);
  const changed = prev.current !== gold;
  useEffect(() => {
    prev.current = gold;
  }, [gold]);

  return (
    <motion.span
      key={gold}
      initial={changed ? { scale: 1.35 } : false}
      animate={{ scale: 1 }}
      transition={{ type: "spring", stiffness: 400, damping: 14 }}
      className={className}
      aria-label={label ?? `${gold} gold`}
    >
      🪙 {gold}
    </motion.span>
  );
}

// Odometer-style number roll for level display.
function AnimatedNumber({
  value,
  className = "",
}: {
  value: number;
  className?: string;
}) {
  return (
    <span className={`inline-flex h-4 overflow-hidden ${className}`}>
      <AnimatePresence initial={false} mode="popLayout">
        <motion.span
          key={value}
          initial={{ y: 14, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: -14, opacity: 0 }}
          transition={{ type: "spring", stiffness: 300, damping: 24 }}
        >
          {value}
        </motion.span>
      </AnimatePresence>
    </span>
  );
}

const LINKS = [
  { href: "/dashboard", label: "Quest Board", icon: "📜" },
  { href: "/character", label: "Character", icon: "🧝" },
  { href: "/shop", label: "Emporium", icon: "🏛️" },
];

interface AppNavProps {
  character: Character | null;
}

/**
 * Top navigation: brand, section links, and a live character HUD.
 * Shows level, XP bar, gold, and streak so progress is always visible.
 */
export default function AppNav({ character }: AppNavProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = useState(false);

  // Apply the equipped theme accent to the document.
  useEffect(() => {
    if (character?.profile.avatar_theme) {
      document.documentElement.setAttribute(
        "data-theme",
        character.profile.avatar_theme
      );
      try {
        localStorage.setItem("liferpg-theme", character.profile.avatar_theme);
      } catch {
        /* private mode */
      }
    }
  }, [character?.profile.avatar_theme]);

  async function handleLogout() {
    if (backendMode() === "local") {
      await fetch("/api/auth/logout", { method: "POST" });
    } else {
      const supabase = createClient();
      await supabase.auth.signOut();
    }
    router.replace("/login");
    router.refresh();
  }

  const p = character?.profile;

  return (
    <header className="sticky top-0 z-40 border-b border-night-700/60 bg-night-950/85 backdrop-blur">
      <nav
        aria-label="Main"
        className="mx-auto flex max-w-6xl items-center gap-2 px-4 py-3 sm:gap-4"
      >
        <Link
          href="/dashboard"
          className="font-display text-lg font-black tracking-wide text-accent"
        >
          ⚔ <span className="hidden sm:inline">Life RPG</span>
        </Link>

        {/* Desktop links with sliding active indicator */}
        <div className="hidden items-center gap-1 sm:flex">
          {LINKS.map((l) => {
            const active = pathname.startsWith(l.href);
            return (
              <Link
                key={l.href}
                href={l.href}
                aria-current={active ? "page" : undefined}
                className={`relative rounded-lg px-3 py-1.5 text-sm font-semibold transition ${
                  active ? "text-accent" : "text-parchment-dim hover:text-parchment"
                }`}
              >
                {active && (
                  <motion.span
                    layoutId="nav-active-pill"
                    className="absolute inset-0 rounded-lg accent-soft-bg"
                    transition={{ type: "spring", stiffness: 380, damping: 30 }}
                  />
                )}
                <span aria-hidden className="relative mr-1.5">
                  {l.icon}
                </span>
                <span className="relative">{l.label}</span>
              </Link>
            );
          })}
        </div>

        <div className="ml-auto flex items-center gap-3">
          {p && (
            <>
              {/* HUD */}
              <div className="hidden w-44 md:block">
                <div className="flex items-center justify-between text-xs text-parchment-dim">
                  <span>
                    Lv{" "}
                    <AnimatedNumber
                      value={p.level}
                      className="font-bold text-accent"
                    />
                  </span>
                  <GoldCounter gold={p.gold} label={`${p.gold} gold`} />
                  <span
                    aria-label={`${character?.streak.current} day streak`}
                    title={`${character?.streak.current}-day streak (best ${character?.streak.best})`}
                  >
                    🔥 {character?.streak.current ?? 0}
                  </span>
                </div>
                <XPBar
                  value={p.xp}
                  max={character?.xp_needed ?? 100}
                  height="h-1.5"
                  label={`Level progress, ${p.xp} of ${character?.xp_needed ?? 100} experience`}
                />
              </div>

              {/* Compact HUD for small screens */}
              <div className="flex items-center gap-2 md:hidden">
                <motion.span
                  key={`lvl-${p.level}`}
                  initial={{ scale: 1.4, backgroundColor: "rgba(245,158,11,0.45)" }}
                  animate={{ scale: 1, backgroundColor: "rgba(245,158,11,0.15)" }}
                  transition={{ type: "spring", stiffness: 300, damping: 15 }}
                  className="rounded-md px-2 py-0.5 text-xs font-bold text-accent"
                >
                  Lv {p.level}
                </motion.span>
                <GoldCounter gold={p.gold} className="text-xs" label={`${p.gold} gold`} />
              </div>

              <motion.button
                whileTap={{ scale: 0.94 }}
                onClick={handleLogout}
                className="rounded-lg border border-night-600 px-2.5 py-1.5 text-xs font-semibold text-parchment-dim transition hover:border-hp/50 hover:text-red-300"
              >
                Log out
              </motion.button>
            </>
          )}

          {/* Mobile menu toggle */}
          <button
            type="button"
            className="rounded-lg p-2 text-parchment-dim hover:text-parchment sm:hidden"
            aria-expanded={mobileOpen}
            aria-controls="mobile-nav"
            aria-label="Toggle navigation menu"
            onClick={() => setMobileOpen((v) => !v)}
          >
            ☰
          </button>
        </div>
      </nav>

      {/* Mobile links */}
      {mobileOpen && (
        <div id="mobile-nav" className="border-t border-night-700/60 sm:hidden">
          <div className="mx-auto flex max-w-6xl flex-col px-4 py-2">
            {LINKS.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                aria-current={pathname.startsWith(l.href) ? "page" : undefined}
                onClick={() => setMobileOpen(false)}
                className={`rounded-lg px-3 py-2.5 text-sm font-semibold ${
                  pathname.startsWith(l.href)
                    ? "accent-soft-bg text-accent"
                    : "text-parchment-dim"
                }`}
              >
                <span aria-hidden className="mr-2">
                  {l.icon}
                </span>
                {l.label}
              </Link>
            ))}
          </div>
        </div>
      )}
    </header>
  );
}
