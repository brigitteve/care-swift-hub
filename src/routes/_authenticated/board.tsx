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
import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { PRIORITY_ORDER } from "@/lib/priority";
import { minutesSince } from "@/lib/time";
import { Users, ShieldCheck, Trophy } from "lucide-react";

export const Route = createFileRoute("/_authenticated/board")({
  component: BoardPage,
  head: () => ({ meta: [{ title: "Tablero — PatientSOS" }] }),
});

function BoardPage() {
  const { user } = useAuth();
  const router = useRouter();
  const currentShiftId = useAppStore((s) => s.currentShiftId);
  const [patients, setPatients] = useState<PatientRow[]>([]);
  const [shiftName, setShiftName] = useState("");
  const kpis = useShiftKpis(currentShiftId);
  const { isSupervisor } = useRole();
  const [filter, setFilter] = useState<"mine" | "all">("all");

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

    // Periodic check for overdue patients to auto-create alerts
    const interval = setInterval(async () => {
      if (!user) return;
      const { data } = await supabase
        .from("patients")
        .select("id, name, last_attended_at")
        .eq("shift_id", currentShiftId);
      for (const p of data ?? []) {
        if (minutesSince(p.last_attended_at) >= 15) {
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
              message: `${p.name} sin atención hace más de 15 min`,
            });
          }
        }
      }
    }, 60000);

    return () => {
      supabase.removeChannel(ch);
      clearInterval(interval);
    };
  }, [currentShiftId, router, user]);

  const visible = patients;
  const sorted = [...visible].sort((a, b) => {
    const d = PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority];
    if (d !== 0) return d;
    return new Date(a.last_attended_at).getTime() - new Date(b.last_attended_at).getTime();
  });

  const counts = {
    critical: patients.filter((p) => p.priority === "critical").length,
    urgent: patients.filter((p) => p.priority === "urgent").length,
    moderate: patients.filter((p) => p.priority === "moderate").length,
    stable: patients.filter((p) => p.priority === "stable").length,
  };

  return (
    <div className="min-h-screen bg-background pb-28">
      <AppHeader title={shiftName} />
      <main className="mx-auto max-w-md p-3 space-y-3">
        <KpiHeader kpis={kpis} />
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
        <div className="grid grid-cols-4 gap-2">
          {([
            ["critical", "Crít.", "var(--priority-critical)"],
            ["urgent", "Urg.", "var(--priority-urgent)"],
            ["moderate", "Mod.", "var(--priority-moderate)"],
            ["stable", "Est.", "var(--priority-stable)"],
          ] as const).map(([k, l, c]) => (
            <div key={k} className="rounded-xl border bg-card p-2 text-center">
              <div className="text-xl font-bold tabular-nums" style={{ color: c }}>
                {counts[k]}
              </div>
              <div className="text-[11px] uppercase tracking-wide text-muted-foreground">
                {l}
              </div>
            </div>
          ))}
        </div>

        {sorted.length === 0 ? (
          <div className="mt-8 rounded-2xl border border-dashed p-8 text-center">
            <Users className="mx-auto mb-3 h-10 w-10 text-muted-foreground" />
            <p className="font-medium">Sin pacientes en este turno</p>
            <p className="text-sm text-muted-foreground">
              Toca el botón <span className="font-semibold text-primary">+</span> para agregar el primero.
            </p>
          </div>
        ) : (
          <ul className="space-y-2.5">
            {sorted.map((p) => (
              <li key={p.id}>
                <PatientCard patient={p} />
              </li>
            ))}
          </ul>
        )}
      </main>
      {currentShiftId && user && (
        <AddPatientDialog shiftId={currentShiftId} userId={user.id} />
      )}
    </div>
  );
}