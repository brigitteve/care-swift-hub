import { supabase } from "@/integrations/supabase/client";
import { computePriority } from "./priority";
import { computeAlertScore } from "./alerts-score";
import { minutesSince } from "./time";

const DEMO = [
  { name: "María González",  bed: "B-01", reason: "Dolor torácico",      vitals: { spo2: 88, hr: 138, temp: 37.4, pain: 9, bp_systolic: 90,  bp_diastolic: 60 } },
  { name: "Carlos Ruiz",     bed: "B-02", reason: "Fractura tibia",      vitals: { spo2: 96, hr: 110, temp: 37.0, pain: 8, bp_systolic: 140, bp_diastolic: 90 } },
  { name: "Lucía Pérez",     bed: "B-03", reason: "Cefalea intensa",     vitals: { spo2: 97, hr: 88,  temp: 38.2, pain: 5, bp_systolic: 130, bp_diastolic: 85 } },
  { name: "Andrés López",    bed: "B-04", reason: "Control post-cirugía",vitals: { spo2: 98, hr: 72,  temp: 36.6, pain: 2, bp_systolic: 120, bp_diastolic: 78 } },
  { name: "Sofía Méndez",    bed: "B-05", reason: "Crisis asmática",     vitals: { spo2: 92, hr: 118, temp: 37.1, pain: 6, bp_systolic: 135, bp_diastolic: 82 } },
];

export async function seedDemoPatients(shiftId: string, userId: string) {
  const now = Date.now();
  for (let i = 0; i < DEMO.length; i++) {
    const d = DEMO[i];
    const priority = computePriority(d.vitals);
    // Stagger last_attended_at so first patient pulses (>10 min)
    const lastAttended = new Date(now - (i === 0 ? 14 : i * 3) * 60000).toISOString();
    const { data: p, error } = await supabase
      .from("patients")
      .insert({
        shift_id: shiftId,
        user_id: userId,
        assigned_to: userId,
        name: d.name,
        bed: d.bed,
        reason: d.reason,
        priority,
        last_attended_at: lastAttended,
      })
      .select()
      .single();
    if (error || !p) continue;

    // Insert 5 historical vitals (trending) so sparkline + history have data
    for (let v = 4; v >= 0; v--) {
      const drift = (5 - v) * (priority === "critical" ? -1 : 1);
      await supabase.from("vital_signs").insert({
        patient_id: p.id,
        user_id: userId,
        bp_systolic: (d.vitals.bp_systolic ?? 120) + drift,
        bp_diastolic: (d.vitals.bp_diastolic ?? 80) + drift,
        hr: (d.vitals.hr ?? 80) + drift * 2,
        spo2: Math.max(80, Math.min(100, (d.vitals.spo2 ?? 97) - drift)),
        temp: d.vitals.temp ?? 36.8,
        pain: d.vitals.pain ?? 0,
        rr: 18,
        glucose: 110,
      });
    }

    await supabase.from("checklist_items").insert([
      { patient_id: p.id, user_id: userId, title: "Tomar signos vitales", critical: true },
      { patient_id: p.id, user_id: userId, title: "Administrar medicación", critical: priority === "critical" },
      { patient_id: p.id, user_id: userId, title: "Revisar vía IV", done: true, completed_at: new Date().toISOString() },
    ]);

    if (priority === "critical" || priority === "urgent") {
      const { score } = computeAlertScore(d.vitals, minutesSince(lastAttended));
      await supabase.from("alerts").insert({
        patient_id: p.id,
        user_id: userId,
        type: "vitals_out_of_range",
        message: `Signos vitales fuera de rango — ${d.name}`,
        severity: priority,
        priority_score: score,
      });
    }
  }

  // Ensure demo supplies have stock + a couple are low to surface the badge
  const { data: sups } = await supabase
    .from("supplies")
    .select("id, name")
    .order("name");
  if (sups && sups.length > 0) {
    for (let i = 0; i < sups.length; i++) {
      const low = i < 2;
      await supabase
        .from("supplies")
        .update({ stock: low ? 3 : 40, min_stock: 5 })
        .eq("id", sups[i].id);
    }
  }
}