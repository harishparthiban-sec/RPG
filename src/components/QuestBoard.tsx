"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import type {
  CompleteResult,
  Difficulty,
  Quest,
  QuestInput,
  Category,
} from "@/lib/types";
import { CATEGORIES, DIFFICULTIES } from "@/lib/types";
import { DIFFICULTY_XP, DIFFICULTY_GOLD, titleForLevel } from "@/lib/progression";
import { useAppShell } from "@/components/AppShell";
import { useToast } from "@/components/Toast";
import Button from "@/components/Button";
import Modal from "@/components/Modal";
import LevelUpOverlay from "@/components/LevelUpOverlay";
import { QuestSkeleton } from "@/components/Skeletons";

const CATEGORY_META: Record<
  Category,
  { label: string; icon: string; color: string }
> = {
  strength: { label: "Strength", icon: "💪", color: "#ef4444" },
  intellect: { label: "Intellect", icon: "📚", color: "#38bdf8" },
  vitality: { label: "Vitality", icon: "🏃", color: "#10b981" },
  creativity: { label: "Creativity", icon: "🎨", color: "#a78bfa" },
  focus: { label: "Focus", icon: "🎯", color: "#f59e0b" },
};

const DIFFICULTY_META: Record<
  Difficulty,
  { label: string; stars: string; color: string; glow: string }
> = {
  common: { label: "Common", stars: "★", color: "#a89f8d", glow: "rgba(168,159,141,0.35)" },
  rare: { label: "Rare", stars: "★★", color: "#38bdf8", glow: "rgba(56,189,248,0.35)" },
  epic: { label: "Epic", stars: "★★★", color: "#a78bfa", glow: "rgba(167,139,250,0.4)" },
  legendary: { label: "Legendary", stars: "★★★★", color: "#f59e0b", glow: "rgba(245,158,11,0.45)" },
};

type Filter = "active" | "completed" | "all";

export default function QuestBoard() {
  const { refreshCharacter } = useAppShell();
  const { toast } = useToast();

  const [quests, setQuests] = useState<Quest[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>("active");

  const [addOpen, setAddOpen] = useState(false);
  const [editing, setEditing] = useState<Quest | null>(null);
  const [levelUp, setLevelUp] = useState<{ level: number; title?: string } | null>(null);
  const [completingId, setCompletingId] = useState<string | null>(null);

  // ── Data loading ──────────────────────────────────────────────────────
  const loadQuests = useCallback(async () => {
    try {
      const res = await fetch("/api/quests", { cache: "no-store" });
      if (!res.ok) throw new Error();
      const data = await res.json();
      setQuests(data.quests);
      setLoadError(null);
    } catch {
      setLoadError("The quest scroll could not be retrieved. Check your connection.");
    }
  }, []);

  useEffect(() => {
    loadQuests();
  }, [loadQuests]);

  // ── Optimistic create ─────────────────────────────────────────────────
  async function handleCreate(input: QuestInput) {
    const tempId = `temp-${Date.now()}`;
    const optimistic: Quest = {
      id: tempId,
      title: input.title,
      description: input.description ?? null,
      category: input.category,
      difficulty: input.difficulty,
      xp_reward: DIFFICULTY_XP[input.difficulty],
      gold_reward: DIFFICULTY_GOLD[input.difficulty],
      completed: false,
      completed_at: null,
      due_date: input.due_date ?? null,
      created_at: new Date().toISOString(),
    };
    setQuests((prev) => [optimistic, ...(prev ?? [])]);
    setAddOpen(false);

    try {
      const res = await fetch("/api/quests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to create quest");
      // Swap temp row for the real one.
      setQuests((prev) =>
        prev
          ? [data.quest, ...prev.filter((q) => q.id !== tempId)]
          : [data.quest]
      );
      toast(`Quest accepted: “${input.title}”`, "success");
    } catch (err) {
      // Roll back the optimistic row.
      setQuests((prev) => (prev ?? []).filter((q) => q.id !== tempId));
      toast(err instanceof Error ? err.message : "Failed to create quest", "error");
    }
  }

  // ── Optimistic complete (with level-up celebration) ───────────────────
  async function handleComplete(quest: Quest) {
    if (completingId) return; // one celebration at a time
    setCompletingId(quest.id);

    // Optimistically move the quest to completed.
    setQuests((prev) =>
      (prev ?? []).map((q) =>
        q.id === quest.id
          ? { ...q, completed: true, completed_at: new Date().toISOString() }
          : q
      )
    );

    try {
      const res = await fetch(`/api/quests/${quest.id}/complete`, {
        method: "POST",
      });
      const data = (await res.json()) as CompleteResult & { error?: string };
      if (!res.ok) throw new Error(data.error ?? "Completion failed");

      // Sync authoritative state from the engine.
      setQuests((prev) =>
        (prev ?? []).map((q) => (q.id === quest.id ? data.quest : q))
      );

      const parts = [
        `+${data.xp_gained} XP`,
        `+${data.gold_gained} gold`,
      ];
      if (data.streak.kind === "continued") parts.push(`streak ${data.streak.current} 🔥`);
      if (data.streak.kind === "started") parts.push("streak reignited 🔥");
      toast(parts.join("  ·  "), "reward");

      if (data.leveled_up) {
        setLevelUp({
          level: data.new_level,
          title: titleForLevel(data.new_level),
        });
      }
      await refreshCharacter();
    } catch (err) {
      // Roll back: quest returns to the active list.
      setQuests((prev) =>
        (prev ?? []).map((q) =>
          q.id === quest.id ? { ...q, completed: false, completed_at: null } : q
        )
      );
      toast(err instanceof Error ? err.message : "Completion failed", "error");
    } finally {
      setCompletingId(null);
    }
  }

  // ── Optimistic delete ─────────────────────────────────────────────────
  async function handleDelete(quest: Quest) {
    const snapshot = quests;
    setQuests((prev) => (prev ?? []).filter((q) => q.id !== quest.id));
    try {
      const res = await fetch(`/api/quests/${quest.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to abandon quest");
      toast(`Quest abandoned: “${quest.title}”`, "info");
    } catch {
      setQuests(snapshot);
      toast("Could not abandon the quest. Try again.", "error");
    }
  }

  // ── Optimistic edit ───────────────────────────────────────────────────
  async function handleEdit(id: string, input: QuestInput) {
    const snapshot = quests;
    setQuests((prev) =>
      (prev ?? []).map((q) =>
        q.id === id
          ? {
              ...q,
              ...input,
              xp_reward: DIFFICULTY_XP[input.difficulty],
              gold_reward: DIFFICULTY_GOLD[input.difficulty],
            }
          : q
      )
    );
    setEditing(null);
    try {
      const res = await fetch(`/api/quests/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to update quest");
      setQuests((prev) =>
        (prev ?? []).map((q) => (q.id === id ? data.quest : q))
      );
      toast("Quest updated.", "success");
    } catch (err) {
      setQuests(snapshot);
      toast(err instanceof Error ? err.message : "Failed to update quest", "error");
    }
  }

  const filtered = useMemo(() => {
    const list = quests ?? [];
    if (filter === "active") return list.filter((q) => !q.completed);
    if (filter === "completed") return list.filter((q) => q.completed);
    return list;
  }, [quests, filter]);

  const activeCount = (quests ?? []).filter((q) => !q.completed).length;

  return (
    <div className="space-y-6">
      {/* Header row */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold text-parchment">
            Quest Board
          </h1>
          <p className="text-sm text-parchment-dim">
            {quests === null
              ? "Consulting the scroll…"
              : activeCount === 0
                ? "All quests cleared. The realm thanks you."
                : `${activeCount} quest${activeCount === 1 ? "" : "s"} await your courage.`}
          </p>
        </div>
        <Button onClick={() => setAddOpen(true)}>+ New Quest</Button>
      </div>

      {/* Filters */}
      <div
        role="tablist"
        aria-label="Filter quests"
        className="flex w-fit gap-1 rounded-xl border border-night-700/60 bg-night-900/60 p-1"
      >
        {(["active", "completed", "all"] as Filter[]).map((f) => (
          <button
            key={f}
            role="tab"
            aria-selected={filter === f}
            onClick={() => setFilter(f)}
            className={`relative rounded-lg px-3 py-1.5 text-xs font-bold uppercase tracking-wider transition ${
              filter === f
                ? "text-night-950"
                : "text-parchment-dim hover:text-parchment"
            }`}
          >
            {filter === f && (
              <motion.span
                layoutId="quest-filter-pill"
                className="absolute inset-0 rounded-lg bg-accent"
                transition={{ type: "spring", stiffness: 400, damping: 30 }}
              />
            )}
            <span className="relative">{f}</span>
          </button>
        ))}
      </div>

      {/* List */}
      {quests === null && !loadError && <QuestSkeleton />}

      {loadError && (
        <div className="panel p-6 text-center">
          <p role="alert" className="text-red-300">
            ⚠️ {loadError}
          </p>
          <Button variant="ghost" className="mt-4" onClick={loadQuests}>
            Try again
          </Button>
        </div>
      )}

      {quests !== null && filtered.length === 0 && !loadError && (
        <EmptyState filter={filter} onAdd={() => setAddOpen(true)} />
      )}

      <ul className="space-y-3" aria-label="Quest list">
        <AnimatePresence initial={false}>
          {filtered.map((q) => (
            <motion.li
              key={q.id}
              layout
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, x: -24 }}
              transition={{ type: "spring", stiffness: 300, damping: 28 }}
            >
              <QuestRow
                quest={q}
                completing={completingId === q.id}
                onComplete={() => handleComplete(q)}
                onEdit={() => setEditing(q)}
                onDelete={() => handleDelete(q)}
              />
            </motion.li>
          ))}
        </AnimatePresence>
      </ul>

      {/* Add modal */}
      <QuestFormModal
        open={addOpen}
        title="Forge a New Quest"
        onClose={() => setAddOpen(false)}
        onSubmit={handleCreate}
      />

      {/* Edit modal */}
      <QuestFormModal
        open={editing !== null}
        title="Edit Quest"
        initial={editing ?? undefined}
        onClose={() => setEditing(null)}
        onSubmit={(input) => editing && handleEdit(editing.id, input)}
      />

      {/* Level-up celebration */}
      <LevelUpOverlay
        open={levelUp !== null}
        level={levelUp?.level ?? 0}
        title={levelUp?.title}
        onClose={() => setLevelUp(null)}
      />
    </div>
  );
}

// ─── Single quest row ───────────────────────────────────────────────────────

function QuestRow({
  quest,
  completing,
  onComplete,
  onEdit,
  onDelete,
}: {
  quest: Quest;
  completing: boolean;
  onComplete: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const cat = CATEGORY_META[quest.category];
  const diff = DIFFICULTY_META[quest.difficulty];
  const [burst, setBurst] = useState(false);

  function handleComplete() {
    if (quest.completed || completing) return;
    setBurst(true);
    window.setTimeout(() => setBurst(false), 900);
    onComplete();
  }

  return (
    <div
      className="panel panel-hover relative overflow-hidden flex items-center gap-3 p-4 sm:gap-4"
      style={
        quest.completed
          ? { opacity: 0.55 }
          : { borderLeft: `3px solid ${diff.color}`, boxShadow: `0 4px 24px rgba(0,0,0,0.45), inset 0 0 24px ${diff.glow.replace("0.4", "0.06").replace("0.45", "0.06").replace("0.35", "0.05")}` }
      }
    >
      {/* rarity shimmer for legendary/epic actives */}
      {!quest.completed && (quest.difficulty === "legendary" || quest.difficulty === "epic") && (
        <motion.div
          aria-hidden
          className="pointer-events-none absolute inset-0"
          style={{
            background: `linear-gradient(100deg, transparent 20%, ${diff.glow} 50%, transparent 80%)`,
            backgroundSize: "200% 100%",
          }}
          animate={{ backgroundPosition: ["200% 0", "-200% 0"] }}
          transition={{ repeat: Infinity, duration: 2.6, ease: "linear" }}
        />
      )}

      {/* completion burst */}
      {burst && (
        <div aria-hidden className="pointer-events-none absolute inset-0 z-10">
          {Array.from({ length: 10 }).map((_, i) => (
            <motion.span
              key={i}
              className="absolute left-6 top-1/2 h-1.5 w-1.5 rounded-full"
              style={{ background: i % 2 ? "#f59e0b" : "#22d3ee" }}
              initial={{ x: 0, y: 0, opacity: 1, scale: 1 }}
              animate={{
                x: Math.cos((i / 10) * Math.PI * 2) * 46,
                y: Math.sin((i / 10) * Math.PI * 2) * 46,
                opacity: 0,
                scale: 0.3,
              }}
              transition={{ duration: 0.7, ease: "easeOut" }}
            />
          ))}
        </div>
      )}

      {/* Complete toggle with spring check */}
      <motion.button
        type="button"
        onClick={handleComplete}
        disabled={quest.completed || completing}
        whileHover={!quest.completed ? { scale: 1.12 } : undefined}
        whileTap={!quest.completed ? { scale: 0.9 } : undefined}
        aria-label={
          quest.completed
            ? `“${quest.title}” is completed`
            : `Complete quest: ${quest.title}`
        }
        className={`z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border-2 ${
          quest.completed
            ? "border-accent bg-accent text-night-950"
            : "border-night-600 hover:border-accent"
        }`}
      >
        {quest.completed && (
          <motion.span
            initial={{ scale: 0, rotate: -90 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ type: "spring", stiffness: 400, damping: 15 }}
          >
            ✓
          </motion.span>
        )}
      </motion.button>

      {/* Body */}
      <div className="z-10 min-w-0 flex-1">
        <p
          className={`truncate font-semibold ${
            quest.completed ? "text-parchment-dim line-through" : "text-parchment"
          }`}
        >
          {quest.title}
        </p>
        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-parchment-dim">
          <span
            className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-semibold"
            style={{ backgroundColor: `${cat.color}22`, color: cat.color }}
          >
            <span aria-hidden>{cat.icon}</span>
            {cat.label}
          </span>
          <span
            style={{ color: diff.color }}
            aria-label={`Difficulty: ${diff.label}`}
            title={diff.label}
          >
            {diff.stars}
          </span>
          <span className="font-mono">+{quest.xp_reward} XP · +{quest.gold_reward} 🪙</span>
        </div>
      </div>

      {/* Actions */}
      {!quest.completed && (
        <div className="z-10 flex shrink-0 items-center gap-1.5">
          <button
            type="button"
            onClick={onEdit}
            aria-label={`Edit quest: ${quest.title}`}
            className="rounded-lg p-2 text-parchment-dim transition hover:bg-night-700 hover:text-parchment"
          >
            ✎
          </button>
          <button
            type="button"
            onClick={onDelete}
            aria-label={`Delete quest: ${quest.title}`}
            className="rounded-lg p-2 text-parchment-dim transition hover:bg-hp/10 hover:text-red-300"
          >
            🗑
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Empty state ────────────────────────────────────────────────────────────

function EmptyState({ filter, onAdd }: { filter: Filter; onAdd: () => void }) {
  const copy =
    filter === "completed"
      ? {
          icon: "🗺️",
          title: "No completed quests yet",
          body: "Your legend is waiting to be written. Clear your first quest!",
        }
      : filter === "all"
        ? {
            icon: "📜",
            title: "The board is empty",
            body: "Every epic campaign begins with a single quest.",
          }
        : {
            icon: "🏆",
            title: "All quests cleared!",
            body: "The realm rests easy. Forge a new quest to keep the streak alive.",
          };

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="panel flex flex-col items-center px-6 py-12 text-center"
    >
      <span aria-hidden className="text-5xl">
        {copy.icon}
      </span>
      <h2 className="mt-4 font-display text-lg font-bold text-parchment">
        {copy.title}
      </h2>
      <p className="mt-1 max-w-sm text-sm text-parchment-dim">{copy.body}</p>
      {filter !== "completed" && (
        <Button className="mt-6" onClick={onAdd}>
          + Forge your first quest
        </Button>
      )}
    </motion.div>
  );
}

// ─── Create/edit form modal ─────────────────────────────────────────────────

function QuestFormModal({
  open,
  title,
  initial,
  onClose,
  onSubmit,
}: {
  open: boolean;
  title: string;
  initial?: Quest;
  onClose: () => void;
  onSubmit: (input: QuestInput) => void;
}) {
  const [form, setForm] = useState<QuestInput>({
    title: "",
    description: "",
    category: "intellect",
    difficulty: "common",
    due_date: null,
  });
  const [error, setError] = useState<string | null>(null);

  // Reset the form each time the modal opens.
  useEffect(() => {
    if (open) {
      setForm(
        initial
          ? {
              title: initial.title,
              description: initial.description ?? "",
              category: initial.category,
              difficulty: initial.difficulty,
              due_date: initial.due_date,
            }
          : {
              title: "",
              description: "",
              category: "intellect",
              difficulty: "common",
              due_date: null,
            }
      );
      setError(null);
    }
  }, [open, initial]);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = form.title.trim();
    if (!trimmed) {
      setError("A quest needs a name before it can be forged.");
      return;
    }
    onSubmit({
      ...form,
      title: trimmed,
      description: form.description?.trim() || null,
    });
  }

  return (
    <Modal open={open} title={title} onClose={onClose}>
      <form onSubmit={submit} className="space-y-4" noValidate>
        <div>
          <label
            htmlFor="quest-title"
            className="mb-1 block text-xs font-semibold uppercase tracking-wider text-parchment-dim"
          >
            Quest name
          </label>
          <input
            id="quest-title"
            type="text"
            maxLength={120}
            value={form.title}
            onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
            placeholder="e.g. Deep work block: algorithms"
            aria-describedby={error ? "quest-error" : undefined}
            aria-invalid={Boolean(error)}
            className="w-full rounded-lg border border-night-600 bg-night-900/70 px-3 py-2.5 text-parchment placeholder:text-parchment-dim/50 focus:border-accent"
          />
        </div>

        <div>
          <label
            htmlFor="quest-desc"
            className="mb-1 block text-xs font-semibold uppercase tracking-wider text-parchment-dim"
          >
            Notes <span className="normal-case">(optional)</span>
          </label>
          <textarea
            id="quest-desc"
            rows={2}
            maxLength={500}
            value={form.description ?? ""}
            onChange={(e) =>
              setForm((f) => ({ ...f, description: e.target.value }))
            }
            placeholder="Any details, checkboxes, or vows…"
            className="w-full resize-none rounded-lg border border-night-600 bg-night-900/70 px-3 py-2.5 text-parchment placeholder:text-parchment-dim/50 focus:border-accent"
          />
        </div>

        <fieldset>
          <legend className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-parchment-dim">
            Attribute trained
          </legend>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {CATEGORIES.map((c) => {
              const meta = CATEGORY_META[c];
              const selected = form.category === c;
              return (
                <button
                  key={c}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  onClick={() => setForm((f) => ({ ...f, category: c }))}
                  className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-semibold transition ${
                    selected
                      ? "border-accent accent-soft-bg text-accent"
                      : "border-night-600 text-parchment-dim hover:text-parchment"
                  }`}
                >
                  <span aria-hidden>{meta.icon}</span>
                  {meta.label}
                </button>
              );
            })}
          </div>
        </fieldset>

        <fieldset>
          <legend className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-parchment-dim">
            Difficulty
          </legend>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {DIFFICULTIES.map((d) => {
              const selected = form.difficulty === d;
              return (
                <button
                  key={d}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  onClick={() => setForm((f) => ({ ...f, difficulty: d }))}
                  className={`rounded-lg border px-3 py-2 text-center transition ${
                    selected
                      ? "border-accent accent-soft-bg text-accent"
                      : "border-night-600 text-parchment-dim hover:text-parchment"
                  }`}
                >
                  <span className="block text-xs font-bold uppercase tracking-wide">
                    {DIFFICULTY_META[d].label}
                  </span>
                  <span className="text-accent" aria-hidden>
                    {DIFFICULTY_META[d].stars}
                  </span>
                  <span className="mt-0.5 block text-[10px] text-parchment-dim">
                    {DIFFICULTY_XP[d]} XP · {DIFFICULTY_GOLD[d]} 🪙
                  </span>
                </button>
              );
            })}
          </div>
        </fieldset>

        {error && (
          <p id="quest-error" role="alert" className="text-sm text-red-300">
            ⚠️ {error}
          </p>
        )}

        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit">
            {initial ? "Save changes" : "Accept quest"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
