import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { Package, Plus, Minus } from "lucide-react";
import { formatSince } from "@/lib/time";

interface Supply { id: string; name: string; unit: string; stock?: number; min_stock?: number }
interface Usage {
  id: string;
  quantity: number;
  used_at: string;
  supplies: { name: string; unit: string } | null;
}

export function SuppliesTab({
  patientId,
  userId,
}: {
  patientId: string;
  userId: string;
}) {
  const [supplies, setSupplies] = useState<Supply[]>([]);
  const [usages, setUsages] = useState<Usage[]>([]);
  const [supplyId, setSupplyId] = useState<string>("");
  const [qty, setQty] = useState(1);

  const loadUsages = async () => {
    const { data } = await supabase
      .from("supply_usages")
      .select("id, quantity, used_at, supplies(name, unit)")
      .eq("patient_id", patientId)
      .order("used_at", { ascending: false });
    setUsages((data as unknown as Usage[]) ?? []);
  };

  useEffect(() => {
    supabase.from("supplies").select("id,name,unit,stock,min_stock").order("name").then(({ data }) => {
      setSupplies((data as Supply[]) ?? []);
    });
    loadUsages();
  }, [patientId]);

  const register = async () => {
    if (!supplyId) return toast.error("Selecciona un insumo");
    if (qty <= 0) return toast.error("Cantidad inválida");
    const { error } = await supabase.from("supply_usages").insert({
      patient_id: patientId,
      user_id: userId,
      supply_id: supplyId,
      quantity: qty,
    });
    if (error) return toast.error(error.message);
    // Decrement stock + low-stock alert
    const sup = supplies.find((s) => s.id === supplyId);
    if (sup) {
      const newStock = Math.max(0, (sup.stock ?? 0) - qty);
      await supabase.from("supplies").update({ stock: newStock }).eq("id", supplyId);
      if (newStock <= (sup.min_stock ?? 0)) {
        await supabase.from("alerts").insert({
          patient_id: patientId,
          user_id: userId,
          type: "low_stock",
          severity: "urgent",
          priority_score: 70,
          message: `Stock bajo: ${sup.name} (${newStock} ${sup.unit})`,
        });
      }
    }
    toast.success("Insumo registrado");
    setQty(1);
    setSupplyId("");
    // Refresh supplies for updated stock
    const { data } = await supabase
      .from("supplies")
      .select("id,name,unit,stock,min_stock")
      .order("name");
    setSupplies((data as Supply[]) ?? []);
    loadUsages();
  };

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border bg-card p-4 space-y-3">
        <div className="space-y-1.5">
          <Label>Insumo</Label>
          <Select value={supplyId} onValueChange={setSupplyId}>
            <SelectTrigger className="h-12 text-base">
              <SelectValue placeholder="Selecciona insumo" />
            </SelectTrigger>
            <SelectContent>
              {supplies.map((s) => (
                <SelectItem key={s.id} value={s.id} className="text-base">
                  {s.name}
                  {typeof s.stock === "number" && (
                    <span
                      className={`ml-2 text-xs ${
                        s.stock <= (s.min_stock ?? 0)
                          ? "text-[var(--priority-critical)] font-bold"
                          : "text-muted-foreground"
                      }`}
                    >
                      ({s.stock} {s.unit})
                    </span>
                  )}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label>Cantidad</Label>
          <div className="flex items-center gap-2">
            <Button
              size="icon"
              variant="outline"
              className="h-12 w-12"
              onClick={() => setQty((q) => Math.max(1, q - 1))}
              aria-label="Restar"
            >
              <Minus className="h-5 w-5" />
            </Button>
            <Input
              type="number"
              inputMode="numeric"
              value={qty}
              onChange={(e) => setQty(Math.max(1, Number(e.target.value) || 1))}
              className="h-12 flex-1 text-center text-2xl font-semibold"
            />
            <Button
              size="icon"
              variant="outline"
              className="h-12 w-12"
              onClick={() => setQty((q) => q + 1)}
              aria-label="Sumar"
            >
              <Plus className="h-5 w-5" />
            </Button>
          </div>
        </div>
        <Button onClick={register} className="h-12 w-full text-base font-semibold">
          Registrar uso
        </Button>
      </div>

      <div>
        <h3 className="mb-2 px-1 text-sm font-semibold text-muted-foreground">
          Usados en este paciente
        </h3>
        {usages.length === 0 ? (
          <p className="px-1 text-sm text-muted-foreground">Aún no se registra uso.</p>
        ) : (
          <ul className="space-y-2">
            {usages.map((u) => (
              <li key={u.id} className="flex items-center gap-3 rounded-xl border bg-card p-3">
                <Package className="h-5 w-5 text-muted-foreground" />
                <div className="flex-1">
                  <div className="font-medium">{u.supplies?.name ?? "—"}</div>
                  <div className="text-xs text-muted-foreground">
                    Hace {formatSince(u.used_at)}
                  </div>
                </div>
                <span className="rounded-lg bg-secondary px-2 py-1 text-sm font-semibold tabular-nums">
                  ×{u.quantity}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}