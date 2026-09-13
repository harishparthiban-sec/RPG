"use client";

import { forwardRef } from "react";
import { motion, type HTMLMotionProps } from "framer-motion";

type Variant = "primary" | "ghost" | "danger" | "subtle";

interface ButtonProps extends Omit<HTMLMotionProps<"button">, "children"> {
  variant?: Variant;
  loading?: boolean;
  children?: React.ReactNode;
}

const VARIANTS: Record<Variant, string> = {
  primary:
    "bg-accent text-night-950 font-bold shadow-glow hover:brightness-110 active:brightness-95",
  ghost:
    "border border-night-600 text-parchment hover:border-accent hover:text-accent",
  danger:
    "border border-hp/40 text-red-300 hover:bg-hp/10 hover:text-red-200",
  subtle: "text-parchment-dim hover:text-parchment hover:bg-night-700/60",
};

/**
 * RPG button with press "squash" feedback and a loading state.
 * Renders motion.button for springy tactile feel.
 */
const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = "primary", loading, className = "", children, ...props },
  ref
) {
  return (
    <motion.button
      ref={ref}
      whileTap={{ scale: 0.96 }}
      whileHover={{ scale: 1.015 }}
      transition={{ type: "spring", stiffness: 400, damping: 18 }}
      className={`inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm transition disabled:cursor-not-allowed disabled:opacity-50 ${VARIANTS[variant]} ${className}`}
      {...props}
    >
      {loading && (
        <span
          aria-hidden
          className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent"
        />
      )}
      {children}
    </motion.button>
  );
});

export default Button;
