export type Priority = "critical" | "urgent" | "moderate" | "stable";

export interface VitalInput {
  spo2?: number | null;
  hr?: number | null;
  temp?: number | null;
  pain?: number | null;
  bp_systolic?: number | null;
  bp_diastolic?: number | null;
}

export function computePriority(v: VitalInput): Priority {
  const { spo2, hr, temp, pain, bp_systolic, bp_diastolic } = v;
  // CRITICAL
  if (
    (spo2 != null && spo2 < 90) ||
    (hr != null && (hr > 130 || hr < 40)) ||
    (temp != null && (temp > 40 || temp < 35)) ||
    (bp_systolic != null && (bp_systolic > 200 || bp_systolic < 80))
  ) return "critical";
  // URGENT
  if (
    (spo2 != null && spo2 >= 90 && spo2 <= 94) ||
    (hr != null && hr >= 100 && hr <= 130) ||
    (pain != null && pain > 7) ||
    (bp_systolic != null && bp_systolic > 160) ||
    (bp_diastolic != null && bp_diastolic > 100)
  ) return "urgent";
  // MODERATE
  if (
    (pain != null && pain >= 4 && pain <= 6) ||
    (temp != null && (temp >= 38 || temp < 36)) ||
    (hr != null && (hr > 90 || hr < 55))
  ) return "moderate";
  return "stable";
}

export const PRIORITY_META: Record<Priority, { label: string; emoji: string; dot: string; chip: string; row: string }> = {
  critical: {
    label: "Crítico",
    emoji: "🔴",
    dot: "bg-[var(--priority-critical)]",
    chip: "bg-[var(--priority-critical)] text-[var(--priority-critical-fg)]",
    row: "border-l-[var(--priority-critical)]",
  },
  urgent: {
    label: "Urgente",
    emoji: "🟠",
    dot: "bg-[var(--priority-urgent)]",
    chip: "bg-[var(--priority-urgent)] text-[var(--priority-urgent-fg)]",
    row: "border-l-[var(--priority-urgent)]",
  },
  moderate: {
    label: "Moderado",
    emoji: "🟡",
    dot: "bg-[var(--priority-moderate)]",
    chip: "bg-[var(--priority-moderate)] text-[var(--priority-moderate-fg)]",
    row: "border-l-[var(--priority-moderate)]",
  },
  stable: {
    label: "Estable",
    emoji: "🟢",
    dot: "bg-[var(--priority-stable)]",
    chip: "bg-[var(--priority-stable)] text-[var(--priority-stable-fg)]",
    row: "border-l-[var(--priority-stable)]",
  },
};

export const PRIORITY_ORDER: Record<Priority, number> = {
  critical: 0, urgent: 1, moderate: 2, stable: 3,
};