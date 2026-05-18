import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Check, Plus } from "lucide-react";
import { haptic, HAPTIC } from "@/lib/haptics";
import { Confetti } from "@/lib/confetti";

interface Item {
  id: string;
  title: string;
  done: boolean;
  critical: boolean;
}

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

  const load = async () => {
    const { data } = await supabase
      .from("checklist_items")
      .select("id,title,done,critical")
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
  }, [patientId]);

  const toggle = async (it: Item) => {
    const becomingDone = !it.done;
    if (becomingDone) {
      haptic(it.critical ? HAPTIC.success : HAPTIC.tap);
    }
    await supabase
      .from("checklist_items")
      .update({
        done: !it.done,
        completed_at: !it.done ? new Date().toISOString() : null,
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
    // Detect 100% completion of patient checklist
    const after = items.map((i) =>
      i.id === it.id ? { ...i, done: becomingDone } : i,
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

  const add = async () => {
    if (!title.trim()) return;
    await supabase.from("checklist_items").insert({
      patient_id: patientId,
      user_id: userId,
      title: title.trim(),
    });
    setTitle("");
  };

  return (
    <div className="space-y-3">
      <Confetti trigger={confettiKey} />
      <ul className="space-y-2">
        {items.map((it) => (
          <li key={it.id}>
            <button
              onClick={() => toggle(it)}
              className={`flex w-full items-center gap-3 rounded-2xl border bg-card p-4 text-left active:scale-[0.99] transition-transform ${
                it.done ? "opacity-60" : ""
              }`}
            >
              <span
                className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl border-2 ${
                  it.done
                    ? "bg-[var(--priority-stable)] border-[var(--priority-stable)] text-[var(--priority-stable-fg)]"
                    : "border-border bg-background"
                }`}
              >
                {it.done && <Check className="h-6 w-6" />}
              </span>
              <span
                className={`flex-1 text-base font-medium ${
                  it.done ? "line-through" : ""
                }`}
              >
                {it.title}
              </span>
              {it.critical && !it.done && (
                <span className="rounded-full bg-[var(--priority-critical)] px-2 py-0.5 text-[10px] font-bold uppercase text-[var(--priority-critical-fg)]">
                  crítica
                </span>
              )}
            </button>
          </li>
        ))}
        {items.length === 0 && (
          <li className="rounded-xl border border-dashed p-4 text-center text-sm text-muted-foreground">
            Sin tareas. Agrega la primera.
          </li>
        )}
      </ul>

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