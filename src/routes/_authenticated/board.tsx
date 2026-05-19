import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useAppStore } from "@/stores/useAppStore";
import { AppHeader } from "@/components/AppHeader";
import { PatientCard, type PatientRow } from "@/components/PatientCard";
import { AddPatientDialog } from "@/components/AddPatientDialog";
import { KpiHeader } from "@/components/KpiHeader";
import { useShiftKpis } from "@/hooks/useShiftKpis";
import { useRole } from "@/hooks/useRole";
import { useAlertThresholds } from "@/hooks/useAlertThresholds";
import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { PRIORITY_META, PRIORITY_ORDER, type Priority } from "@/lib/priority";
import { minutesSince } from "@/lib/time";
import { Users, ShieldCheck, Trophy } from "lucide-react";

export const Route = createFileRoute("/_authenticated/board")({
  component: BoardPage,
  head: () => ({ meta: [{ title: "Tablero — PatientSOS" }] }),
});

const COLUMNS: { key: Priority; short: string }[] = [
  { key: "critical", short: "Crít." },
  { key: "urgent", short: "Urg." },
  { key: "moderate", short: "Mod." },
  { key: "stable", short: "Est." },
];

function BoardPage() {
  const { user } = useAuth();
  const router = useRouter();
  const currentShiftId = useAppStore((s) => s.currentShiftId);
  const [patients, setPatients] = useState<PatientRow[]>([]);
  const [shiftName, setShiftName] = useState("");
  const kpis = useShiftKpis(currentShiftId);
  const { isSupervisor } = useRole();
  const { unattendedMin } = useAlertThresholds();

  useEffect(() => {
    if (!currentShiftId) {
      router.navigate({ to: "/shifts" });
      return;
    }
    supabase.from("shifts").select("name").eq("id", currentShiftId).maybeSingle()
      .then(({ data }) => setShiftName(data?.name ?? "Turno"));

    const load = async () => {
      const { data } = await supabase
        .from("patients")
        .select("id,name,bed,reason,priority,last_attended_at")
        .eq("shift_id", currentShiftId);
      setPatients((data as PatientRow[]) ?? []);
    };
    load();

    const ch = supabase
      .channel(`board-${currentShiftId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "patients", filter: `shift_id=eq.${currentShiftId}` },
        () => load(),
      )
      .subscribe();

    // Periodic check for overdue patients using configurable threshold
    const interval = setInterval(async () => {
      if (!user) return;
      const { data } = await supabase
        .from("patients")
        .select("id, name, last_attended_at")
        .eq("shift_id", currentShiftId);
      for (const p of data ?? []) {
        if (minutesSince(p.last_attended_at) >= unattendedMin) {
          const { count } = await supabase
            .from("alerts")
            .select("*", { count: "exact", head: true })
            .eq("patient_id", p.id)
            .eq("type", "unattended")
            .eq("resolved", false);
          if ((count ?? 0) === 0) {
            await supabase.from("alerts").insert({
              patient_id: p.id,
              user_id: user.id,
              type: "unattended",
              severity: "urgent",
              message: `${p.name} sin atención hace más de ${unattendedMin} min`,
            });
          }
        }
      }
    }, 60000);

    return () => {
      supabase.removeChannel(ch);
      clearInterval(interval);
    };
  }, [currentShiftId, router, user, unattendedMin]);

  const byPriority = COLUMNS.reduce(
    (acc, col) => {
      acc[col.key] = patients
        .filter((p) => p.priority === col.key)
        .sort((a, b) =>
          new Date(a.last_attended_at).getTime() - new Date(b.last_attended_at).getTime()
        );
      return acc;
    },
    {} as Record<Priority, PatientRow[]>,
  );

  return (
    <div className="min-h-screen bg-background pb-28">
      <AppHeader title={shiftName} />
      <main className="mx-auto max-w-md p-3 space-y-3">
        <KpiHeader kpis={kpis} />

        {/* Quick nav buttons */}
        <div className="flex gap-2">
          <Button asChild variant="outline" className="h-11 flex-1">
            <Link to="/my-shift">
              <Trophy className="h-4 w-4" />
              Mi turno
            </Link>
          </Button>
          {isSupervisor && (
            <Button asChild variant="outline" className="h-11 flex-1">
              <Link to="/supervisor">
                <ShieldCheck className="h-4 w-4" />
                Supervisión
              </Link>
            </Button>
          )}
        </div>

        {/* ─── Kanban Columns ─── */}
        {patients.length === 0 ? (
          <div className="mt-8 rounded-2xl border border-dashed p-8 text-center">
            <Users className="mx-auto mb-3 h-10 w-10 text-muted-foreground" />
            <p className="font-medium">Sin pacientes en este turno</p>
            <p className="text-sm text-muted-foreground">
              Toca el botón <span className="font-semibold text-primary">+</span> para agregar el primero.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto -mx-3 px-3">
            <div className="flex gap-3 min-w-max">
              {COLUMNS.map(({ key, short }) => {
                const col = PRIORITY_META[key];
                const list = byPriority[key];
                if (list.length === 0) return null;
                return (
                  <div key={key} className="w-64 flex-shrink-0">
                    {/* Column header */}
                    <div
                      className="mb-2 flex items-center justify-between rounded-xl px-3 py-2"
                      style={{ backgroundColor: `color-mix(in oklch, var(--priority-${key}) 15%, transparent)` }}
                    >
                      <span
                        className="text-xs font-bold uppercase tracking-wider"
                        style={{ color: `var(--priority-${key})` }}
                      >
                        {col.emoji} {short}
                      </span>
                      <span
                        className="rounded-full px-2 py-0.5 text-xs font-bold"
                        style={{
                          backgroundColor: `var(--priority-${key})`,
                          color: `var(--priority-${key}-fg)`,
                        }}
                      >
                        {list.length}
                      </span>
                    </div>
                    {/* Column cards */}
                    <ul className="space-y-2.5">
                      {list.map((p) => (
                        <li key={p.id}>
                          <PatientCard patient={p} />
                        </li>
                      ))}
                    </ul>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </main>

      {currentShiftId && user && (
        <AddPatientDialog shiftId={currentShiftId} userId={user.id} />
      )}
    </div>
  );
}