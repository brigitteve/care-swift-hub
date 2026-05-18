import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { BellOff, AlertTriangle, Eye, Check } from "lucide-react";
import { formatSince } from "@/lib/time";
import { haptic, HAPTIC } from "@/lib/haptics";

interface Alert {
  id: string;
  patient_id: string;
  type: string;
  message: string;
  severity: string;
  created_at: string;
  seen?: boolean;
  priority_score?: number;
  patients: { name: string; bed: string } | null;
}

export function AlertsSheet({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const [alerts, setAlerts] = useState<Alert[]>([]);

  const load = async () => {
    const { data } = await supabase
      .from("alerts")
      .select("id, patient_id, type, message, severity, created_at, seen, priority_score, patients(name, bed)")
      .eq("resolved", false)
      .order("priority_score", { ascending: false })
      .order("created_at", { ascending: false });
    setAlerts((data as unknown as Alert[]) ?? []);
  };

  useEffect(() => {
    if (!open) return;
    load();
    const ch = supabase
      .channel("alerts-sheet")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "alerts" },
        () => load(),
      )
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [open]);

  const dismiss = async (id: string) => {
    haptic(HAPTIC.tap);
    await supabase.from("alerts").update({ resolved: true }).eq("id", id);
  };

  const markSeen = async (id: string) => {
    haptic(HAPTIC.tap);
    await supabase.from("alerts").update({ seen: true }).eq("id", id);
  };

  const dismissAll = async () => {
    await supabase.from("alerts").update({ resolved: true }).eq("resolved", false);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full max-w-md p-0 flex flex-col">
        <SheetHeader className="border-b px-4 py-3">
          <SheetTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-[var(--priority-urgent)]" />
            Alertas activas ({alerts.length})
          </SheetTitle>
        </SheetHeader>
        <div className="flex-1 overflow-y-auto p-3 space-y-2">
          {alerts.length === 0 ? (
            <div className="grid h-full place-items-center text-center text-muted-foreground gap-2">
              <BellOff className="h-10 w-10 opacity-50" />
              <p>Sin alertas activas</p>
            </div>
          ) : (
            alerts.map((a) => (
              <div
                key={a.id}
                className={`rounded-xl border-l-4 bg-card border p-3 ${
                  a.severity === "critical"
                    ? "border-l-[var(--priority-critical)]"
                    : "border-l-[var(--priority-urgent)]"
                } ${a.seen ? "opacity-70" : ""}`}
              >
                <div className="flex items-start justify-between gap-2">
                  <Link
                    to="/patients/$patientId"
                    params={{ patientId: a.patient_id }}
                    onClick={() => onOpenChange(false)}
                    className="flex-1 min-w-0"
                  >
                    <div className="flex items-center gap-2">
                      <div className="font-semibold text-sm truncate">
                        {a.patients?.name ?? "Paciente"} · {a.patients?.bed ?? ""}
                      </div>
                      {typeof a.priority_score === "number" && (
                        <span className="ml-auto shrink-0 rounded-md bg-muted px-1.5 py-0.5 text-[10px] font-bold tabular-nums">
                          {a.priority_score}
                        </span>
                      )}
                    </div>
                    <div className="text-sm text-muted-foreground">{a.message}</div>
                    <div className="mt-1 text-xs text-muted-foreground">
                      Hace {formatSince(a.created_at)}
                    </div>
                  </Link>
                  <div className="flex shrink-0 flex-col gap-1">
                    {!a.seen && (
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => markSeen(a.id)}
                        className="h-9 w-9"
                        aria-label="Marcar vista"
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                    )}
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => dismiss(a.id)}
                      className="h-9 w-9 text-[var(--priority-stable)]"
                      aria-label="Resolver"
                    >
                      <Check className="h-5 w-5" />
                    </Button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
        {alerts.length > 0 && (
          <div className="border-t p-3 safe-bottom">
            <Button
              variant="outline"
              onClick={dismissAll}
              className="h-12 w-full"
            >
              Resolver todas
            </Button>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}