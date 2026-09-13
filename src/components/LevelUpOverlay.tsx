"use client";

import { useEffect, useMemo } from "react";
import { AnimatePresence, motion } from "framer-motion";

interface LevelUpOverlayProps {
  open: boolean;
  level: number;
  title?: string;
  onClose: () => void;
}

const PARTICLE_COLORS = ["#f59e0b", "#fcd34d", "#22d3ee", "#e8e0d0"];

/**
 * Full-screen "LEVEL UP" celebration: radial particle burst + springy reveal.
 * Dismisses on click, Escape, or after 4 seconds.
 */
export default function LevelUpOverlay({
  open,
  level,
  title,
  onClose,
}: LevelUpOverlayProps) {
  const particles = useMemo(
    () =>
      Array.from({ length: 28 }, (_, i) => ({
        id: i,
        angle: (i / 28) * Math.PI * 2,
        distance: 90 + (i % 5) * 28,
        size: 4 + (i % 3) * 3,
        color: PARTICLE_COLORS[i % PARTICLE_COLORS.length],
        delay: (i % 7) * 0.05,
      })),
    []
  );

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    const timer = window.setTimeout(onClose, 4200);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.clearTimeout(timer);
    };
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          role="alertdialog"
          aria-label={`Level up! You reached level ${level}`}
          className="fixed inset-0 z-[80] flex items-center justify-center bg-night-950/80 backdrop-blur-sm"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
        >
          <div className="relative flex flex-col items-center px-6 text-center">
            {/* particle burst */}
            <div aria-hidden className="pointer-events-none absolute left-1/2 top-1/2">
              {particles.map((p) => (
                <motion.span
                  key={p.id}
                  className="absolute rounded-full"
                  style={{
                    width: p.size,
                    height: p.size,
                    backgroundColor: p.color,
                    boxShadow: `0 0 ${p.size * 2}px ${p.color}`,
                  }}
                  initial={{ x: 0, y: 0, opacity: 1, scale: 0 }}
                  animate={{
                    x: Math.cos(p.angle) * p.distance,
                    y: Math.sin(p.angle) * p.distance,
                    opacity: 0,
                    scale: [0, 1.4, 0.8],
                  }}
                  transition={{ duration: 1.4, delay: p.delay, ease: "easeOut" }}
                />
              ))}
            </div>

            <motion.div
              initial={{ scale: 0.6, rotate: -6, opacity: 0 }}
              animate={{ scale: 1, rotate: 0, opacity: 1 }}
              transition={{ type: "spring", stiffness: 200, damping: 14 }}
              className="relative"
            >
              <p className="font-mono text-xs uppercase tracking-[0.35em] text-parchment-dim">
                ✦ You have grown stronger ✦
              </p>
              <h2 className="mt-2 font-display text-5xl font-bold text-accent drop-shadow-[0_0_18px_var(--accent)] sm:text-6xl">
                LEVEL {level}
              </h2>
              {title && (
                <p className="mt-3 text-lg text-parchment">
                  New rank unlocked:{" "}
                  <span className="font-display font-bold text-accent">
                    {title}
                  </span>
                </p>
              )}
              <p className="mt-6 text-sm text-parchment-dim">
                Click anywhere to continue your journey
              </p>
            </motion.div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
