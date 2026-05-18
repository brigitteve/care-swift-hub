import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { Activity } from "lucide-react";

export const Route = createFileRoute("/login")({
  validateSearch: (search: Record<string, unknown>) => ({
    redirect: typeof search.redirect === "string" ? search.redirect : "",
  }),
  component: LoginPage,
  head: () => ({
    meta: [{ title: "Acceso - PatientSOS" }],
  }),
});

function LoginPage() {
  const router = useRouter();
  const { redirect } = Route.useSearch();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) window.location.href = redirect || "/shifts";
    });
  }, [redirect, router]);

  const signIn = async () => {
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) return toast.error(error.message);
    window.location.href = redirect || "/shifts";
  };

  const signUp = async () => {
    setLoading(true);
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: window.location.origin,
        data: { full_name: fullName, role: "nurse" },
      },
    });
    setLoading(false);
    if (error) return toast.error(error.message);
    toast.success("Cuenta creada");
    window.location.href = redirect || "/shifts";
  };

  return (
    <main className="safe-top safe-bottom grid min-h-screen place-items-center bg-background p-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-3 grid h-16 w-16 place-items-center rounded-2xl bg-primary text-primary-foreground shadow-lg">
            <Activity className="h-8 w-8" />
          </div>
          <h1 className="text-2xl font-bold">PatientSOS</h1>
          <p className="text-sm text-muted-foreground">
            Triage rapido para enfermeria de urgencias
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
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="si-pw">Contrasena</Label>
              <Input
                id="si-pw"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="h-12 text-base"
              />
            </div>
            <Button onClick={signIn} disabled={loading} className="h-12 w-full text-base font-semibold">
              {loading ? "Entrando..." : "Entrar"}
            </Button>
          </TabsContent>

          <TabsContent value="signup" className="space-y-3 pt-4">
            <div className="space-y-1.5">
              <Label htmlFor="su-name">Nombre completo</Label>
              <Input
                id="su-name"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
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
              <Label htmlFor="su-pw">Contrasena</Label>
              <Input
                id="su-pw"
                type="password"
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="h-12 text-base"
              />
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
