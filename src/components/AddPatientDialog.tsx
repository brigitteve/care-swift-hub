import { useState } from "react";
import { Plus } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export function AddPatientDialog({
  shiftId,
  userId,
}: {
  shiftId: string;
  userId: string;
}) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [bed, setBed] = useState("");
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    if (!name.trim() || !bed.trim()) {
      toast.error("Nombre y cama son obligatorios");
      return;
    }
    setSaving(true);
    const { error } = await supabase.from("patients").insert({
      shift_id: shiftId,
      user_id: userId,
      name: name.trim(),
      bed: bed.trim(),
      reason: reason.trim() || null,
    });
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Paciente agregado");
    setName("");
    setBed("");
    setReason("");
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          size="icon"
          className="fixed bottom-6 right-4 z-30 h-16 w-16 rounded-full shadow-xl"
          aria-label="Agregar paciente"
        >
          <Plus className="h-7 w-7" />
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Nuevo paciente</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="np-name">Nombre</Label>
            <Input
              id="np-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="h-12 text-base"
              autoFocus
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="np-bed">Cama</Label>
            <Input
              id="np-bed"
              value={bed}
              onChange={(e) => setBed(e.target.value)}
              className="h-12 text-base"
              placeholder="B-06"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="np-reason">Motivo</Label>
            <Input
              id="np-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="h-12 text-base"
            />
          </div>
          <Button onClick={submit} disabled={saving} className="h-12 w-full text-base">
            {saving ? "Guardando..." : "Agregar"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}