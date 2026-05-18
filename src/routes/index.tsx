import { createFileRoute } from "@tanstack/react-router";
import { useEffect } from "react";
import { useRouter } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/")({
  component: Index,
});

function Index() {
  const router = useRouter();
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      router.navigate({ to: data.session ? "/shifts" : "/login" });
    });
  }, [router]);
  return (
    <div className="grid min-h-screen place-items-center bg-background text-muted-foreground">
      Cargando…
    </div>
  );
}
