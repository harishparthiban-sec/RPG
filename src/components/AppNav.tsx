"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { createClient } from "@/lib/supabase/client";
import { backendMode } from "@/lib/backend";
import type { Character } from "@/lib/types";
import XPBar from "@/components/XPBar";

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

        {/* Desktop links */}
        <div className="hidden items-center gap-1 sm:flex">
          {LINKS.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              aria-current={pathname.startsWith(l.href) ? "page" : undefined}
              className={`rounded-lg px-3 py-1.5 text-sm font-semibold transition ${
                pathname.startsWith(l.href)
                  ? "accent-soft-bg text-accent"
                  : "text-parchment-dim hover:text-parchment"
              }`}
            >
              <span aria-hidden className="mr-1.5">
                {l.icon}
              </span>
              {l.label}
            </Link>
          ))}
        </div>

        <div className="ml-auto flex items-center gap-3">
          {p && (
            <>
              {/* HUD */}
              <div className="hidden w-44 md:block">
                <div className="flex items-center justify-between text-xs text-parchment-dim">
                  <span>
                    Lv{" "}
                    <span className="font-bold text-accent">{p.level}</span>
                  </span>
                  <span aria-label={`${p.gold} gold`}>🪙 {p.gold}</span>
                  <span aria-label={`${character?.streak.current} day streak`}>
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
                <span className="rounded-md accent-soft-bg px-2 py-0.5 text-xs font-bold text-accent">
                  Lv {p.level}
                </span>
                <span className="text-xs" aria-label={`${p.gold} gold`}>
                  🪙 {p.gold}
                </span>
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
