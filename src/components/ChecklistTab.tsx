import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Check, Plus, Loader, AlertCircle, Clock } from "lucide-react";
import { haptic, HAPTIC } from "@/lib/haptics";
import { Confetti } from "@/lib/confetti";

type ChecklistStatus = "pending" | "in_progress" | "done" | "needs_attention";

interface Item {
  id: string;
  title: string;
  done: boolean;
  critical: boolean;
  status: ChecklistStatus;
}

type FilterKey = "all" | "pending" | "in_progress" | "done" | "needs_attention";

const STATUS_ICON: Record<ChecklistStatus, React.ReactNode> = {
  pending: null,
  in_progress: <Loader className="h-4 w-4 animate-spin text-[var(--priority-moderate)]" />,
  done: <Check className="h-6 w-6" />,
  needs_attention: <AlertCircle className="h-4 w-4 text-[var(--priority-urgent)]" />,
};

const FILTER_LABELS: { key: FilterKey; label: string }[] = [
  { key: "all", label: "Todas" },
  { key: "pending", label: "Pendientes" },
  { key: "in_progress", label: "En curso" },
  { key: "done", label: "Listas" },
  { key: "needs_attention", label: "Atención" },
];

export function ChecklistTab({
  patientId,
  userId,
}: {
  patientId: string;
  userId: string;
}) {
  const [items, setItems] = useState<Item[]>([]);
  const [title, setTitle] = useState("");
  const [confettiKey, setConfettiKey] = useState(0);
  const [filter, setFilter] = useState<FilterKey>("all");

  const load = async () => {
    const { data } = await supabase
      .from("checklist_items")
      .select("id,title,done,critical,status")
      .eq("patient_id", patientId)
      .order("done", { ascending: true })
      .order("created_at", { ascending: true });
    setItems((data as Item[]) ?? []);
  };

  useEffect(() => {
    load();
    const ch = supabase
      .channel(`cl-${patientId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "checklist_items", filter: `patient_id=eq.${patientId}` },
        () => load(),
      )
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [patientId]);

  const setStatus = async (it: Item, newStatus: ChecklistStatus) => {
    const becomingDone = newStatus === "done";
    if (becomingDone) haptic(it.critical ? HAPTIC.success : HAPTIC.tap);

    await supabase
      .from("checklist_items")
      .update({
        done: becomingDone,
        status: newStatus,
        completed_at: becomingDone ? new Date().toISOString() : null,
      })
      .eq("id", it.id);

    if (becomingDone && it.critical) {
      setConfettiKey((k) => k + 1);
      await supabase.from("achievements").insert({
        user_id: userId,
        patient_id: patientId,
        type: "critical_task_done",
        label: `Tarea crítica completada: ${it.title}`,
        points: 20,
      });
    }

    // Detect 100% completion
    const after = items.map((i) =>
      i.id === it.id ? { ...i, done: becomingDone, status: newStatus } : i,
    );
    if (after.length > 0 && after.every((i) => i.done)) {
      haptic(HAPTIC.success);
      setConfettiKey((k) => k + 1);
      await supabase.from("achievements").insert({
        user_id: userId,
        patient_id: patientId,
        type: "checklist_100",
        label: "Checklist 100% completado",
        points: 50,
      });
    }
  };

  const toggle = (it: Item) => {
    if (it.done) {
      setStatus(it, "pending");
    } else {
      setStatus(it, "done");
    }
  };

  const markInProgress = (it: Item) => {
    if (it.status === "in_progress") {
      setStatus(it, "pending");
    } else {
      setStatus(it, "in_progress");
    }
  };

  const add = async () => {
    if (!title.trim()) return;
    await supabase.from("checklist_items").insert({
      patient_id: patientId,
      user_id: userId,
      title: title.trim(),
      status: "pending",
    });
    setTitle("");
  };

  // Count per status for filter badges
  const counts: Record<FilterKey, number> = {
    all: items.length,
    pending: items.filter((i) => i.status === "pending").length,
    in_progress: items.filter((i) => i.status === "in_progress").length,
    done: items.filter((i) => i.done).length,
    needs_attention: items.filter((i) => i.status === "needs_attention").length,
  };

  const visible =
    filter === "all" ? items : items.filter((i) => i.status === filter);

  return (
    <div className="space-y-3">
      <Confetti trigger={confettiKey} />

      {/* Filter bar */}
      <div className="flex gap-1.5 overflow-x-auto pb-1 -mx-1 px-1">
        {FILTER_LABELS.map(({ key, label }) => {
          const active = filter === key;
          const count = counts[key];
          if (count === 0 && key !== "all" && key !== filter) return null;
          return (
            <button
              key={key}
              onClick={() => setFilter(key)}
              className={`flex shrink-0 items-center gap-1 rounded-full px-3 py-1.5 text-xs font-semibold transition-all ${
                active
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground hover:bg-accent"
              }`}
            >
              {label}
              {count > 0 && (
                <span
                  className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold ${
                    active ? "bg-white/25" : "bg-background"
                  }`}
                >
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Task list */}
      <ul className="space-y-2">
        {visible.map((it) => (
          <li key={it.id}>
            <div
              className={`flex w-full items-center gap-3 rounded-2xl border bg-card p-4 transition-all ${
                it.done ? "opacity-60" : ""
              } ${
                it.status === "needs_attention"
                  ? "border-[var(--priority-urgent)] bg-[var(--priority-urgent)]/5"
                  : ""
              }`}
            >
              {/* Checkbox */}
              <button
                onClick={() => toggle(it)}
                className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl border-2 transition-all active:scale-95 ${
                  it.done
                    ? "bg-[var(--priority-stable)] border-[var(--priority-stable)] text-[var(--priority-stable-fg)]"
                    : "border-border bg-background"
                }`}
                aria-label={it.done ? "Deshacer tarea" : "Completar tarea"}
              >
                {STATUS_ICON[it.status] ?? (it.done ? <Check className="h-6 w-6" /> : null)}
              </button>

              {/* Title */}
              <span
                className={`flex-1 text-base font-medium ${it.done ? "line-through" : ""}`}
              >
                {it.title}
              </span>

              {/* Badges */}
              <div className="flex shrink-0 items-center gap-1">
                {it.critical && !it.done && (
                  <span className="rounded-full bg-[var(--priority-critical)] px-2 py-0.5 text-[10px] font-bold uppercase text-[var(--priority-critical-fg)]">
                    crítica
                  </span>
                )}
                {!it.done && (
                  <button
                    onClick={() => markInProgress(it)}
                    className={`rounded-lg px-2 py-1 text-[11px] font-semibold transition-all active:scale-95 ${
                      it.status === "in_progress"
                        ? "bg-[var(--priority-moderate)]/20 text-[var(--priority-moderate)]"
                        : "bg-muted text-muted-foreground hover:bg-accent"
                    }`}
                    aria-label="Marcar en progreso"
                  >
                    <Clock className="h-3 w-3" />
                  </button>
                )}
              </div>
            </div>
          </li>
        ))}
        {visible.length === 0 && (
          <li className="rounded-xl border border-dashed p-4 text-center text-sm text-muted-foreground">
            {filter === "all"
              ? "Sin tareas. Agrega la primera."
              : `Sin tareas con estado "${FILTER_LABELS.find((f) => f.key === filter)?.label}".`}
          </li>
        )}
      </ul>

      {/* Add new task */}
      <div className="flex gap-2">
        <Input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Nueva tarea..."
          className="h-12 text-base"
          onKeyDown={(e) => e.key === "Enter" && add()}
        />
        <Button onClick={add} className="h-12 w-12 shrink-0" size="icon" aria-label="Agregar tarea">
          <Plus className="h-5 w-5" />
        </Button>
      </div>
    </div>
  );
}