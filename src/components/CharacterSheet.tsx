"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import type { Transaction } from "@/lib/types";
import { useAppShell } from "@/components/AppShell";
import XPBar from "@/components/XPBar";
import { CharacterSkeleton } from "@/components/Skeletons";

const THEME_AVATAR: Record<string, string> = {
  default: "🧝",
  "theme-crimson": "🧛",
  "theme-verdant": "🧚",
  "theme-arcane": "🧙",
  "theme-dawn": "🦸",
};

export default function CharacterSheet() {
  const { character } = useAppShell();
  const [transactions, setTransactions] = useState<Transaction[] | null>(null);

  useEffect(() => {
    fetch("/api/transactions", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((d) => setTransactions(d.transactions))
      .catch(() => setTransactions([]));
  }, []);

  if (!character) return <CharacterSkeleton />;

  const { profile: p, attributes, streak, xp_needed } = character;

  return (
    <div className="space-y-6">
      <h1 className="font-display text-2xl font-bold text-parchment">
        Character Sheet
      </h1>

      {/* ── Hero panel ── */}
      <section aria-label="Character overview" className="panel relative overflow-hidden p-6">
        {/* subtle accent aura behind the avatar */}
        <div
          aria-hidden
          className="pointer-events-none absolute -left-16 -top-16 h-48 w-48 rounded-full blur-3xl"
          style={{ background: "radial-gradient(circle, var(--accent-soft), transparent 70%)" }}
        />
        <div className="relative flex flex-col gap-6 sm:flex-row sm:items-center">
          <div className="relative">
            {/* pulsing ring */}
            <motion.div
              aria-hidden
              className="absolute inset-0 rounded-2xl border-2 border-accent"
              animate={{ scale: [1, 1.12, 1], opacity: [0.5, 0, 0.5] }}
              transition={{ repeat: Infinity, duration: 2.4, ease: "easeInOut" }}
            />
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: "spring", stiffness: 200, damping: 16 }}
              className="flex h-20 w-20 items-center justify-center rounded-2xl border-2 border-accent/60 accent-soft-bg text-4xl shadow-glow"
            >
              {THEME_AVATAR[p.avatar_theme] ?? "🧝"}
            </motion.div>
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-baseline gap-x-3">
              <h2 className="font-display text-2xl font-black text-parchment">
                {p.username}
              </h2>
              <motion.span
                key={p.title}
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                className="rounded-full accent-soft-bg px-2.5 py-0.5 text-xs font-bold text-accent"
              >
                {p.title}
              </motion.span>
            </div>
            <p className="mt-0.5 text-sm text-parchment-dim">
              Level {p.level} · {character.total_xp_earned.toLocaleString()} lifetime XP
            </p>

            <div className="mt-3 max-w-md">
              <XPBar
                value={p.xp}
                max={xp_needed}
                showNumbers
                label={`Level progress, ${p.xp} of ${xp_needed} experience`}
              />
            </div>
          </div>

          <dl className="grid grid-cols-2 gap-3 text-center sm:grid-cols-1">
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="rounded-xl border border-night-700/60 bg-night-900/50 px-4 py-2"
            >
              <dt className="text-[11px] uppercase tracking-wider text-parchment-dim">
                Gold
              </dt>
              <dd className="text-lg font-bold text-accent">🪙 {p.gold}</dd>
            </motion.div>
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.18 }}
              className="rounded-xl border border-night-700/60 bg-night-900/50 px-4 py-2"
            >
              <dt className="text-[11px] uppercase tracking-wider text-parchment-dim">
                Streak
              </dt>
              <dd className="text-lg font-bold text-accent">
                <motion.span
                  animate={streak.current > 0 ? { scale: [1, 1.15, 1] } : undefined}
                  transition={{ repeat: Infinity, duration: 1.6 }}
                  className="inline-block"
                >
                  🔥
                </motion.span>{" "}
                {streak.current}
                <span className="ml-1 text-xs font-normal text-parchment-dim">
                  (best {streak.best})
                </span>
              </dd>
            </motion.div>
          </dl>
        </div>
      </section>

      {/* ── Attributes ── */}
      <section aria-label="Attributes">
        <h3 className="mb-3 font-display text-lg font-bold text-parchment">
          Attributes
        </h3>
        <div className="grid gap-4 sm:grid-cols-2">
          {attributes.map((a, i) => (
            <motion.div
              key={a.key}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              className="panel panel-hover p-5"
            >
              <div className="flex items-center justify-between">
                <p className="flex items-center gap-2 font-semibold text-parchment">
                  <span aria-hidden className="text-xl">
                    {a.icon}
                  </span>
                  {a.label}
                </p>
                <span className="rounded-md accent-soft-bg px-2 py-0.5 text-xs font-bold text-accent">
                  Lv {a.level}
                </span>
              </div>
              <div className="mt-3">
                <XPBar
                  value={a.xp}
                  max={Math.round(40 * Math.pow(a.level + 1, 1.35))}
                  height="h-2"
                  label={`${a.label} progress, level ${a.level}`}
                />
              </div>
              <p className="mt-2 text-xs text-parchment-dim">{a.blurb}</p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* ── Gold ledger ── */}
      <section aria-label="Gold ledger">
        <h3 className="mb-3 font-display text-lg font-bold text-parchment">
          Ledger of Deeds
        </h3>
        {transactions === null ? (
          <div className="panel space-y-2 p-5" aria-hidden>
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="skeleton h-5 w-full" />
            ))}
          </div>
        ) : transactions.length === 0 ? (
          <p className="panel p-5 text-sm text-parchment-dim">
            No deeds recorded yet. Complete quests to earn gold.
          </p>
        ) : (
          <ul className="panel divide-y divide-night-700/50">
            {transactions.map((t, i) => (
              <motion.li
                key={t.id}
                initial={{ opacity: 0, x: -12 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.05 }}
                className="flex items-center justify-between gap-3 px-5 py-3 text-sm"
              >
                <span className="min-w-0 truncate text-parchment">
                  {t.reason}
                </span>
                <span
                  className={`shrink-0 font-mono font-bold ${
                    t.amount >= 0 ? "text-emerald-400" : "text-red-400"
                  }`}
                >
                  {t.amount >= 0 ? "+" : ""}
                  {t.amount} 🪙
                </span>
              </motion.li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
