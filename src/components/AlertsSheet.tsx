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
import { BellOff, AlertTriangle } from "lucide-react";
import { formatSince } from "@/lib/time";

interface Alert {
  id: string;
  patient_id: string;
  type: string;
  message: string;
  severity: string;
  created_at: string;
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
      .select("id, patient_id, type, message, severity, created_at, patients(name, bed)")
      .eq("resolved", false)
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
    await supabase.from("alerts").update({ resolved: true }).eq("id", id);
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
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <Link
                    to="/patients/$patientId"
                    params={{ patientId: a.patient_id }}
                    onClick={() => onOpenChange(false)}
                    className="flex-1 min-w-0"
                  >
                    <div className="font-semibold text-sm truncate">
                      {a.patients?.name ?? "Paciente"} · {a.patients?.bed ?? ""}
                    </div>
                    <div className="text-sm text-muted-foreground">{a.message}</div>
                    <div className="mt-1 text-xs text-muted-foreground">
                      Hace {formatSince(a.created_at)}
                    </div>
                  </Link>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => dismiss(a.id)}
                    className="shrink-0"
                  >
                    OK
                  </Button>
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