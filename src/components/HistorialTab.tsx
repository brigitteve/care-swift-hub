import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PRIORITY_META, type Priority } from "@/lib/priority";
import { formatSince } from "@/lib/time";
import { Activity, CheckCircle2, TriangleAlert, ClipboardList } from "lucide-react";

interface VitalEvent {
  id: string;
  created_at: string;
  hr: number | null;
  spo2: number | null;
  temp: number | null;
  bp_systolic: number | null;
  bp_diastolic: number | null;
}

interface ChecklistEvent {
  id: string;
  title: string;
  completed_at: string | null;
  critical: boolean;
}

interface TimelineItem {
  id: string;
  type: "vital" | "checklist" | "priority";
  timestamp: string;
  data: VitalEvent | ChecklistEvent | { priority: Priority };
}

export function HistorialTab({ patientId }: { patientId: string }) {
  const [vitals, setVitals] = useState<VitalEvent[]>([]);
  const [checklist, setChecklist] = useState<ChecklistEvent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      const [vRes, clRes] = await Promise.all([
        supabase
          .from("vital_signs")
          .select("id, created_at, hr, spo2, temp, bp_systolic, bp_diastolic")
          .eq("patient_id", patientId)
          .order("created_at", { ascending: false })
          .limit(30),
        supabase
          .from("checklist_items")
          .select("id, title, completed_at, critical")
          .eq("patient_id", patientId)
          .eq("done", true)
          .not("completed_at", "is", null)
          .order("completed_at", { ascending: false })
          .limit(20),
      ]);
      if (cancelled) return;
      setVitals((vRes.data as VitalEvent[]) ?? []);
      setChecklist((clRes.data as ChecklistEvent[]) ?? []);
      setLoading(false);
    };
    load();
    return () => { cancelled = true; };
  }, [patientId]);

  if (loading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-16 animate-pulse rounded-xl bg-muted" />
        ))}
      </div>
    );
  }

  // Build unified timeline
  const timeline: TimelineItem[] = [
    ...vitals.map((v) => ({
      id: v.id,
      type: "vital" as const,
      timestamp: v.created_at,
      data: v,
    })),
    ...checklist
      .filter((c) => c.completed_at)
      .map((c) => ({
        id: c.id,
        type: "checklist" as const,
        timestamp: c.completed_at!,
        data: c,
      })),
  ].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

  if (timeline.length === 0) {
    return (
      <div className="rounded-xl border border-dashed p-8 text-center">
        <ClipboardList className="mx-auto mb-2 h-8 w-8 text-muted-foreground" />
        <p className="text-sm text-muted-foreground">Sin historial registrado aún.</p>
      </div>
    );
  }

  return (
    <div className="relative space-y-0">
      {/* Vertical timeline line */}
      <div className="absolute left-5 top-0 bottom-0 w-0.5 bg-border" />
      <div className="space-y-3 pl-12">
        {timeline.map((item) => (
          <div key={item.id} className="relative">
            {/* Dot */}
            <div
              className={`absolute -left-[2.35rem] grid h-7 w-7 place-items-center rounded-full border-2 border-background ${
                item.type === "vital"
                  ? "bg-primary"
                  : "bg-[var(--priority-stable)]"
              }`}
            >
              {item.type === "vital" ? (
                <Activity className="h-3.5 w-3.5 text-primary-foreground" />
              ) : (
                <CheckCircle2 className="h-3.5 w-3.5 text-[var(--priority-stable-fg)]" />
              )}
            </div>

            <div className="rounded-xl border bg-card p-3 text-sm">
              <div className="mb-1 text-xs text-muted-foreground">
                Hace {formatSince(item.timestamp)}
              </div>

              {item.type === "vital" && (() => {
                const v = item.data as VitalEvent;
                return (
                  <div>
                    <div className="mb-1 flex items-center gap-1 font-semibold">
                      <Activity className="h-3.5 w-3.5 text-primary" />
                      Signos vitales registrados
                    </div>
                    <div className="flex flex-wrap gap-x-3 gap-y-0.5 tabular-nums text-foreground">
                      {v.hr != null && <span>FC <b>{v.hr} lpm</b></span>}
                      {v.spo2 != null && <span>SpO₂ <b>{v.spo2}%</b></span>}
                      {v.temp != null && <span>T <b>{v.temp}°C</b></span>}
                      {v.bp_systolic != null && (
                        <span>PA <b>{v.bp_systolic}/{v.bp_diastolic ?? "—"}</b></span>
                      )}
                    </div>
                  </div>
                );
              })()}

              {item.type === "checklist" && (() => {
                const c = item.data as ChecklistEvent;
                return (
                  <div>
                    <div className="mb-0.5 flex items-center gap-1 font-semibold">
                      {c.critical && (
                        <TriangleAlert className="h-3.5 w-3.5 text-[var(--priority-critical)]" />
                      )}
                      Tarea completada
                      {c.critical && (
                        <span className="ml-1 rounded-full bg-[var(--priority-critical)] px-1.5 py-0.5 text-[9px] font-bold uppercase text-[var(--priority-critical-fg)]">
                          crítica
                        </span>
                      )}
                    </div>
                    <p className="text-muted-foreground">{c.title}</p>
                  </div>
                );
              })()}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
