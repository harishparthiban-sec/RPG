"use client";

import { useCallback, useEffect, useState } from "react";
import { motion } from "framer-motion";
import type { ShopItem, ShopItemKind, ShopState } from "@/lib/types";
import { useAppShell } from "@/components/AppShell";
import { useToast } from "@/components/Toast";
import Button from "@/components/Button";
import { ShopSkeleton } from "@/components/Skeletons";

const KIND_META: Record<
  ShopItemKind,
  { label: string; icon: string; blurb: string }
> = {
  theme: {
    label: "Themes",
    icon: "🎨",
    blurb: "Repaint the entire realm in your colors.",
  },
  title: { label: "Titles", icon: "📛", blurb: "Names that echo in taverns." },
  relic: { label: "Relics", icon: "🏺", blurb: "Trophies for your display case." },
};

const KIND_ORDER: ShopItemKind[] = ["theme", "title", "relic"];

export default function Shop() {
  const { refreshCharacter } = useAppShell();
  const { toast } = useToast();

  const [state, setState] = useState<ShopState | null>(null);
  const [busyKey, setBusyKey] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await fetch("/api/shop", { cache: "no-store" });
    if (!res.ok) throw new Error("Failed to load shop");
    setState(await res.json());
  }, []);

  useEffect(() => {
    load().catch(() =>
      toast("The emporium is unreachable. Refresh to try again.", "error")
    );
  }, [load, toast]);

  async function buy(item: ShopItem) {
    if (busyKey) return;
    setBusyKey(item.key);
    // Optimistic: assume purchase succeeds; roll back on failure.
    setState((prev) =>
      prev
        ? {
            ...prev,
            gold: prev.gold - item.price,
            owned: [...prev.owned, { item_key: item.key, equipped: false }],
          }
        : prev
    );
    try {
      const res = await fetch("/api/shop", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ item_key: item.key }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Purchase failed");
      toast(`Acquired ${item.name}! ${item.icon}`, "reward");
      await refreshCharacter();
    } catch (err) {
      // Roll back.
      setState((prev) =>
        prev
          ? {
              ...prev,
              gold: prev.gold + item.price,
              owned: prev.owned.filter((o) => o.item_key !== item.key),
            }
          : prev
      );
      toast(err instanceof Error ? err.message : "Purchase failed", "error");
    } finally {
      setBusyKey(null);
    }
  }

  async function equip(item: ShopItem) {
    if (busyKey) return;
    setBusyKey(item.key);
    try {
      const res = await fetch("/api/shop", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ item_key: item.key }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Equip failed");

      // Refresh state: equip endpoint returns authoritative profile.
      await load();
      if (item.kind === "theme") {
        document.documentElement.setAttribute("data-theme", item.key);
        try {
          localStorage.setItem("liferpg-theme", item.key);
        } catch {
          /* private mode */
        }
        toast(`Theme applied: ${item.name}`, "success");
      } else {
        toast(`Equipped ${item.name}`, "success");
      }
      await refreshCharacter();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Equip failed", "error");
    } finally {
      setBusyKey(null);
    }
  }

  if (!state) return <ShopSkeleton />;

  const ownedMap = new Map(state.owned.map((o) => [o.item_key, o]));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold text-parchment">
            Guild Emporium
          </h1>
          <p className="text-sm text-parchment-dim">
            Trade quest gold for glory. Purchases are permanent — choose boldly.
          </p>
        </div>
        <p
          className="rounded-xl border border-accent/40 accent-soft-bg px-4 py-2 font-display text-lg font-bold text-accent"
          aria-live="polite"
        >
          🪙 {state.gold} gold
        </p>
      </div>

      {KIND_ORDER.map((kind) => {
        const items = state.items.filter((i) => i.kind === kind);
        const meta = KIND_META[kind];
        return (
          <section key={kind} aria-label={meta.label}>
            <div className="mb-3">
              <h2 className="font-display text-lg font-bold text-parchment">
                <span aria-hidden className="mr-2">
                  {meta.icon}
                </span>
                {meta.label}
              </h2>
              <p className="text-xs text-parchment-dim">{meta.blurb}</p>
            </div>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {items.map((item, i) => (
                <ItemCard
                  key={item.key}
                  item={item}
                  owned={ownedMap.has(item.key)}
                  equipped={ownedMap.get(item.key)?.equipped ?? false}
                  affordable={state.gold >= item.price}
                  busy={busyKey === item.key}
                  index={i}
                  onBuy={() => buy(item)}
                  onEquip={() => equip(item)}
                />
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}

function ItemCard({
  item,
  owned,
  equipped,
  affordable,
  busy,
  index,
  onBuy,
  onEquip,
}: {
  item: ShopItem;
  owned: boolean;
  equipped: boolean;
  affordable: boolean;
  busy: boolean;
  index: number;
  onBuy: () => void;
  onEquip: () => void;
}) {
  return (
    <motion.article
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.04 }}
      className={`panel panel-hover flex flex-col p-5 ${
        equipped ? "border-accent/60 shadow-glow" : ""
      }`}
    >
      <div className="flex items-start justify-between">
        <span aria-hidden className="text-3xl">
          {item.icon}
        </span>
        {equipped && (
          <span className="rounded-full accent-soft-bg px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-accent">
            Equipped
          </span>
        )}
      </div>
      <h3 className="mt-3 font-display font-bold text-parchment">{item.name}</h3>
      <p className="mt-1 flex-1 text-sm text-parchment-dim">
        {item.description}
      </p>
      <div className="mt-4 flex items-center justify-between">
        <span
          className={`font-mono text-sm font-bold ${
            affordable || owned ? "text-accent" : "text-parchment-dim"
          }`}
        >
          🪙 {item.price}
        </span>
        {owned ? (
          item.kind === "relic" ? (
            <span className="text-xs font-semibold text-parchment-dim">
              In your vault ✦
            </span>
          ) : equipped ? (
            <Button variant="ghost" disabled onClick={onEquip}>
              Active
            </Button>
          ) : (
            <Button variant="ghost" loading={busy} onClick={onEquip}>
              Equip
            </Button>
          )
        ) : (
          <Button
            loading={busy}
            disabled={!affordable}
            onClick={onBuy}
            title={affordable ? undefined : "Not enough gold — complete more quests!"}
          >
            Buy
          </Button>
        )}
      </div>
    </motion.article>
  );
}
