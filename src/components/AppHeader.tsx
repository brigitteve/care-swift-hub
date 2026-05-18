import { Link, useRouter } from "@tanstack/react-router";
import { Bell, Moon, Sun, LogOut, ArrowLeft, BellRing } from "lucide-react";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAppStore } from "@/stores/useAppStore";
import { Button } from "@/components/ui/button";
import { AlertsSheet } from "./AlertsSheet";
import { usePushNotifications } from "@/hooks/usePushNotifications";
import { haptic, HAPTIC } from "@/lib/haptics";

export function AppHeader({
  title,
  back,
}: {
  title: string;
  back?: string;
}) {
  const router = useRouter();
  const { theme, toggleTheme, setShift } = useAppStore();
  const [alertCount, setAlertCount] = useState(0);
  const [open, setOpen] = useState(false);
  const { permission, request, notify, supported } = usePushNotifications();

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      const { count } = await supabase
        .from("alerts")
        .select("*", { count: "exact", head: true })
        .eq("resolved", false);
      if (!cancelled) setAlertCount(count ?? 0);
    };
    load();
    const ch = supabase
      .channel("alerts-count")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "alerts" },
        async (payload) => {
          load();
          const row = (payload.new ?? {}) as {
            severity?: string;
            message?: string;
            resolved?: boolean;
            priority_score?: number;
          };
          if (
            payload.eventType === "INSERT" &&
            !row.resolved &&
            (row.severity === "critical" || (row.priority_score ?? 0) >= 80)
          ) {
            haptic(HAPTIC.critical);
            notify("PatientSOS — Crítico", row.message ?? "Alerta crítica");
          }
        },
      )
      .subscribe();
    return () => {
      cancelled = true;
      supabase.removeChannel(ch);
    };
  }, [notify]);

  const logout = async () => {
    setShift(null);
    await supabase.auth.signOut();
    router.navigate({ to: "/login" });
  };

  return (
    <header className="safe-top sticky top-0 z-40 border-b bg-background/90 backdrop-blur supports-[backdrop-filter]:bg-background/70">
      <div className="flex h-14 items-center gap-2 px-3">
        {back ? (
          <Button
            variant="ghost"
            size="icon"
            className="h-11 w-11 -ml-2"
            onClick={() => router.navigate({ to: back })}
            aria-label="Volver"
          >
            <ArrowLeft className="h-6 w-6" />
          </Button>
        ) : (
          <Link to="/board" className="flex items-center gap-2">
            <div className="grid h-9 w-9 place-items-center rounded-xl bg-primary text-primary-foreground font-bold">
              S
            </div>
          </Link>
        )}
        <h1 className="flex-1 truncate text-base font-semibold">{title}</h1>
        <Button
          variant="ghost"
          size="icon"
          className="relative h-11 w-11"
          onClick={() => setOpen(true)}
          aria-label="Alertas"
        >
          <Bell className="h-6 w-6" />
          {alertCount > 0 && (
            <span className="absolute right-1 top-1 grid h-5 min-w-5 place-items-center rounded-full bg-[var(--priority-critical)] px-1 text-[11px] font-bold text-[var(--priority-critical-fg)]">
              {alertCount > 99 ? "99+" : alertCount}
            </span>
          )}
        </Button>
        {supported && permission === "default" && (
          <Button
            variant="ghost"
            size="icon"
            className="h-11 w-11"
            onClick={request}
            aria-label="Activar notificaciones"
          >
            <BellRing className="h-5 w-5 text-[var(--priority-urgent)]" />
          </Button>
        )}
        <Button
          variant="ghost"
          size="icon"
          className="h-11 w-11"
          onClick={toggleTheme}
          aria-label="Cambiar tema"
        >
          {theme === "dark" ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-11 w-11"
          onClick={logout}
          aria-label="Cerrar sesión"
        >
          <LogOut className="h-5 w-5" />
        </Button>
      </div>
      <AlertsSheet open={open} onOpenChange={setOpen} />
    </header>
  );
}