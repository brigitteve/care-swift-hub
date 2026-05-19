import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { Activity, Stethoscope, ShieldCheck, Settings2 } from "lucide-react";

export const Route = createFileRoute("/login")({
  validateSearch: (search: Record<string, unknown>) => ({
    redirect: typeof search.redirect === "string" ? search.redirect : "",
  }),
  component: LoginPage,
  head: () => ({
    meta: [{ title: "Acceso - PatientSOS" }],
  }),
});

type AppRole = "nurse" | "supervisor" | "admin";

const ROLE_OPTIONS: { value: AppRole; label: string; sublabel: string; icon: React.ReactNode }[] = [
  {
    value: "nurse",
    label: "Enfermera",
    sublabel: "Gestiona pacientes y tareas",
    icon: <Stethoscope className="h-5 w-5" />,
  },
  {
    value: "supervisor",
    label: "Supervisora",
    sublabel: "Supervisa equipo y KPIs",
    icon: <ShieldCheck className="h-5 w-5" />,
  },
  {
    value: "admin",
    label: "Administración",
    sublabel: "Acceso completo",
    icon: <Settings2 className="h-5 w-5" />,
  },
];

function LoginPage() {
  const router = useRouter();
  const { redirect } = Route.useSearch();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [selectedRole, setSelectedRole] = useState<AppRole>("nurse");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data }) => {
      if (!data.session) return;
      // Detect role and redirect accordingly
      const dest = await getRoleDestination(data.session.user.id);
      window.location.href = redirect || dest;
    });
  }, [redirect]);

  const signIn = async () => {
    setLoading(true);
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) return toast.error(error.message);
    if (!data.user) return;
    const dest = await getRoleDestination(data.user.id);
    window.location.href = redirect || dest;
  };

  const signUp = async () => {
    if (!fullName.trim()) return toast.error("Ingresa tu nombre completo");
    if (password.length < 6) return toast.error("La contraseña debe tener al menos 6 caracteres");
    setLoading(true);
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: window.location.origin,
        data: { full_name: fullName, role: selectedRole },
      },
    });
    setLoading(false);
    if (error) return toast.error(error.message);

    if (data.session) {
      toast.success("¡Cuenta creada! Bienvenida a PatientSOS");
      const dest = selectedRole === "supervisor" || selectedRole === "admin" ? "/supervisor" : "/shifts";
      router.navigate({ to: dest });
      return;
    }

    toast.success("Cuenta creada. Revisa tu correo para confirmar el acceso.");
  };

  return (
    <main className="safe-top safe-bottom grid min-h-screen place-items-center bg-background p-4">
      <div className="w-full max-w-sm">
        {/* Brand */}
        <div className="mb-8 text-center">
          <div className="mx-auto mb-3 grid h-16 w-16 place-items-center rounded-2xl bg-primary text-primary-foreground shadow-lg">
            <Activity className="h-8 w-8" />
          </div>
          <h1 className="text-2xl font-bold">PatientSOS</h1>
          <p className="text-sm text-muted-foreground">
            Triage rápido para enfermería de urgencias
          </p>
        </div>

        <Tabs defaultValue="signin" className="w-full">
          <TabsList className="grid h-12 w-full grid-cols-2">
            <TabsTrigger value="signin" className="h-10 text-base">
              Entrar
            </TabsTrigger>
            <TabsTrigger value="signup" className="h-10 text-base">
              Crear cuenta
            </TabsTrigger>
          </TabsList>

          {/* ─── SIGN IN ─── */}
          <TabsContent value="signin" className="space-y-3 pt-4">
            <div className="space-y-1.5">
              <Label htmlFor="si-email">Email</Label>
              <Input
                id="si-email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="h-12 text-base"
                onKeyDown={(e) => e.key === "Enter" && signIn()}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="si-pw">Contraseña</Label>
              <Input
                id="si-pw"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="h-12 text-base"
                onKeyDown={(e) => e.key === "Enter" && signIn()}
              />
            </div>
            <Button onClick={signIn} disabled={loading} className="h-12 w-full text-base font-semibold">
              {loading ? "Entrando..." : "Entrar"}
            </Button>
          </TabsContent>

          {/* ─── SIGN UP ─── */}
          <TabsContent value="signup" className="space-y-3 pt-4">
            <div className="space-y-1.5">
              <Label htmlFor="su-name">Nombre completo</Label>
              <Input
                id="su-name"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Ej. María González"
                className="h-12 text-base"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="su-email">Email</Label>
              <Input
                id="su-email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="h-12 text-base"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="su-pw">Contraseña</Label>
              <Input
                id="su-pw"
                type="password"
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="h-12 text-base"
              />
            </div>

            {/* Role Selector */}
            <div className="space-y-2">
              <Label>Tu rol</Label>
              <div className="grid gap-2">
                {ROLE_OPTIONS.map((r) => {
                  const active = selectedRole === r.value;
                  return (
                    <button
                      key={r.value}
                      type="button"
                      onClick={() => setSelectedRole(r.value)}
                      className={`flex items-center gap-3 rounded-xl border p-3 text-left transition-all active:scale-[0.99] ${
                        active
                          ? "border-primary bg-primary/10 ring-2 ring-primary"
                          : "border-border bg-card hover:bg-accent"
                      }`}
                    >
                      <span
                        className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl ${
                          active
                            ? "bg-primary text-primary-foreground"
                            : "bg-muted text-muted-foreground"
                        }`}
                      >
                        {r.icon}
                      </span>
                      <span className="min-w-0">
                        <span className={`block font-semibold ${active ? "text-primary" : ""}`}>
                          {r.label}
                        </span>
                        <span className="block text-xs text-muted-foreground">{r.sublabel}</span>
                      </span>
                      {active && (
                        <span className="ml-auto h-2.5 w-2.5 rounded-full bg-primary shrink-0" />
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            <Button onClick={signUp} disabled={loading} className="h-12 w-full text-base font-semibold">
              {loading ? "Creando..." : "Crear cuenta"}
            </Button>
          </TabsContent>
        </Tabs>
      </div>
    </main>
  );
}

async function getRoleDestination(userId: string): Promise<string> {
  const { data } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .limit(1)
    .maybeSingle();
  if (!data) return "/shifts";
  return data.role === "supervisor" || data.role === "admin" ? "/supervisor" : "/shifts";
}
