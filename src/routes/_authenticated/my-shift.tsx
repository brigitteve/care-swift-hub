import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useAppStore } from "@/stores/useAppStore";
import { AppHeader } from "@/components/AppHeader";
import { useShiftKpis } from "@/hooks/useShiftKpis";
import { KpiHeader } from "@/components/KpiHeader";
import { Trophy, Sparkles } from "lucide-react";
import { formatSince } from "@/lib/time";

export const Route = createFileRoute("/_authenticated/my-shift")({
  component: MyShiftPage,
  head: () => ({ meta: [{ title: "Mi turno — PatientSOS" }] }),
});

interface Achievement {
  id: string;
  type: string;
  label: string;
  points: number;
  created_at: string;
}

function MyShiftPage() {
  const { user } = useAuth();
  const shiftId = useAppStore((s) => s.currentShiftId);
  const kpis = useShiftKpis(shiftId);
  const [items, setItems] = useState<Achievement[]>([]);

  useEffect(() => {
    if (!user) return;
    const load = async () => {
      const { data } = await supabase
        .from("achievements")
        .select("id,type,label,points,created_at")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(30);
      setItems((data as Achievement[]) ?? []);
    };
    load();
    const ch = supabase
      .channel("ach")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "achievements", filter: `user_id=eq.${user.id}` },
        () => load(),
      )
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [user]);

  const totalPoints = items.reduce((s, i) => s + i.points, 0);

  return (
    <div className="min-h-screen bg-background pb-12">
      <AppHeader title="Mi turno" back="/board" />
      <main className="mx-auto max-w-md p-3 space-y-3">
        <KpiHeader kpis={kpis} />

        <div className="rounded-2xl border bg-card p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Trophy className="h-5 w-5 text-[var(--priority-moderate)]" />
              <span className="font-semibold">Puntos del turno</span>
            </div>
            <span className="text-2xl font-bold tabular-nums">{totalPoints}</span>
          </div>
          <div className="mt-2 text-xs text-muted-foreground">
            +20 por tarea crítica · +50 por checklist 100%
          </div>
        </div>

        <section>
          <h3 className="mb-2 px-1 text-sm font-semibold text-muted-foreground">
            Logros recientes
          </h3>
          {items.length === 0 ? (
            <div className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">
              Aún no hay logros. Completa tareas críticas para sumar puntos.
            </div>
          ) : (
            <ul className="space-y-2">
              {items.map((a) => (
                <li
                  key={a.id}
                  className="flex items-center gap-3 rounded-xl border bg-card p-3"
                >
                  <div className="grid h-10 w-10 place-items-center rounded-xl bg-[var(--priority-moderate)]/15">
                    <Sparkles className="h-5 w-5 text-[var(--priority-moderate)]" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium leading-tight">{a.label}</div>
                    <div className="text-xs text-muted-foreground">
                      Hace {formatSince(a.created_at)}
                    </div>
                  </div>
                  <span className="rounded-lg bg-secondary px-2 py-1 text-sm font-bold tabular-nums">
                    +{a.points}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </main>
    </div>
  );
}