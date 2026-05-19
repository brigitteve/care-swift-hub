import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Sliders, Save, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useAlertThresholds } from "@/hooks/useAlertThresholds";

export function AlertThresholdsForm({ userId }: { userId: string }) {
  const { thresholds, loading } = useAlertThresholds();
  const [vals, setVals] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [expanded, setExpanded] = useState(false);

  if (loading) return null;

  const get = (k: string): string =>
    vals[k] !== undefined ? vals[k] : String(thresholds[k as keyof typeof thresholds] ?? "");
  const set = (k: string, v: string) => setVals((s) => ({ ...s, [k]: v }));
  const num = (k: string, def: number) => {
    const v = vals[k];
    if (v == null) return def;
    const n = Number(v);
    return Number.isFinite(n) ? n : def;
  };

  const save = async () => {
    setSaving(true);
    // Deactivate existing active thresholds
    await supabase
      .from("alert_thresholds")
      .update({ is_active: false } as never)
      .eq("is_active", true);

    // Insert new active threshold set
    const { error } = await supabase.from("alert_thresholds").insert({
      created_by: userId,
      hr_min: num("hr_min", 40),
      hr_max: num("hr_max", 130),
      spo2_min: num("spo2_min", 90),
      temp_min: num("temp_min", 35),
      temp_max: num("temp_max", 40),
      bp_sys_min: num("bp_sys_min", 80),
      bp_sys_max: num("bp_sys_max", 200),
      bp_dia_max: num("bp_dia_max", 100),
      pain_urgent: num("pain_urgent", 7),
      unattended_min: num("unattended_min", 15),
      is_active: true,
    } as never);

    setSaving(false);
    if (error) return toast.error(error.message);
    setVals({});
    toast.success("Umbrales actualizados");
  };

  const FIELDS: { key: string; label: string; unit: string; min?: number; max?: number }[] = [
    { key: "hr_min", label: "FC mínima", unit: "lpm", min: 20, max: 80 },
    { key: "hr_max", label: "FC máxima", unit: "lpm", min: 100, max: 200 },
    { key: "spo2_min", label: "SpO₂ mínima", unit: "%", min: 70, max: 95 },
    { key: "temp_min", label: "Temp. mínima", unit: "°C", min: 30, max: 37 },
    { key: "temp_max", label: "Temp. máxima", unit: "°C", min: 37, max: 42 },
    { key: "bp_sys_min", label: "PA Sis. mínima", unit: "mmHg", min: 50, max: 100 },
    { key: "bp_sys_max", label: "PA Sis. máxima", unit: "mmHg", min: 150, max: 250 },
    { key: "bp_dia_max", label: "PA Dia. máxima", unit: "mmHg", min: 80, max: 130 },
    { key: "pain_urgent", label: "Dolor umbral urgente", unit: "/10", min: 5, max: 10 },
    { key: "unattended_min", label: "Minutos sin atención", unit: "min", min: 5, max: 60 },
  ];

  return (
    <div className="rounded-2xl border bg-card">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="flex w-full items-center justify-between p-4 text-left"
      >
        <div className="flex items-center gap-2 font-semibold text-sm">
          <Sliders className="h-4 w-4 text-primary" />
          Umbrales de alerta configurables
        </div>
        <span className="text-xs text-muted-foreground">{expanded ? "Ocultar ▲" : "Ver ▼"}</span>
      </button>

      {expanded && (
        <div className="border-t px-4 pb-4 pt-3 space-y-3">
          <p className="text-xs text-muted-foreground">
            Define los límites que clasifican un signo vital como crítico o urgente.
          </p>
          <div className="grid grid-cols-2 gap-3">
            {FIELDS.map((f) => (
              <div key={f.key} className="space-y-1">
                <Label className="text-xs text-muted-foreground">
                  {f.label} <span className="opacity-60">({f.unit})</span>
                </Label>
                <Input
                  type="number"
                  inputMode="numeric"
                  value={get(f.key)}
                  min={f.min}
                  max={f.max}
                  onChange={(e) => set(f.key, e.target.value)}
                  className="h-11 text-center text-base font-semibold tabular-nums"
                />
              </div>
            ))}
          </div>
          <Button onClick={save} disabled={saving} className="h-12 w-full font-semibold">
            {saving ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Save className="mr-2 h-4 w-4" />
            )}
            {saving ? "Guardando..." : "Guardar umbrales"}
          </Button>
        </div>
      )}
    </div>
  );
}
