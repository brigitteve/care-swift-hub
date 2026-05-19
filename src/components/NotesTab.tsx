import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Send, FileText, Loader2 } from "lucide-react";
import { formatSince } from "@/lib/time";
import { toast } from "sonner";
import { haptic, HAPTIC } from "@/lib/haptics";

interface Note {
  id: string;
  content: string;
  user_id: string;
  created_at: string;
  profiles?: { full_name: string } | null;
}

export function NotesTab({
  patientId,
  userId,
}: {
  patientId: string;
  userId: string;
}) {
  const [notes, setNotes] = useState<Note[]>([]);
  const [draft, setDraft] = useState("");
  const [saving, setSaving] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  const load = async () => {
    const { data } = await supabase
      .from("patient_notes")
      .select("id, content, user_id, created_at, profiles(full_name)")
      .eq("patient_id", patientId)
      .order("created_at", { ascending: true });
    setNotes((data as Note[]) ?? []);
    setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }), 50);
  };

  useEffect(() => {
    load();
    const ch = supabase
      .channel(`notes-${patientId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "patient_notes", filter: `patient_id=eq.${patientId}` },
        () => load(),
      )
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [patientId]);

  const save = async () => {
    if (!draft.trim()) return;
    setSaving(true);
    const { error } = await supabase.from("patient_notes").insert({
      patient_id: patientId,
      user_id: userId,
      content: draft.trim(),
    });
    setSaving(false);
    if (error) return toast.error(error.message);
    haptic(HAPTIC.tap);
    setDraft("");
  };

  return (
    <div className="flex h-full flex-col gap-3">
      {/* Notes list */}
      <div className="space-y-2 flex-1">
        {notes.length === 0 ? (
          <div className="rounded-xl border border-dashed p-8 text-center">
            <FileText className="mx-auto mb-2 h-8 w-8 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              Sin notas clínicas. Agrega la primera.
            </p>
          </div>
        ) : (
          notes.map((n) => {
            const isMine = n.user_id === userId;
            return (
              <div
                key={n.id}
                className={`rounded-2xl border p-3 text-sm ${
                  isMine
                    ? "ml-6 border-primary/30 bg-primary/10"
                    : "mr-6 bg-card"
                }`}
              >
                <div className="mb-1 flex items-center justify-between gap-2">
                  <span className="font-semibold text-xs">
                    {isMine ? "Tú" : (n.profiles?.full_name ?? "Colega")}
                  </span>
                  <span className="text-[10px] text-muted-foreground">
                    Hace {formatSince(n.created_at)}
                  </span>
                </div>
                <p className="leading-relaxed whitespace-pre-wrap">{n.content}</p>
              </div>
            );
          })
        )}
        <div ref={bottomRef} />
      </div>

      {/* Compose */}
      <div className="flex gap-2 pt-1">
        <Textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Escribe una nota clínica..."
          className="min-h-[52px] max-h-32 resize-none text-base leading-snug"
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              save();
            }
          }}
        />
        <Button
          onClick={save}
          disabled={saving || !draft.trim()}
          size="icon"
          className="h-[52px] w-[52px] shrink-0"
          aria-label="Guardar nota"
        >
          {saving ? <Loader2 className="h-5 w-5 animate-spin" /> : <Send className="h-5 w-5" />}
        </Button>
      </div>
    </div>
  );
}
