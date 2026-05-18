import { Link } from "@tanstack/react-router";
import { PRIORITY_META, type Priority } from "@/lib/priority";
import { formatSince, minutesSince } from "@/lib/time";
import { useEffect, useState } from "react";
import { BedDouble, Clock, Activity } from "lucide-react";
import { Sparkline } from "./Sparkline";
import { supabase } from "@/integrations/supabase/client";

export interface PatientRow {
  id: string;
  name: string;
  bed: string;
  reason: string | null;
  priority: Priority;
  last_attended_at: string;
}

export function PatientCard({ patient }: { patient: PatientRow }) {
  const meta = PRIORITY_META[patient.priority];
  // Re-render every 30s for live timer
  const [, tick] = useState(0);
  const [spo2, setSpo2] = useState<number[]>([]);
  useEffect(() => {
    const id = setInterval(() => tick((n) => n + 1), 30000);
    return () => clearInterval(id);
  }, []);
  useEffect(() => {
    let cancelled = false;
    supabase
      .from("vital_signs")
      .select("spo2, hr")
      .eq("patient_id", patient.id)
      .order("created_at", { ascending: false })
      .limit(8)
      .then(({ data }) => {
        if (cancelled || !data) return;
        const series = data
          .map((r) => r.spo2 ?? r.hr)
          .filter((v): v is number => v != null)
          .reverse();
        setSpo2(series);
      });
    return () => {
      cancelled = true;
    };
  }, [patient.id, patient.last_attended_at]);
  const mins = minutesSince(patient.last_attended_at);
  const pulse = patient.priority === "critical" && mins >= 10;
  const overdue = mins >= 15;

  return (
    <Link
      to="/patients/$patientId"
      params={{ patientId: patient.id }}
      className={`block touch-manipulation active:scale-[0.99] transition-transform`}
    >
      <div
        className={`rounded-2xl border-l-8 ${meta.row} bg-card shadow-sm border border-border ${
          pulse ? "animate-pulse-critical" : ""
        }`}
      >
        <div className="p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="text-lg font-semibold leading-tight truncate">
                {patient.name}
              </div>
              <div className="mt-1 flex items-center gap-3 text-sm text-muted-foreground">
                <span className="inline-flex items-center gap-1">
                  <BedDouble className="h-4 w-4" /> {patient.bed}
                </span>
                {patient.reason && (
                  <span className="truncate">· {patient.reason}</span>
                )}
              </div>
            </div>
            <span
              className={`shrink-0 rounded-full px-3 py-1 text-xs font-bold ${meta.chip}`}
            >
              {meta.emoji} {meta.label}
            </span>
          </div>
          <div className="mt-3 flex items-center gap-1.5 text-sm">
            <Clock
              className={`h-4 w-4 ${
                overdue ? "text-[var(--priority-critical)]" : "text-muted-foreground"
              }`}
            />
            <span
              className={
                overdue
                  ? "font-bold text-[var(--priority-critical)]"
                  : "text-muted-foreground"
              }
            >
              Hace {formatSince(patient.last_attended_at)} sin atención
            </span>
            {spo2.length >= 2 && (
              <span className="ml-auto flex items-center gap-1 text-muted-foreground">
                <Activity className="h-3.5 w-3.5" />
                <Sparkline
                  values={spo2}
                  color={`var(--priority-${patient.priority})`}
                />
              </span>
            )}
          </div>
        </div>
      </div>
    </Link>
  );
}