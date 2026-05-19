import { MessageCircle, Share2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

interface Props {
  shiftName: string;
  joinToken: string;
}

export function WhatsAppInviteButton({ shiftName, joinToken }: Props) {
  const inviteUrl = `${window.location.origin}/shifts?token=${joinToken}`;
  const message = encodeURIComponent(
    `🏥 Te invito al turno "${shiftName}" en PatientSOS.\n\nÚnete aquí: ${inviteUrl}`
  );
  const waLink = `https://wa.me?text=${message}`;

  const handleShare = async () => {
    // Try native share first (mobile PWA)
    if (navigator.share) {
      try {
        await navigator.share({
          title: `Turno: ${shiftName}`,
          text: `Únete al turno "${shiftName}" en PatientSOS`,
          url: inviteUrl,
        });
        return;
      } catch {
        // User cancelled or not supported — fall through to WhatsApp
      }
    }
    // Fallback: copy URL and open WhatsApp
    try {
      await navigator.clipboard.writeText(inviteUrl);
      toast.success("Enlace copiado al portapapeles");
    } catch {
      // Clipboard not available
    }
    window.open(waLink, "_blank", "noopener,noreferrer");
  };

  return (
    <Button
      variant="outline"
      size="sm"
      className="h-9 gap-1.5 text-sm"
      onClick={handleShare}
      aria-label="Compartir turno por WhatsApp"
    >
      <MessageCircle className="h-4 w-4 text-green-500" />
      <span className="hidden xs:inline">Compartir</span>
      <Share2 className="h-3.5 w-3.5 xs:hidden" />
    </Button>
  );
}
