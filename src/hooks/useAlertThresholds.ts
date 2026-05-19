import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Priority } from "@/lib/priority";

export interface AlertThresholds {
  id: string;
  hr_min: number;
  hr_max: number;
  spo2_min: number;
  temp_min: number;
  temp_max: number;
  bp_sys_min: number;
  bp_sys_max: number;
  bp_dia_max: number;
  pain_urgent: number;
  unattended_min: number;
}

const DEFAULT_THRESHOLDS: Omit<AlertThresholds, "id"> = {
  hr_min: 40,
  hr_max: 130,
  spo2_min: 90,
  temp_min: 35.0,
  temp_max: 40.0,
  bp_sys_min: 80,
  bp_sys_max: 200,
  bp_dia_max: 100,
  pain_urgent: 7,
  unattended_min: 15,
};

export interface VitalPayload {
  spo2?: number | null;
  hr?: number | null;
  temp?: number | null;
  pain?: number | null;
  bp_systolic?: number | null;
  bp_diastolic?: number | null;
}

function evaluateVitals(v: VitalPayload, t: Omit<AlertThresholds, "id">): Priority {
  const { spo2, hr, temp, bp_systolic, bp_diastolic, pain } = v;
  // CRITICAL
  if (
    (spo2 != null && spo2 < t.spo2_min) ||
    (hr != null && (hr > t.hr_max || hr < t.hr_min)) ||
    (temp != null && (temp > t.temp_max || temp < t.temp_min)) ||
    (bp_systolic != null && (bp_systolic > t.bp_sys_max || bp_systolic < t.bp_sys_min))
  ) return "critical";
  // URGENT
  if (
    (spo2 != null && spo2 >= t.spo2_min && spo2 <= 94) ||
    (hr != null && hr >= 100 && hr <= t.hr_max) ||
    (pain != null && pain > t.pain_urgent) ||
    (bp_systolic != null && bp_systolic > 160) ||
    (bp_diastolic != null && bp_diastolic > t.bp_dia_max)
  ) return "urgent";
  // MODERATE
  if (
    (pain != null && pain >= 4 && pain <= 6) ||
    (temp != null && (temp >= 38 || temp < 36)) ||
    (hr != null && (hr > 90 || hr < 55))
  ) return "moderate";
  return "stable";
}

export function useAlertThresholds() {
  const [thresholds, setThresholds] = useState<Omit<AlertThresholds, "id">>(DEFAULT_THRESHOLDS);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    supabase
      .from("alert_thresholds")
      .select("*")
      .eq("is_active", true)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle()
      .then(({ data }) => {
        if (cancelled) return;
        if (data) {
          const { id: _id, is_active: _a, created_at: _c, created_by: _cb, ...rest } = data as AlertThresholds & { is_active: boolean; created_at: string; created_by: string };
          setThresholds(rest);
        }
        setLoading(false);
      });
    return () => { cancelled = true; };
  }, []);

  return {
    thresholds,
    loading,
    evaluate: (v: VitalPayload) => evaluateVitals(v, thresholds),
    unattendedMin: thresholds.unattended_min,
  };
}
