import { useEffect, useState } from "react";
import { useAppStore } from "@/stores/useAppStore";
import { Activity, ClipboardList, BellRing, X, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { usePushNotifications } from "@/hooks/usePushNotifications";

interface Step {
  icon: React.ReactNode;
  title: string;
  body: string;
  action?: React.ReactNode;
}

export function OnboardingOverlay() {
  const { onboardingDone, completeOnboarding } = useAppStore();
  const [step, setStep] = useState(0);
  const [visible, setVisible] = useState(!onboardingDone);
  const { permission, request, supported } = usePushNotifications();

  // Don't show if already done
  useEffect(() => {
    if (onboardingDone) setVisible(false);
  }, [onboardingDone]);

  if (!visible) return null;

  const STEPS: Step[] = [
    {
      icon: <Activity className="h-10 w-10 text-primary" />,
      title: "Bienvenida a PatientSOS",
      body: "La app de triage más rápida para enfermería de urgencias. Gestiona pacientes, signos vitales, tareas e insumos en tiempo real.",
    },
    {
      icon: <ClipboardList className="h-10 w-10 text-[var(--priority-moderate)]" />,
      title: "Tablero Kanban",
      body: "Tus pacientes se organizan por prioridad: 🔴 Crítico → 🟠 Urgente → 🟡 Moderado → 🟢 Estable. Toca una tarjeta para ver el perfil completo o usa el botón ＋ para agregar un nuevo paciente.",
    },
    {
      icon: <BellRing className="h-10 w-10 text-[var(--priority-urgent)]" />,
      title: "Alertas en tiempo real",
      body: "Recibe notificaciones push cuando un paciente crítico lleva más de 15 min sin atención o sus signos salen de rango.",
      action: supported && permission === "default" ? (
        <Button
          onClick={request}
          variant="outline"
          className="h-11 w-full"
        >
          <BellRing className="h-4 w-4 mr-2" />
          Activar notificaciones
        </Button>
      ) : null,
    },
  ];

  const current = STEPS[step];
  const isLast = step === STEPS.length - 1;

  const next = () => {
    if (isLast) {
      completeOnboarding();
      setVisible(false);
    } else {
      setStep((s) => s + 1);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-4 backdrop-blur-sm sm:items-center">
      <div className="w-full max-w-sm rounded-3xl border bg-card shadow-2xl overflow-hidden">
        {/* Progress bar */}
        <div className="flex gap-1 p-4 pb-0">
          {STEPS.map((_, i) => (
            <div
              key={i}
              className={`h-1 flex-1 rounded-full transition-all duration-300 ${
                i <= step ? "bg-primary" : "bg-muted"
              }`}
            />
          ))}
        </div>

        <div className="p-6 text-center">
          {/* Icon */}
          <div className="mx-auto mb-4 grid h-20 w-20 place-items-center rounded-2xl bg-muted">
            {current.icon}
          </div>

          <h2 className="mb-2 text-xl font-bold leading-tight">{current.title}</h2>
          <p className="text-sm text-muted-foreground leading-relaxed">{current.body}</p>

          {current.action && <div className="mt-4">{current.action}</div>}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t p-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              completeOnboarding();
              setVisible(false);
            }}
            className="text-muted-foreground"
          >
            <X className="h-4 w-4 mr-1" />
            Saltar
          </Button>
          <Button onClick={next} className="h-11 px-6 font-semibold">
            {isLast ? "¡Empezar!" : (
              <>
                Siguiente
                <ArrowRight className="ml-2 h-4 w-4" />
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
