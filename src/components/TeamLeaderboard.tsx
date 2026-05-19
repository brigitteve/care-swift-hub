import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Trophy, Sparkles, Star } from "lucide-react";

interface LeaderEntry {
  id: string;
  full_name: string;
  points: number;
  tasksDone: number;
}

export function TeamLeaderboard({ shiftId }: { shiftId: string | null }) {
  const [entries, setEntries] = useState<LeaderEntry[]>([]);

  useEffect(() => {
    if (!shiftId) return;
    let cancelled = false;
    const load = async () => {
      // Get all achievements for the shift
      const { data: ach } = await supabase
        .from("achievements")
        .select("user_id, points, type")
        .eq("shift_id", shiftId);

      // Get all profiles
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, full_name");

      if (cancelled || !ach || !profiles) return;

      // Aggregate points and tasks per user
      const map: Record<string, { points: number; tasksDone: number }> = {};
      for (const a of ach) {
        if (!map[a.user_id]) map[a.user_id] = { points: 0, tasksDone: 0 };
        map[a.user_id].points += a.points;
        if (a.type === "critical_task_done" || a.type === "checklist_100") {
          map[a.user_id].tasksDone += 1;
        }
      }

      const result: LeaderEntry[] = profiles
        .map((p) => ({
          id: p.id,
          full_name: p.full_name || "Enfermera",
          points: map[p.id]?.points ?? 0,
          tasksDone: map[p.id]?.tasksDone ?? 0,
        }))
        .filter((e) => e.points > 0)
        .sort((a, b) => b.points - a.points)
        .slice(0, 5);

      setEntries(result);
    };

    load();
    const ch = supabase
      .channel(`leaderboard-${shiftId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "achievements" }, load)
      .subscribe();
    return () => {
      cancelled = true;
      supabase.removeChannel(ch);
    };
  }, [shiftId]);

  const MEDALS = ["🥇", "🥈", "🥉", "4️⃣", "5️⃣"];

  if (entries.length === 0) {
    return (
      <div className="rounded-xl border border-dashed p-4 text-center text-sm text-muted-foreground">
        Sin logros registrados aún en este turno.
      </div>
    );
  }

  return (
    <ul className="space-y-2">
      {entries.map((e, i) => (
        <li
          key={e.id}
          className={`flex items-center gap-3 rounded-xl border bg-card p-3 ${
            i === 0 ? "border-[var(--priority-moderate)] bg-[var(--priority-moderate)]/5" : ""
          }`}
        >
          <span className="text-xl w-7 shrink-0 text-center">{MEDALS[i]}</span>
          <div className="flex-1 min-w-0">
            <div className="font-semibold truncate">{e.full_name}</div>
            <div className="text-xs text-muted-foreground flex items-center gap-1">
              <Star className="h-3 w-3" />
              {e.tasksDone} tarea{e.tasksDone !== 1 ? "s" : ""} completada{e.tasksDone !== 1 ? "s" : ""}
            </div>
          </div>
          <div className="shrink-0 text-right">
            <div className="flex items-center gap-1 font-bold tabular-nums text-[var(--priority-moderate)]">
              <Sparkles className="h-3.5 w-3.5" />
              {e.points}
            </div>
            <div className="text-[10px] uppercase tracking-wide text-muted-foreground">pts</div>
          </div>
        </li>
      ))}
    </ul>
  );
}

// Podio visual para el primer lugar (si hay 3+)
export function TeamPodium({ shiftId }: { shiftId: string | null }) {
  const [top, setTop] = useState<LeaderEntry[]>([]);

  useEffect(() => {
    if (!shiftId) return;
    // Reuse same logic
    const load = async () => {
      const { data: ach } = await supabase
        .from("achievements")
        .select("user_id, points")
        .eq("shift_id", shiftId);
      const { data: profiles } = await supabase.from("profiles").select("id, full_name");
      if (!ach || !profiles) return;
      const map: Record<string, number> = {};
      for (const a of ach) map[a.user_id] = (map[a.user_id] ?? 0) + a.points;
      const result = profiles
        .map((p) => ({ ...p, full_name: p.full_name || "Enfermera", points: map[p.id] ?? 0, tasksDone: 0 }))
        .filter((e) => e.points > 0)
        .sort((a, b) => b.points - a.points)
        .slice(0, 3);
      setTop(result);
    };
    load();
  }, [shiftId]);

  if (top.length < 2) return null;
  const order = top.length >= 3 ? [top[1], top[0], top[2]] : [top[0], top[1]];
  const heights = top.length >= 3 ? ["h-16", "h-24", "h-12"] : ["h-20", "h-14"];

  return (
    <div className="flex items-end justify-center gap-2 px-4 pb-2">
      {order.map((e, i) => {
        const isFirst = i === (top.length >= 3 ? 1 : 0);
        return (
          <div key={e.id} className="flex flex-col items-center gap-1">
            <div className={`text-${isFirst ? "lg" : "sm"} font-bold`}>
              {isFirst ? "🏆" : i === 0 ? "🥈" : "🥉"}
            </div>
            <div className="text-xs font-semibold truncate max-w-[72px] text-center">
              {e.full_name.split(" ")[0]}
            </div>
            <div
              className={`w-16 ${heights[i]} rounded-t-xl flex items-center justify-center ${
                isFirst
                  ? "bg-[var(--priority-moderate)] text-[var(--priority-moderate-fg)]"
                  : "bg-muted text-muted-foreground"
              }`}
            >
              <Trophy className="h-5 w-5" />
            </div>
          </div>
        );
      })}
    </div>
  );
}
