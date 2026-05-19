import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useAppStore } from "@/stores/useAppStore";
import { useShiftKpis } from "@/hooks/useShiftKpis";
import { AppHeader } from "@/components/AppHeader";
import { KpiHeader } from "@/components/KpiHeader";
import { Sparkline } from "@/components/Sparkline";
import { PRIORITY_META, type Priority } from "@/lib/priority";
import { Link } from "@tanstack/react-router";
import {
  BarChart3,
  Download,
  Clock,
  Activity,
  TrendingUp,
  Calendar,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

interface Shift {
  id: string;
  name: string;
  started_at: string;
  ended_at: string | null;
}
interface PatientSummary {
  id: string;
  name: string;
  bed: string;
  priority: Priority;
}
interface VitalTrend {
  patient_id: string;
  patientName: string;
  hrSeries: number[];
  spo2Series: number[];
}

export const Route = createFileRoute("/_authenticated/analytics")({
  component: AnalyticsPage,
  head: () => ({ meta: [{ title: "Analítica — PatientSOS" }] }),
});

function AnalyticsPage() {
  const { user } = useAuth();
  const shiftId = useAppStore((s) => s.currentShiftId);
  const kpis = useShiftKpis(shiftId);
  const [recentShifts, setRecentShifts] = useState<Shift[]>([]);
  const [patients, setPatients] = useState<PatientSummary[]>([]);
  const [trends, setTrends] = useState<VitalTrend[]>([]);
  const [loadingTrends, setLoadingTrends] = useState(false);

  // Load recent shifts for history section
  useEffect(() => {
    if (!user) return;
    supabase
      .from("shifts")
      .select("id, name, started_at, ended_at")
      .eq("user_id", user.id)
      .order("started_at", { ascending: false })
      .limit(10)
      .then(({ data }) => setRecentShifts((data as Shift[]) ?? []));
  }, [user]);

  // Load current shift patients + vitals
  useEffect(() => {
    if (!shiftId) return;
    setLoadingTrends(true);
    const load = async () => {
      const { data: pData } = await supabase
        .from("patients")
        .select("id, name, bed, priority")
        .eq("shift_id", shiftId);
      const pList = (pData as PatientSummary[]) ?? [];
      setPatients(pList);

      // Fetch last 10 vitals per patient
      const trendData: VitalTrend[] = await Promise.all(
        pList.slice(0, 6).map(async (p) => {
          const { data: v } = await supabase
            .from("vital_signs")
            .select("hr, spo2")
            .eq("patient_id", p.id)
            .order("created_at", { ascending: false })
            .limit(10);
          const rows = (v ?? []).reverse();
          return {
            patient_id: p.id,
            patientName: p.name,
            hrSeries: rows.map((r) => r.hr ?? 0).filter(Boolean),
            spo2Series: rows.map((r) => r.spo2 ?? 0).filter(Boolean),
          };
        }),
      );
      setTrends(trendData.filter((t) => t.hrSeries.length > 0 || t.spo2Series.length > 0));
      setLoadingTrends(false);
    };
    load();
  }, [shiftId]);

  const exportJSON = () => {
    const payload = {
      exportedAt: new Date().toISOString(),
      shiftId,
      kpis,
      patients,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `patientsos-shift-${shiftId?.slice(0, 8)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Reporte exportado como JSON");
  };

  // Priority distribution counts
  const priorityCounts = (["critical", "urgent", "moderate", "stable"] as Priority[]).map((p) => ({
    key: p,
    count: patients.filter((pt) => pt.priority === p).length,
    meta: PRIORITY_META[p],
  }));
  const maxCount = Math.max(...priorityCounts.map((p) => p.count), 1);

  return (
    <div className="min-h-screen bg-background pb-12">
      <AppHeader title="Analítica" back="/board" />
      <main className="mx-auto max-w-md p-3 space-y-4">

        {/* KPIs del turno actual */}
        {shiftId ? (
          <section className="space-y-3">
            <h2 className="flex items-center gap-2 px-1 text-sm font-semibold text-muted-foreground">
              <BarChart3 className="h-4 w-4" /> Turno actual
            </h2>
            <KpiHeader kpis={kpis} />

            {/* Priority bar chart */}
            {patients.length > 0 && (
              <div className="rounded-2xl border bg-card p-4 space-y-3">
                <div className="text-sm font-semibold flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-primary" /> Distribución por prioridad
                </div>
                <div className="space-y-2">
                  {priorityCounts.map(({ key, count, meta }) => (
                    <div key={key} className="flex items-center gap-3">
                      <span className="w-14 shrink-0 text-xs font-semibold" style={{ color: `var(--priority-${key})` }}>
                        {meta.emoji} {meta.label.slice(0, 3)}.
                      </span>
                      <div className="flex-1 h-6 bg-muted rounded-lg overflow-hidden">
                        <div
                          className="h-full rounded-lg transition-all duration-700"
                          style={{
                            width: `${(count / maxCount) * 100}%`,
                            backgroundColor: `var(--priority-${key})`,
                          }}
                        />
                      </div>
                      <span className="w-6 text-right text-sm font-bold tabular-nums">{count}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Vital sparklines */}
            {trends.length > 0 && (
              <div className="rounded-2xl border bg-card p-4 space-y-3">
                <div className="text-sm font-semibold flex items-center gap-2">
                  <Activity className="h-4 w-4 text-primary" /> Evolución de signos vitales
                </div>
                <div className="space-y-3">
                  {loadingTrends ? (
                    <div className="space-y-2">
                      {[1, 2].map((i) => <div key={i} className="h-12 animate-pulse rounded-xl bg-muted" />)}
                    </div>
                  ) : (
                    trends.map((t) => {
                      const pat = patients.find((p) => p.id === t.patient_id);
                      const priorityKey = pat?.priority ?? "stable";
                      return (
                        <Link
                          key={t.patient_id}
                          to="/patients/$patientId"
                          params={{ patientId: t.patient_id }}
                          className="flex items-center gap-3 rounded-xl border bg-muted/30 p-3 active:scale-[0.99] transition-transform"
                        >
                          <div
                            className="h-8 w-2 rounded-full shrink-0"
                            style={{ backgroundColor: `var(--priority-${priorityKey})` }}
                          />
                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-semibold truncate">{t.patientName}</div>
                            <div className="text-xs text-muted-foreground">Cama {pat?.bed}</div>
                          </div>
                          <div className="flex items-center gap-2">
                            {t.hrSeries.length >= 2 && (
                              <div className="flex flex-col items-end gap-0.5">
                                <span className="text-[10px] text-muted-foreground">FC</span>
                                <Sparkline
                                  values={t.hrSeries}
                                  color={`var(--priority-${priorityKey})`}
                                />
                              </div>
                            )}
                            {t.spo2Series.length >= 2 && (
                              <div className="flex flex-col items-end gap-0.5">
                                <span className="text-[10px] text-muted-foreground">SpO₂</span>
                                <Sparkline
                                  values={t.spo2Series}
                                  color="var(--primary)"
                                />
                              </div>
                            )}
                          </div>
                        </Link>
                      );
                    })
                  )}
                </div>
              </div>
            )}

            {/* Export */}
            <Button variant="outline" className="h-12 w-full" onClick={exportJSON}>
              <Download className="mr-2 h-4 w-4" />
              Exportar reporte (JSON)
            </Button>
          </section>
        ) : (
          <div className="rounded-xl border border-dashed p-8 text-center text-muted-foreground">
            <BarChart3 className="mx-auto mb-3 h-10 w-10 opacity-40" />
            <p>Selecciona un turno activo para ver los KPIs.</p>
          </div>
        )}

        {/* Historial de turnos */}
        <section>
          <h2 className="mb-2 flex items-center gap-2 px-1 text-sm font-semibold text-muted-foreground">
            <Calendar className="h-4 w-4" /> Historial de turnos
          </h2>
          {recentShifts.length === 0 ? (
            <div className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">
              Sin turnos previos.
            </div>
          ) : (
            <ul className="space-y-2">
              {recentShifts.map((s) => {
                const start = new Date(s.started_at);
                const end = s.ended_at ? new Date(s.ended_at) : null;
                const durMs = end ? end.getTime() - start.getTime() : null;
                const durH = durMs ? Math.round(durMs / 3600000 * 10) / 10 : null;
                const isActive = !s.ended_at && s.id === shiftId;
                return (
                  <li key={s.id} className="rounded-2xl border bg-card p-4">
                    <div className="flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold truncate">{s.name}</span>
                          {isActive && (
                            <span className="rounded-full bg-[var(--priority-stable)] px-2 py-0.5 text-[10px] font-bold uppercase text-[var(--priority-stable-fg)]">
                              Activo
                            </span>
                          )}
                        </div>
                        <div className="mt-0.5 flex items-center gap-2 text-xs text-muted-foreground">
                          <Clock className="h-3 w-3" />
                          {start.toLocaleDateString("es-MX", {
                            day: "2-digit",
                            month: "short",
                            year: "numeric",
                          })}
                          {" · "}
                          {start.toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" })}
                          {durH && ` · ${durH}h`}
                        </div>
                      </div>
                      <Activity className="h-5 w-5 shrink-0 text-muted-foreground" />
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </main>
    </div>
  );
}
