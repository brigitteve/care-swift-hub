import { create } from "zustand";
import { persist } from "zustand/middleware";

interface AppState {
  theme: "light" | "dark";
  currentShiftId: string | null;
  onboardingDone: boolean;
  toggleTheme: () => void;
  setShift: (id: string | null) => void;
  completeOnboarding: () => void;
}

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      theme: "light",
      currentShiftId: null,
      onboardingDone: false,
      toggleTheme: () =>
        set((s) => ({ theme: s.theme === "dark" ? "light" : "dark" })),
      setShift: (id) => set({ currentShiftId: id }),
      completeOnboarding: () => set({ onboardingDone: true }),
    }),
    { name: "patientsos-app" },
  ),
);