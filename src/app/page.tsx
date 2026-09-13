"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import EmberField from "@/components/EmberField";

// Staggered entrance helper for hero children.
const rise = {
  hidden: { opacity: 0, y: 24 },
  show: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: 0.12 * i, type: "spring" as const, stiffness: 120, damping: 18 },
  }),
};

export default function LandingPage() {
  return (
    <div className="relative flex min-h-dvh flex-col">
      <EmberField count={24} />
      <header className="relative z-10 mx-auto flex w-full max-w-6xl items-center justify-between px-4 py-4">
        <p className="font-display text-xl font-black text-accent">⚔ Life RPG</p>
        <nav aria-label="Account" className="flex items-center gap-2">
          <Link
            href="/login"
            className="rounded-lg px-4 py-2 text-sm font-semibold text-parchment-dim transition hover:text-parchment"
          >
            Log in
          </Link>
          <Link
            href="/signup"
            className="rounded-lg bg-accent px-4 py-2 text-sm font-bold text-night-950 shadow-glow transition hover:brightness-110"
          >
            Start free
          </Link>
        </nav>
      </header>

      <main id="main-content" className="relative z-10 flex-1">
        {/* Hero */}
        <section className="mx-auto max-w-6xl px-4 pb-16 pt-12 text-center sm:pt-20">
          <motion.div custom={0} variants={rise} initial="hidden" animate="show">
            <p className="font-mono text-xs uppercase tracking-[0.4em] text-parchment-dim">
              A gamified productivity RPG
            </p>
          </motion.div>
          <motion.h1
            custom={1}
            variants={rise}
            initial="hidden"
            animate="show"
            className="mx-auto mt-4 max-w-3xl font-display text-4xl font-black leading-tight text-parchment sm:text-6xl"
          >
            Turn your life into an{" "}
            <span className="text-accent drop-shadow-[0_0_18px_var(--accent)]">
              epic quest
            </span>
          </motion.h1>
          <motion.p
            custom={2}
            variants={rise}
            initial="hidden"
            animate="show"
            className="mx-auto mt-6 max-w-xl text-lg text-parchment-dim"
          >
            Chores become quests. Workouts become battles. Streaks become legend.
            Earn XP, hoard gold, and level up real attributes — every single day.
          </motion.p>
          <motion.div
            custom={3}
            variants={rise}
            initial="hidden"
            animate="show"
            className="mt-8 flex flex-wrap items-center justify-center gap-3"
          >
            <Link
              href="/signup"
              className="rounded-xl bg-accent px-8 py-3.5 font-bold text-night-950 shadow-glow transition hover:brightness-110"
            >
              Forge your character
            </Link>
            <Link
              href="/login"
              className="rounded-xl border border-night-600 px-8 py-3.5 font-semibold text-parchment transition hover:border-accent hover:text-accent"
            >
              I have a character
            </Link>
          </motion.div>

          {/* Sample HUD strip — floats gently like a real game HUD */}
          <motion.div
            aria-hidden
            initial={{ opacity: 0, y: 32 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.55, type: "spring", stiffness: 90, damping: 16 }}
            className="mx-auto mt-14 max-w-2xl"
          >
            <motion.div
              animate={{ y: [0, -6, 0] }}
              transition={{ repeat: Infinity, duration: 5, ease: "easeInOut" }}
              className="panel grid grid-cols-2 gap-4 p-6 sm:grid-cols-4"
            >
              {[
                { icon: "⚔", label: "Level 12", sub: "Knight-Captain" },
                { icon: "🔥", label: "23 days", sub: "streak" },
                { icon: "🪙", label: "1,240", sub: "gold" },
                { icon: "📚", label: "Lv 8", sub: "Intellect" },
              ].map((s) => (
                <div key={s.label}>
                  <p className="text-2xl">{s.icon}</p>
                  <p className="mt-1 font-display font-bold text-accent">
                    {s.label}
                  </p>
                  <p className="text-xs text-parchment-dim">{s.sub}</p>
                </div>
              ))}
            </motion.div>
          </motion.div>
        </section>

        {/* Features */}
        <section
          aria-label="Features"
          className="mx-auto grid max-w-6xl gap-4 px-4 pb-20 sm:grid-cols-2 lg:grid-cols-3"
        >
          {[
            {
              icon: "📜",
              title: "Quest Board",
              body: "Tag tasks by attribute and difficulty. Completion pays XP and gold — computed on the server, immune to cheaters.",
            },
            {
              icon: "📈",
              title: "Non-linear progression",
              body: "Each level costs more than the last (100 × level^1.5). Early wins are quick; real growth is earned.",
            },
            {
              icon: "🔥",
              title: "Streaks",
              body: "Complete at least one quest a day to grow your streak — and earn a rising XP bonus that caps at +50%.",
            },
            {
              icon: "💪",
              title: "Five attributes",
              body: "Strength, Intellect, Vitality, Creativity, Focus. Every quest trains the stat that matches the effort.",
            },
            {
              icon: "🏛️",
              title: "Guild Emporium",
              body: "Spend gold on themes that repaint the app, titles that broadcast your legend, and relics for your vault.",
            },
            {
              icon: "📱",
              title: "Yours everywhere",
              body: "Full keyboard navigation, screen-reader friendly, and responsive from phone to ultrawide. Your data syncs to the cloud.",
            },
          ].map((f, i) => (
            <motion.article
              key={f.title}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-40px" }}
              transition={{ delay: (i % 3) * 0.08, type: "spring", stiffness: 110, damping: 18 }}
              className="panel panel-hover p-6"
            >
              <span aria-hidden className="text-3xl">
                {f.icon}
              </span>
              <h2 className="mt-3 font-display text-lg font-bold text-parchment">
                {f.title}
              </h2>
              <p className="mt-1.5 text-sm leading-relaxed text-parchment-dim">
                {f.body}
              </p>
            </motion.article>
          ))}
        </section>
      </main>

      <footer className="relative z-10 border-t border-night-700/60 py-8 text-center text-sm text-parchment-dim">
        Built with Next.js, Supabase, Tailwind & Framer Motion · Your legend
        awaits ⚔
      </footer>
    </div>
  );
}
