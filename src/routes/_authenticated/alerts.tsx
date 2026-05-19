import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AppHeader } from "@/components/AppHeader";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AlertTriangle, Check, Eye, BellOff, Settings2 } from "lucide-react";
import { formatSince } from "@/lib/time";
import { haptic, HAPTIC } from "@/lib/haptics";
import { Link } from "@tanstack/react-router";
import { toast } from "sonner";

interface Alert {
  id: string;
  patient_id: string;
  type: string;
  message: string;
  severity: string;
  created_at: string;
  seen: boolean;
  resolved: boolean;
  priority_score: number;
  patients: { name: string; bed: string } | null;
}

export const Route = createFileRoute("/_authenticated/alerts")({
  component: AlertsCenterPage,
  head: () => ({ meta: [{ title: "Centro de Alertas — PatientSOS" }] }),
});

function AlertsCenterPage() {
  const [active, setActive] = useState<Alert[]>([]);
  const [resolved, setResolved] = useState<Alert[]>([]);

  const loadActive = async () => {
    const { data } = await supabase
      .from("alerts")
      .select("id, patient_id, type, message, severity, created_at, seen, resolved, priority_score, patients(name, bed)")
      .eq("resolved", false)
      .order("priority_score", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(50);
    setActive((data as unknown as Alert[]) ?? []);
  };

  const loadResolved = async () => {
    const { data } = await supabase
      .from("alerts")
      .select("id, patient_id, type, message, severity, created_at, seen, resolved, priority_score, patients(name, bed)")
      .eq("resolved", true)
      .order("created_at", { ascending: false })
      .limit(30);
    setResolved((data as unknown as Alert[]) ?? []);
  };

  useEffect(() => {
    loadActive();
    loadResolved();
    const ch = supabase
      .channel("alerts-center")
      .on("postgres_changes", { event: "*", schema: "public", table: "alerts" }, () => {
        loadActive();
        loadResolved();
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, []);

  const dismiss = async (id: string) => {
    haptic(HAPTIC.tap);
    const { error } = await supabase.from("alerts").update({ resolved: true }).eq("id", id);
    if (error) return toast.error(error.message);
  };

  const markSeen = async (id: string) => {
    haptic(HAPTIC.tap);
    await supabase.from("alerts").update({ seen: true }).eq("id", id);
  };

  const dismissAll = async () => {
    haptic(HAPTIC.success);
    await supabase.from("alerts").update({ resolved: true }).eq("resolved", false);
    toast.success("Todas las alertas resueltas");
  };

  return (
    <div className="min-h-screen bg-background pb-12">
      <AppHeader title="Centro de Alertas" back="/board" />
      <main className="mx-auto max-w-md p-3 space-y-3">
        <Tabs defaultValue="active" className="w-full">
          <TabsList className="grid w-full grid-cols-2 h-11">
            <TabsTrigger value="active" className="font-semibold gap-1.5">
              <AlertTriangle className="h-4 w-4" />
              Activas {active.length > 0 && `(${active.length})`}
            </TabsTrigger>
            <TabsTrigger value="resolved" className="font-semibold gap-1.5">
              <Check className="h-4 w-4" />
              Resueltas
            </TabsTrigger>
          </TabsList>

          {/* ── ACTIVE ── */}
          <TabsContent value="active" className="pt-3 space-y-2">
            {active.length === 0 ? (
              <div className="flex flex-col items-center gap-3 py-16 text-center text-muted-foreground">
                <BellOff className="h-12 w-12 opacity-40" />
                <p className="font-medium">Sin alertas activas</p>
                <p className="text-sm">Todo bajo control 🎉</p>
              </div>
            ) : (
              <>
                {active.map((a) => (
                  <AlertCard
                    key={a.id}
                    alert={a}
                    onDismiss={() => dismiss(a.id)}
                    onMarkSeen={() => markSeen(a.id)}
                  />
                ))}
                <Button
                  variant="outline"
                  className="h-12 w-full"
                  onClick={dismissAll}
                >
                  <Check className="mr-2 h-4 w-4" />
                  Resolver todas ({active.length})
                </Button>
              </>
            )}
          </TabsContent>

          {/* ── RESOLVED ── */}
          <TabsContent value="resolved" className="pt-3 space-y-2">
            {resolved.length === 0 ? (
              <div className="py-12 text-center text-sm text-muted-foreground">
                No hay alertas resueltas aún.
              </div>
            ) : (
              resolved.map((a) => (
                <AlertCard key={a.id} alert={a} readonly />
              ))
            )}
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}

function AlertCard({
  alert: a,
  onDismiss,
  onMarkSeen,
  readonly = false,
}: {
  alert: Alert;
  onDismiss?: () => void;
  onMarkSeen?: () => void;
  readonly?: boolean;
}) {
  return (
    <div
      className={`rounded-xl border-l-4 border bg-card p-3 transition-all ${
        a.severity === "critical"
          ? "border-l-[var(--priority-critical)]"
          : a.severity === "urgent"
            ? "border-l-[var(--priority-urgent)]"
            : "border-l-[var(--priority-moderate)]"
      } ${a.seen || readonly ? "opacity-70" : ""} ${
        a.resolved ? "bg-muted/30" : ""
      }`}
    >
      <div className="flex items-start gap-2">
        <Link
          to="/patients/$patientId"
          params={{ patientId: a.patient_id }}
          className="flex-1 min-w-0"
        >
          <div className="flex items-center gap-2">
            <span
              className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-bold ${
                a.severity === "critical"
                  ? "bg-[var(--priority-critical)] text-[var(--priority-critical-fg)]"
                  : "bg-[var(--priority-urgent)] text-[var(--priority-urgent-fg)]"
              }`}
            >
              {a.severity === "critical" ? "🔴" : "🟠"} {a.severity}
            </span>
            <span className="font-semibold text-sm truncate">
              {a.patients?.name ?? "Paciente"} · Cama {a.patients?.bed ?? "—"}
            </span>
          </div>
          <p className="mt-0.5 text-sm text-muted-foreground">{a.message}</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Hace {formatSince(a.created_at)}
            {typeof a.priority_score === "number" && (
              <span className="ml-2 rounded bg-muted px-1.5 py-0.5 text-[10px] font-bold tabular-nums">
                score {a.priority_score}
              </span>
            )}
          </p>
        </Link>
        {!readonly && (
          <div className="flex shrink-0 flex-col gap-1">
            {!a.seen && (
              <Button
                size="icon"
                variant="ghost"
                onClick={onMarkSeen}
                className="h-9 w-9"
                aria-label="Marcar vista"
              >
                <Eye className="h-4 w-4" />
              </Button>
            )}
            <Button
              size="icon"
              variant="ghost"
              onClick={onDismiss}
              className="h-9 w-9 text-[var(--priority-stable)]"
              aria-label="Resolver"
            >
              <Check className="h-5 w-5" />
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
