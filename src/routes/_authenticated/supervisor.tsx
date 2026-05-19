import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useRole } from "@/hooks/useRole";
import { useAppStore } from "@/stores/useAppStore";
import { useShiftKpis } from "@/hooks/useShiftKpis";
import { AppHeader } from "@/components/AppHeader";
import { KpiHeader } from "@/components/KpiHeader";
import { TeamLeaderboard, TeamPodium } from "@/components/TeamLeaderboard";
import { AlertThresholdsForm } from "@/components/AlertThresholdsForm";
import { PRIORITY_META, type Priority } from "@/lib/priority";
import { Users, ShieldAlert, Trophy, BarChart3, Sliders } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/supervisor")({
  component: SupervisorPage,
  head: () => ({ meta: [{ title: "Supervisión — PatientSOS" }] }),
});

interface PatientRow {
  id: string;
  name: string;
  bed: string;
  priority: Priority;
  assigned_to: string | null;
}
interface NurseRow {
  id: string;
  full_name: string;
  count?: number;
}

function SupervisorPage() {
  const { user } = useAuth();
  const { isSupervisor, loading } = useRole();
  const router = useRouter();
  const shiftId = useAppStore((s) => s.currentShiftId);
  const kpis = useShiftKpis(shiftId);
  const [patients, setPatients] = useState<PatientRow[]>([]);
  const [nurses, setNurses] = useState<NurseRow[]>([]);

  useEffect(() => {
    if (!loading && !isSupervisor) {
      toast.error("Acceso restringido a supervisoras");
      router.navigate({ to: "/board" });
    }
  }, [isSupervisor, loading, router]);

  const load = async () => {
    if (!shiftId) return;
    const { data: p } = await supabase
      .from("patients")
      .select("id,name,bed,priority,assigned_to")
      .eq("shift_id", shiftId);
    setPatients((p as PatientRow[]) ?? []);

    const { data: prof } = await supabase.from("profiles").select("id, full_name");
    const counts: Record<string, number> = {};
    (p ?? []).forEach((row) => {
      if (row.assigned_to) counts[row.assigned_to] = (counts[row.assigned_to] ?? 0) + 1;
    });
    setNurses(
      ((prof ?? []) as NurseRow[]).map((n) => ({ ...n, count: counts[n.id] ?? 0 })),
    );
  };

  useEffect(() => {
    load();
    const ch = supabase
      .channel("sup-board")
      .on("postgres_changes", { event: "*", schema: "public", table: "patients" }, load)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shiftId]);

  const assign = async (patientId: string, nurseId: string) => {
    const { error } = await supabase
      .from("patients")
      .update({ assigned_to: nurseId })
      .eq("id", patientId);
    if (error) return toast.error(error.message);
    toast.success("Paciente reasignado");
  };

  if (loading || !isSupervisor || !user) return null;

  return (
    <div className="min-h-screen bg-background pb-12">
      <AppHeader title="Supervisión" back="/board" />
      <main className="mx-auto max-w-md p-3 space-y-3">

        {/* Global KPIs */}
        <KpiHeader kpis={kpis} />

        {/* Priority summary pills */}
        <div className="grid grid-cols-4 gap-2">
          {(["critical", "urgent", "moderate", "stable"] as Priority[]).map((p) => {
            const meta = PRIORITY_META[p];
            const cnt = patients.filter((x) => x.priority === p).length;
            return (
              <div key={p} className="rounded-xl border bg-card p-2 text-center">
                <div className="text-xl font-bold tabular-nums" style={{ color: `var(--priority-${p})` }}>
                  {cnt}
                </div>
                <div className="text-[11px] uppercase tracking-wide text-muted-foreground">
                  {meta.short}
                </div>
              </div>
            );
          })}
        </div>

        <Tabs defaultValue="team" className="w-full">
          <TabsList className="grid w-full grid-cols-3 h-11">
            <TabsTrigger value="team" className="text-xs font-semibold gap-1">
              <Trophy className="h-3.5 w-3.5" />Equipo
            </TabsTrigger>
            <TabsTrigger value="assign" className="text-xs font-semibold gap-1">
              <ShieldAlert className="h-3.5 w-3.5" />Asignar
            </TabsTrigger>
            <TabsTrigger value="config" className="text-xs font-semibold gap-1">
              <Sliders className="h-3.5 w-3.5" />Config
            </TabsTrigger>
          </TabsList>

          {/* ── EQUIPO ── */}
          <TabsContent value="team" className="pt-3 space-y-3">
            <TeamPodium shiftId={shiftId} />

            <section className="rounded-2xl border bg-card p-3">
              <div className="mb-2 flex items-center gap-2 text-sm font-semibold">
                <Users className="h-4 w-4" /> Carga por enfermera
              </div>
              <ul className="space-y-2">
                {nurses.map((n) => (
                  <li
                    key={n.id}
                    className="flex items-center justify-between rounded-xl bg-muted/40 p-2.5"
                  >
                    <span className="font-medium">{n.full_name || "Enfermera"}</span>
                    <span
                      className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${
                        (n.count ?? 0) >= 4
                          ? "bg-[var(--priority-critical)] text-[var(--priority-critical-fg)]"
                          : (n.count ?? 0) >= 2
                            ? "bg-[var(--priority-moderate)] text-[var(--priority-moderate-fg)]"
                            : "bg-[var(--priority-stable)] text-[var(--priority-stable-fg)]"
                      }`}
                    >
                      {n.count} pac.
                    </span>
                  </li>
                ))}
                {nurses.length === 0 && (
                  <li className="text-sm text-muted-foreground">Sin enfermeras registradas.</li>
                )}
              </ul>
            </section>

            <section className="rounded-2xl border bg-card p-3">
              <div className="mb-2 flex items-center gap-2 text-sm font-semibold">
                <Trophy className="h-4 w-4 text-[var(--priority-moderate)]" /> Ranking del turno
              </div>
              <TeamLeaderboard shiftId={shiftId} />
            </section>
          </TabsContent>

          {/* ── ASIGNAR ── */}
          <TabsContent value="assign" className="pt-3 space-y-2">
            {patients.length === 0 && (
              <p className="text-sm text-muted-foreground px-1">Sin pacientes en este turno.</p>
            )}
            {patients.map((p) => {
              const meta = PRIORITY_META[p.priority];
              return (
                <div
                  key={p.id}
                  className={`rounded-2xl border bg-card p-3 border-l-8 ${meta.row}`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="font-semibold truncate">{p.name}</div>
                      <div className="text-xs text-muted-foreground">Cama {p.bed}</div>
                    </div>
                    <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${meta.chip}`}>
                      {meta.emoji} {meta.label}
                    </span>
                  </div>
                  <Select
                    value={p.assigned_to ?? ""}
                    onValueChange={(v) => assign(p.id, v)}
                  >
                    <SelectTrigger className="mt-2 h-11">
                      <SelectValue placeholder="Asignar enfermera" />
                    </SelectTrigger>
                    <SelectContent>
                      {nurses.map((n) => (
                        <SelectItem key={n.id} value={n.id}>
                          {n.full_name || "Enfermera"} · {n.count} pac.
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              );
            })}
          </TabsContent>

          {/* ── CONFIG ── */}
          <TabsContent value="config" className="pt-3 space-y-3">
            <AlertThresholdsForm userId={user.id} />
            <div className="rounded-2xl border bg-card p-3 text-sm text-muted-foreground">
              <div className="flex items-center gap-2 mb-1 font-semibold text-foreground">
                <BarChart3 className="h-4 w-4" /> Reportes
              </div>
              Los reportes históricos del turno están disponibles en{" "}
              <a href="/analytics" className="text-primary underline">
                Analítica
              </a>.
            </div>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}