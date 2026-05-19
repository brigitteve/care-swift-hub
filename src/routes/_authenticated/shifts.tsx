import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useAppStore } from "@/stores/useAppStore";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { OnboardingOverlay } from "@/components/OnboardingOverlay";
import { WhatsAppInviteButton } from "@/components/WhatsAppInviteButton";
import { Activity, Clock, Plus, LogOut, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { seedDemoPatients } from "@/lib/seed";

interface Shift {
  id: string;
  name: string;
  started_at: string;
  ended_at: string | null;
  join_token: string | null;
}

export const Route = createFileRoute("/_authenticated/shifts")({
  validateSearch: (search: Record<string, unknown>) => ({
    token: typeof search.token === "string" ? search.token : "",
  }),
  component: ShiftsPage,
  head: () => ({ meta: [{ title: "Turnos — PatientSOS" }] }),
});

function ShiftsPage() {
  const { user } = useAuth();
  const router = useRouter();
  const { token } = Route.useSearch();
  const setShift = useAppStore((s) => s.setShift);
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [profileName, setProfileName] = useState("");
  const [newName, setNewName] = useState("");
  const [seeding, setSeeding] = useState<string | null>(null);

  const load = async () => {
    const { data } = await supabase
      .from("shifts")
      .select("id, name, started_at, ended_at, join_token")
      .order("started_at", { ascending: false });
    setShifts((data as Shift[]) ?? []);
  };

  useEffect(() => {
    if (!user) return;
    load();
    supabase.from("profiles").select("full_name").eq("id", user.id).maybeSingle()
      .then(({ data }) => setProfileName(data?.full_name ?? ""));
  }, [user]);

  // Auto-join via token from URL
  useEffect(() => {
    if (!token || !user) return;
    const join = async () => {
      const { data } = await supabase
        .from("shifts")
        .select("id, name")
        .eq("join_token", token)
        .maybeSingle();
      if (!data) return toast.error("Enlace de turno no válido");
      setShift(data.id);
      toast.success(`Te uniste al turno "${data.name}"`);
      router.navigate({ to: "/board" });
    };
    join();
  }, [token, user, setShift, router]);

  if (!user) return null;

  const defaultName = () => {
    const h = new Date().getHours();
    if (h >= 6 && h < 14) return "Turno Mañana";
    if (h >= 14 && h < 22) return "Turno Tarde";
    return "Turno Noche";
  };

  const createShift = async (withDemo: boolean) => {
    const name = (newName || defaultName()).trim();
    const { data, error } = await supabase
      .from("shifts")
      .insert({ user_id: user.id, name })
      .select()
      .single();
    if (error || !data) return toast.error(error?.message ?? "Error");
    if (withDemo) {
      setSeeding(data.id);
      await seedDemoPatients(data.id, user.id);
      setSeeding(null);
    }
    setShift(data.id);
    router.navigate({ to: "/board" });
  };

  const pickShift = (id: string) => {
    setShift(id);
    router.navigate({ to: "/board" });
  };

  const logout = async () => {
    setShift(null);
    await supabase.auth.signOut();
    router.navigate({ to: "/login" });
  };

  return (
    <>
      <OnboardingOverlay />
      <main className="safe-top safe-bottom min-h-screen bg-background">
        <div className="mx-auto max-w-md p-4 space-y-5">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="grid h-11 w-11 place-items-center rounded-xl bg-primary text-primary-foreground">
                <Activity className="h-5 w-5" />
              </div>
              <div>
                <div className="text-sm text-muted-foreground">Hola,</div>
                <div className="font-semibold leading-tight">{profileName || "Enfermera"}</div>
              </div>
            </div>
            <Button variant="ghost" size="icon" className="h-11 w-11" onClick={logout} aria-label="Salir">
              <LogOut className="h-5 w-5" />
            </Button>
          </div>

          {/* Create shift */}
          <section className="rounded-2xl border bg-card p-4 space-y-3">
            <h2 className="text-base font-semibold">Iniciar nuevo turno</h2>
            <div className="space-y-1.5">
              <Label htmlFor="sh-name">Nombre del turno</Label>
              <Input
                id="sh-name"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder={defaultName()}
                className="h-12 text-base"
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Button onClick={() => createShift(false)} className="h-12 text-base">
                <Plus className="h-5 w-5" /> Crear
              </Button>
              <Button
                onClick={() => createShift(true)}
                variant="secondary"
                className="h-12 text-base"
                disabled={seeding !== null}
              >
                <Sparkles className="h-5 w-5" />
                {seeding ? "Cargando..." : "Con demo"}
              </Button>
            </div>
          </section>

          {/* Recent shifts */}
          <section>
            <h2 className="mb-2 px-1 text-sm font-semibold text-muted-foreground">
              Turnos recientes
            </h2>
            {shifts.length === 0 ? (
              <div className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">
                Aún no hay turnos. Crea el primero arriba.
              </div>
            ) : (
              <ul className="space-y-2">
                {shifts.map((s) => (
                  <li key={s.id}>
                    <div className="flex items-center gap-2 rounded-2xl border bg-card">
                      <button
                        onClick={() => pickShift(s.id)}
                        className="flex flex-1 items-center gap-3 p-4 text-left active:scale-[0.99] transition-transform"
                      >
                        <Clock className="h-5 w-5 text-muted-foreground shrink-0" />
                        <div className="flex-1 min-w-0">
                          <div className="font-semibold truncate">{s.name}</div>
                          <div className="text-xs text-muted-foreground">
                            {new Date(s.started_at).toLocaleString()}
                          </div>
                        </div>
                      </button>
                      {/* WhatsApp invite */}
                      {!s.ended_at && s.join_token && (
                        <div className="pr-3">
                          <WhatsAppInviteButton
                            shiftName={s.name}
                            joinToken={s.join_token}
                          />
                        </div>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </main>
    </>
  );
}