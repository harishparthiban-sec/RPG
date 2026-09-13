"use client";

import { motion } from "framer-motion";

interface XPBarProps {
  value: number;
  max: number;
  label?: string;
  height?: string;
  showNumbers?: boolean;
}

/**
 * Animated XP bar. Width springs to the new percentage; a subtle shimmer
 * sweeps across while the bar is not full.
 */
export default function XPBar({
  value,
  max,
  label,
  height = "h-3",
  showNumbers = false,
}: XPBarProps) {
  const pct = max > 0 ? Math.min(100, Math.round((value / max) * 100)) : 0;

  return (
    <div
      role="progressbar"
      aria-valuenow={Math.round(value)}
      aria-valuemin={0}
      aria-valuemax={max}
      aria-label={label ?? "Experience progress"}
    >
      {showNumbers && (
        <div className="mb-1 flex items-center justify-between text-xs text-parchment-dim">
          <span>
            {Math.round(value)} / {max} XP
          </span>
          <span className="text-accent font-semibold">{pct}%</span>
        </div>
      )}
      <div
        className={`${height} w-full overflow-hidden rounded-full bg-night-700/60`}
      >
        <motion.div
          className="relative h-full rounded-full bg-accent"
          initial={false}
          animate={{ width: `${pct}%` }}
          transition={{ type: "spring", stiffness: 120, damping: 20 }}
          style={{
            boxShadow: "0 0 12px var(--accent)",
          }}
        >
          {!full(pct) && (
            <motion.div
              className="absolute inset-0 rounded-full"
              style={{
                background:
                  "linear-gradient(110deg, transparent 30%, rgba(255,255,255,0.35) 50%, transparent 70%)",
                backgroundSize: "200% 100%",
              }}
              animate={{ backgroundPosition: ["200% 0", "-200% 0"] }}
              transition={{ repeat: Infinity, duration: 1.8, ease: "linear" }}
            />
          )}
        </motion.div>
      </div>
    </div>
  );
}

function full(pct: number) {
  return pct >= 100;
}
