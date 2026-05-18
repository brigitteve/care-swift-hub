import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { computePriority } from "@/lib/priority";
import { formatSince } from "@/lib/time";
import { toast } from "sonner";

interface VitalRow {
  id: string;
  bp_systolic: number | null;
  bp_diastolic: number | null;
  hr: number | null;
  temp: number | null;
  spo2: number | null;
  rr: number | null;
  glucose: number | null;
  pain: number | null;
  created_at: string;
}

const FIELDS: { key: keyof VitalRow; label: string; unit: string; step?: string }[] = [
  { key: "bp_systolic", label: "PA Sis", unit: "mmHg" },
  { key: "bp_diastolic", label: "PA Dia", unit: "mmHg" },
  { key: "hr", label: "FC", unit: "lpm" },
  { key: "spo2", label: "SpO₂", unit: "%" },
  { key: "temp", label: "Temp", unit: "°C", step: "0.1" },
  { key: "rr", label: "FR", unit: "rpm" },
  { key: "glucose", label: "Gluc", unit: "mg/dL" },
  { key: "pain", label: "Dolor", unit: "/10" },
];

export function VitalsForm({
  patientId,
  userId,
}: {
  patientId: string;
  userId: string;
}) {
  const [vals, setVals] = useState<Record<string, string>>({});
  const [history, setHistory] = useState<VitalRow[]>([]);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    const { data } = await supabase
      .from("vital_signs")
      .select("*")
      .eq("patient_id", patientId)
      .order("created_at", { ascending: false })
      .limit(20);
    setHistory((data as VitalRow[]) ?? []);
  };
  useEffect(() => {
    load();
    const ch = supabase
      .channel(`v-${patientId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "vital_signs", filter: `patient_id=eq.${patientId}` },
        () => load(),
      )
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [patientId]);

  const set = (k: string, v: string) => setVals((s) => ({ ...s, [k]: v }));
  const num = (k: string): number | null => {
    const v = vals[k];
    if (v == null || v === "") return null;
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  };

  const save = async () => {
    setSaving(true);
    const payload = {
      patient_id: patientId,
      user_id: userId,
      bp_systolic: num("bp_systolic"),
      bp_diastolic: num("bp_diastolic"),
      hr: num("hr"),
      spo2: num("spo2"),
      temp: num("temp"),
      rr: num("rr"),
      glucose: num("glucose"),
      pain: num("pain"),
    };
    const { error } = await supabase.from("vital_signs").insert(payload);
    if (error) {
      setSaving(false);
      return toast.error(error.message);
    }

    // Recompute priority + last_attended_at
    const priority = computePriority(payload);
    await supabase
      .from("patients")
      .update({ priority, last_attended_at: new Date().toISOString() })
      .eq("id", patientId);

    if (priority === "critical" || priority === "urgent") {
      await supabase.from("alerts").insert({
        patient_id: patientId,
        user_id: userId,
        type: "vitals_out_of_range",
        message: "Signos vitales fuera de rango",
        severity: priority,
      });
    }

    toast.success(`Guardado — prioridad: ${priority}`);
    setVals({});
    setSaving(false);
  };

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border bg-card p-4">
        <div className="grid grid-cols-2 gap-3">
          {FIELDS.map((f) => (
            <div key={f.key} className="space-y-1">
              <Label className="text-xs uppercase tracking-wide text-muted-foreground">
                {f.label} <span className="opacity-60">({f.unit})</span>
              </Label>
              <Input
                inputMode="decimal"
                type="number"
                step={f.step ?? "1"}
                value={vals[f.key] ?? ""}
                onChange={(e) => set(f.key, e.target.value)}
                className="h-14 text-2xl font-semibold tabular-nums text-center"
              />
            </div>
          ))}
        </div>
        <Button onClick={save} disabled={saving} className="mt-4 h-14 w-full text-base font-semibold">
          {saving ? "Guardando..." : "Guardar signos"}
        </Button>
      </div>

      <div>
        <h3 className="mb-2 px-1 text-sm font-semibold text-muted-foreground">
          Historial del turno
        </h3>
        {history.length === 0 ? (
          <p className="px-1 text-sm text-muted-foreground">Sin registros aún.</p>
        ) : (
          <ul className="space-y-2">
            {history.map((h) => (
              <li key={h.id} className="rounded-xl border bg-card p-3 text-sm">
                <div className="mb-1 text-xs text-muted-foreground">
                  Hace {formatSince(h.created_at)}
                </div>
                <div className="flex flex-wrap gap-x-3 gap-y-1 tabular-nums">
                  {h.bp_systolic != null && <span>PA <b>{h.bp_systolic}/{h.bp_diastolic ?? "—"}</b></span>}
                  {h.hr != null && <span>FC <b>{h.hr}</b></span>}
                  {h.spo2 != null && <span>SpO₂ <b>{h.spo2}%</b></span>}
                  {h.temp != null && <span>T <b>{h.temp}°</b></span>}
                  {h.rr != null && <span>FR <b>{h.rr}</b></span>}
                  {h.glucose != null && <span>Gluc <b>{h.glucose}</b></span>}
                  {h.pain != null && <span>Dolor <b>{h.pain}/10</b></span>}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}