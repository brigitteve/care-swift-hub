import type { ShiftKpis } from "@/hooks/useShiftKpis";
import { Activity, AlertOctagon, CheckCircle2 } from "lucide-react";

export function KpiHeader({ kpis }: { kpis: ShiftKpis }) {
  return (
    <div className="rounded-2xl border bg-card p-3 space-y-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-sm font-semibold">
          <CheckCircle2 className="h-4 w-4 text-[var(--priority-stable)]" />
          Progreso del turno
        </div>
        <span className="tabular-nums text-sm font-bold">
          {kpis.checklistPct}%
        </span>
      </div>
      <div className="h-2.5 w-full overflow-hidden rounded-full bg-muted">
        <div
          className="h-full rounded-full bg-gradient-to-r from-[var(--priority-stable)] to-[var(--primary)] transition-all duration-500"
          style={{ width: `${kpis.checklistPct}%` }}
        />
      </div>
      <div className="grid grid-cols-3 gap-2 pt-1">
        <KpiCell
          icon={<Activity className="h-4 w-4" />}
          label="Pacientes"
          value={kpis.patients}
        />
        <KpiCell
          icon={<AlertOctagon className="h-4 w-4" />}
          label="Críticos"
          value={kpis.critical}
          color="var(--priority-critical)"
        />
        <KpiCell
          icon={<AlertOctagon className="h-4 w-4" />}
          label="Alertas"
          value={kpis.alertsOpen}
          color={kpis.alertsCritical > 0 ? "var(--priority-critical)" : undefined}
        />
      </div>
    </div>
  );
}

function KpiCell({
  icon,
  label,
  value,
  color,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  color?: string;
}) {
  return (
    <div className="rounded-xl bg-muted/40 p-2 text-center">
      <div
        className="flex items-center justify-center gap-1 text-[10px] uppercase tracking-wide text-muted-foreground"
      >
        {icon}
        {label}
      </div>
      <div
        className="mt-0.5 text-xl font-bold tabular-nums"
        style={color ? { color } : undefined}
      >
        {value}
      </div>
    </div>
  );
}