import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { AppHeader } from "@/components/AppHeader";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { VitalsForm } from "@/components/VitalsForm";
import { ChecklistTab } from "@/components/ChecklistTab";
import { SuppliesTab } from "@/components/SuppliesTab";
import { NotesTab } from "@/components/NotesTab";
import { HistorialTab } from "@/components/HistorialTab";
import { PRIORITY_META, type Priority } from "@/lib/priority";
import { BedDouble } from "lucide-react";

interface Patient {
  id: string;
  name: string;
  bed: string;
  reason: string | null;
  priority: Priority;
}

export const Route = createFileRoute("/_authenticated/patients/$patientId")({
  component: PatientPage,
  head: () => ({ meta: [{ title: "Paciente — PatientSOS" }] }),
});

function PatientPage() {
  const { patientId } = Route.useParams();
  const { user } = useAuth();
  const [patient, setPatient] = useState<Patient | null>(null);

  useEffect(() => {
    const load = async () => {
      const { data } = await supabase
        .from("patients")
        .select("id,name,bed,reason,priority")
        .eq("id", patientId)
        .maybeSingle();
      setPatient(data as Patient | null);
    };
    load();
    const ch = supabase
      .channel(`p-${patientId}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "patients", filter: `id=eq.${patientId}` },
        () => load(),
      )
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [patientId]);

  if (!user) return null;

  const meta = patient ? PRIORITY_META[patient.priority] : null;

  return (
    <div className="min-h-screen bg-background pb-12">
      <AppHeader title={patient?.name ?? "Paciente"} back="/board" />
      <main className="mx-auto max-w-md p-3 space-y-3">
        {/* Priority banner */}
        {patient && meta && (
          <div className={`rounded-2xl border-l-8 ${meta.row} border bg-card p-4`}>
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <h2 className="text-xl font-bold leading-tight truncate">{patient.name}</h2>
                <div className="mt-1 flex items-center gap-2 text-sm text-muted-foreground">
                  <BedDouble className="h-4 w-4" /> {patient.bed}
                  {patient.reason && <span className="truncate">· {patient.reason}</span>}
                </div>
              </div>
              <span className={`shrink-0 rounded-full px-3 py-1.5 text-sm font-bold ${meta.chip}`}>
                {meta.emoji} {meta.label}
              </span>
            </div>
          </div>
        )}

        {/* 5-Tab navigation */}
        <Tabs defaultValue="vitals" className="w-full">
          <TabsList className="grid w-full grid-cols-5 h-12">
            <TabsTrigger value="vitals"   className="h-10 text-xs font-semibold px-1">Signos</TabsTrigger>
            <TabsTrigger value="checklist" className="h-10 text-xs font-semibold px-1">Tareas</TabsTrigger>
            <TabsTrigger value="supplies" className="h-10 text-xs font-semibold px-1">Insumos</TabsTrigger>
            <TabsTrigger value="notes"    className="h-10 text-xs font-semibold px-1">Notas</TabsTrigger>
            <TabsTrigger value="history"  className="h-10 text-xs font-semibold px-1">Historial</TabsTrigger>
          </TabsList>
          <TabsContent value="vitals" className="pt-3">
            <VitalsForm patientId={patientId} userId={user.id} />
          </TabsContent>
          <TabsContent value="checklist" className="pt-3">
            <ChecklistTab patientId={patientId} userId={user.id} />
          </TabsContent>
          <TabsContent value="supplies" className="pt-3">
            <SuppliesTab patientId={patientId} userId={user.id} />
          </TabsContent>
          <TabsContent value="notes" className="pt-3">
            <NotesTab patientId={patientId} userId={user.id} />
          </TabsContent>
          <TabsContent value="history" className="pt-3">
            <HistorialTab patientId={patientId} />
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}