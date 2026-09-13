"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { Character } from "@/lib/types";
import AppNav from "@/components/AppNav";
import { ToastProvider } from "@/components/Toast";

interface AppShellState {
  character: Character | null;
  refreshCharacter: () => Promise<void>;
  applyProfile: (profile: Character["profile"]) => void;
}

const AppShellContext = createContext<AppShellState>({
  character: null,
  refreshCharacter: async () => {},
  applyProfile: () => {},
});

/** Access the live character state inside app pages. */
export function useAppShell() {
  return useContext(AppShellContext);
}

/**
 * Client shell for all authed pages: loads the character sheet once,
 * shares it via context, and renders the nav HUD.
 */
export default function AppShell({ children }: { children: React.ReactNode }) {
  const [character, setCharacter] = useState<Character | null>(null);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const refreshCharacter = useCallback(async () => {
    try {
      const res = await fetch("/api/character", { cache: "no-store" });
      if (res.status === 401) {
        router.replace("/login");
        return;
      }
      if (!res.ok) throw new Error("Failed to load character");
      setCharacter(await res.json());
      setError(null);
    } catch {
      setError("Could not reach the server. Retrying when you interact next.");
    }
  }, [router]);

  useEffect(() => {
    refreshCharacter();
  }, [refreshCharacter]);

  const applyProfile = useCallback((profile: Character["profile"]) => {
    setCharacter((prev) => (prev ? { ...prev, profile } : prev));
  }, []);

  return (
    <ToastProvider>
      <AppShellContext.Provider value={{ character, refreshCharacter, applyProfile }}>
        <AppNav character={character} />
        <main
          id="main-content"
          className="mx-auto w-full max-w-6xl px-4 py-6 sm:py-8"
        >
          {error && (
            <p
              role="alert"
              className="mb-4 rounded-lg border border-hp/40 bg-red-950/50 px-3 py-2 text-sm text-red-200"
            >
              {error}
            </p>
          )}
          {children}
        </main>
      </AppShellContext.Provider>
    </ToastProvider>
  );
}
