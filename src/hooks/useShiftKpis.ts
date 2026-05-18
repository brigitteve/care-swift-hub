import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface ShiftKpis {
  patients: number;
  critical: number;
  checklistTotal: number;
  checklistDone: number;
  checklistPct: number;
  alertsOpen: number;
  alertsCritical: number;
}

export function useShiftKpis(shiftId: string | null) {
  const [k, setK] = useState<ShiftKpis>({
    patients: 0,
    critical: 0,
    checklistTotal: 0,
    checklistDone: 0,
    checklistPct: 0,
    alertsOpen: 0,
    alertsCritical: 0,
  });

  useEffect(() => {
    if (!shiftId) return;
    let cancelled = false;

    const load = async () => {
      const { data: patients } = await supabase
        .from("patients")
        .select("id, priority")
        .eq("shift_id", shiftId);
      const pids = (patients ?? []).map((p) => p.id);
      if (cancelled) return;

      let checklistTotal = 0;
      let checklistDone = 0;
      let alertsOpen = 0;
      let alertsCritical = 0;

      if (pids.length) {
        const { data: cl } = await supabase
          .from("checklist_items")
          .select("done")
          .in("patient_id", pids);
        checklistTotal = cl?.length ?? 0;
        checklistDone = (cl ?? []).filter((c) => c.done).length;

        const { data: al } = await supabase
          .from("alerts")
          .select("severity")
          .in("patient_id", pids)
          .eq("resolved", false);
        alertsOpen = al?.length ?? 0;
        alertsCritical = (al ?? []).filter((a) => a.severity === "critical").length;
      }

      const critical = (patients ?? []).filter(
        (p) => p.priority === "critical",
      ).length;
      if (cancelled) return;
      setK({
        patients: patients?.length ?? 0,
        critical,
        checklistTotal,
        checklistDone,
        checklistPct: checklistTotal
          ? Math.round((checklistDone / checklistTotal) * 100)
          : 0,
        alertsOpen,
        alertsCritical,
      });
    };
    load();
    const ch = supabase
      .channel(`kpis-${shiftId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "checklist_items" },
        load,
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "patients", filter: `shift_id=eq.${shiftId}` },
        load,
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "alerts" },
        load,
      )
      .subscribe();
    return () => {
      cancelled = true;
      supabase.removeChannel(ch);
    };
  }, [shiftId]);

  return k;
}