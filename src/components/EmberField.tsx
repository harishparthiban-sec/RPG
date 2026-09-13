"use client";

import { useMemo } from "react";
import { motion } from "framer-motion";

interface Ember {
  left: number;      // vw %
  size: number;      // px
  duration: number;  // s to cross the screen
  delay: number;     // s
  sway: number;      // px horizontal drift
  hue: string;
}

/**
 * Ambient atmosphere: slowly rising ember motes + a corner vignette.
 * Values are derived deterministically from the index so server and client
 * renders match (no hydration mismatch), and it pauses under
 * prefers-reduced-motion via the global CSS rule.
 */
export default function EmberField({ count = 18 }: { count?: number }) {
  const embers = useMemo<Ember[]>(() => {
    const hues = ["#f59e0b", "#fbbf24", "#f97316", "#e8e0d0"];
    return Array.from({ length: count }, (_, i) => {
      const r = (n: number) => {
        // Deterministic pseudo-random in [0,1) from seed.
        const x = Math.sin(i * 12.9898 + n * 78.233) * 43758.5453;
        return x - Math.floor(x);
      };
      return {
        left: r(1) * 100,
        size: 2 + r(2) * 4,
        duration: 14 + r(3) * 16,
        delay: r(4) * -30,
        sway: 20 + r(5) * 40,
        hue: hues[i % hues.length],
      };
    });
  }, [count]);

  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-0 z-0 overflow-hidden"
    >
      {/* corner vignettes */}
      <div
        className="absolute -left-40 -top-40 h-96 w-96 rounded-full opacity-60 blur-3xl"
        style={{ background: "radial-gradient(circle, rgba(245,158,11,0.10), transparent 70%)" }}
      />
      <div
        className="absolute -bottom-48 -right-32 h-[28rem] w-[28rem] rounded-full opacity-50 blur-3xl"
        style={{ background: "radial-gradient(circle, rgba(56,189,248,0.07), transparent 70%)" }}
      />
      {/* rising motes */}
      {embers.map((e, i) => (
        <motion.span
          key={i}
          className="absolute rounded-full"
          style={{
            left: `${e.left}%`,
            bottom: -8,
            width: e.size,
            height: e.size,
            background: e.hue,
            boxShadow: `0 0 ${e.size * 3}px ${e.hue}`,
          }}
          animate={{
            y: [0, -1100],
            x: [0, e.sway, -e.sway / 2, 0],
            opacity: [0, 0.9, 0.7, 0],
          }}
          transition={{
            duration: e.duration,
            delay: e.delay,
            repeat: Infinity,
            ease: "linear",
            times: [0, 0.35, 0.7, 1],
          }}
        />
      ))}
    </div>
  );
}
