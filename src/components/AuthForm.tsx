"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { backendMode } from "@/lib/backend";
import Button from "@/components/Button";

interface AuthFormProps {
  mode: "login" | "signup";
}

/**
 * Email/password auth form.
 * - Local mode (default, zero config): posts to /api/auth/* (SQLite + sessions).
 * - Supabase mode: signs in via the Supabase SDK.
 */
export default function AuthForm({ mode }: AuthFormProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const nextPath = searchParams.get("next") ?? "/dashboard";
  const localMode = backendMode() === "local";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [username, setUsername] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const isSignup = mode === "signup";

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setNotice(null);

    // Client-side validation (server re-validates everything).
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError("Please enter a valid email address.");
      return;
    }
    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }

    setLoading(true);
    try {
      if (localMode) {
        const res = await fetch(`/api/auth/${mode}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(
            isSignup ? { email, password, username } : { email, password }
          ),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "Authentication failed.");
        router.replace(nextPath);
        router.refresh();
      } else {
        const supabase = createClient();
        if (isSignup) {
          const { data, error } = await supabase.auth.signUp({
            email,
            password,
            options: {
              data: {
                username:
                  username.trim() ||
                  email.split("@")[0].slice(0, 20) ||
                  "Adventurer",
              },
            },
          });
          if (error) throw error;
          if (data.session) {
            router.replace(nextPath);
            router.refresh();
          } else {
            setNotice(
              "Character created! Check your email to confirm your account, then log in."
            );
          }
        } else {
          const { error } = await supabase.auth.signInWithPassword({
            email,
            password,
          });
          if (error) throw error;
          router.replace(nextPath);
          router.refresh();
        }
      }
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Something went wrong.";
      setError(friendlyAuthError(message));
    } finally {
      setLoading(false);
    }
  }

  async function handleDemoLogin() {
    setError(null);
    setLoading(true);
    try {
      if (localMode) {
        const res = await fetch("/api/auth/login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: "demo@liferpg.dev", password: "demo1234" }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "Demo login failed.");
        router.replace(nextPath);
        router.refresh();
      } else {
        const supabase = createClient();
        const { error } = await supabase.auth.signInWithPassword({
          email: "demo@liferpg.dev",
          password: "demo1234",
        });
        if (error) throw error;
        router.replace(nextPath);
        router.refresh();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Demo login failed.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="panel p-6 sm:p-8">
      <h1 className="font-display text-2xl font-bold text-parchment">
        {isSignup ? "Create your character" : "Welcome back, adventurer"}
      </h1>
      <p className="mt-1 text-sm text-parchment-dim">
        {isSignup
          ? "Every legend starts at level 1."
          : "Your quests await your return."}
      </p>

      <form onSubmit={handleSubmit} className="mt-6 space-y-4" noValidate>
        {isSignup && (
          <div>
            <label
              htmlFor="username"
              className="mb-1 block text-xs font-semibold uppercase tracking-wider text-parchment-dim"
            >
              Hero name
            </label>
            <input
              id="username"
              name="username"
              type="text"
              autoComplete="nickname"
              maxLength={20}
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Nightblade"
              className="w-full rounded-lg border border-night-600 bg-night-900/70 px-3 py-2.5 text-parchment placeholder:text-parchment-dim/50 focus:border-accent"
            />
          </div>
        )}

        <div>
          <label
            htmlFor="email"
            className="mb-1 block text-xs font-semibold uppercase tracking-wider text-parchment-dim"
          >
            Email
          </label>
          <input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            aria-describedby={error ? "auth-error" : undefined}
            className="w-full rounded-lg border border-night-600 bg-night-900/70 px-3 py-2.5 text-parchment placeholder:text-parchment-dim/50 focus:border-accent"
          />
        </div>

        <div>
          <label
            htmlFor="password"
            className="mb-1 block text-xs font-semibold uppercase tracking-wider text-parchment-dim"
          >
            Password
          </label>
          <input
            id="password"
            name="password"
            type="password"
            autoComplete={isSignup ? "new-password" : "current-password"}
            required
            minLength={8}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            className="w-full rounded-lg border border-night-600 bg-night-900/70 px-3 py-2.5 text-parchment placeholder:text-parchment-dim/50 focus:border-accent"
          />
          {isSignup && (
            <p className="mt-1 text-xs text-parchment-dim">
              At least 8 characters.
            </p>
          )}
        </div>

        {error && (
          <p
            id="auth-error"
            role="alert"
            className="rounded-lg border border-hp/40 bg-red-950/50 px-3 py-2 text-sm text-red-200"
          >
            ⚠️ {error}
          </p>
        )}
        {notice && (
          <p
            role="status"
            className="rounded-lg border border-emerald-500/40 bg-emerald-950/50 px-3 py-2 text-sm text-emerald-200"
          >
            ✉️ {notice}
          </p>
        )}

        <Button type="submit" loading={loading} className="w-full py-2.5">
          {isSignup ? "Forge your character" : "Enter the realm"}
        </Button>
      </form>

      <div className="my-4 flex items-center gap-3">
        <div className="rule flex-1" />
        <span className="text-xs text-parchment-dim">or</span>
        <div className="rule flex-1" />
      </div>

      <Button
        type="button"
        variant="ghost"
        onClick={handleDemoLogin}
        loading={loading}
        className="w-full py-2.5"
      >
        🎭 Try the demo character
      </Button>

      <div className="rule my-6" />

      <p className="text-center text-sm text-parchment-dim">
        {isSignup ? (
          <>
            Already have a character?{" "}
            <Link
              href="/login"
              className="font-semibold text-accent hover:underline"
            >
              Log in
            </Link>
          </>
        ) : (
          <>
            New to the realm?{" "}
            <Link
              href="/signup"
              className="font-semibold text-accent hover:underline"
            >
              Create a character
            </Link>
          </>
        )}
      </p>
    </div>
  );
}

function friendlyAuthError(message: string): string {
  const m = message.toLowerCase();
  if (m.includes("invalid login credentials"))
    return "Wrong email or password — check your scroll and try again.";
  if (m.includes("already has a character") || m.includes("already registered"))
    return "That email already has a character. Try logging in instead.";
  if (m.includes("rate limit"))
    return "Too many attempts. Rest a moment and try again.";
  if (m.includes("email not confirmed"))
    return "Please confirm your email first (check your inbox).";
  return message;
}
