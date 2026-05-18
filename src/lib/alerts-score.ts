import type { Priority, VitalInput } from "./priority";
import { computePriority } from "./priority";

/**
 * Multi-criteria alert score 0–100 combining vital severity + minutes unattended.
 */
export function computeAlertScore(
  vitals: VitalInput | null | undefined,
  minutesUnattended: number,
): { score: number; level: "info" | "urgent" | "critical" } {
  const p: Priority = vitals ? computePriority(vitals) : "stable";
  const vitalWeight: Record<Priority, number> = {
    critical: 70,
    urgent: 45,
    moderate: 25,
    stable: 5,
  };
  const timeBonus = Math.min(30, Math.max(0, minutesUnattended - 5));
  const score = Math.min(100, vitalWeight[p] + timeBonus);
  const level =
    score >= 80 ? "critical" : score >= 50 ? "urgent" : "info";
  return { score, level };
}