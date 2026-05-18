import { create } from "zustand";
import { persist } from "zustand/middleware";

interface AppState {
  theme: "light" | "dark";
  currentShiftId: string | null;
  toggleTheme: () => void;
  setShift: (id: string | null) => void;
}

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      theme: "light",
      currentShiftId: null,
      toggleTheme: () =>
        set((s) => ({ theme: s.theme === "dark" ? "light" : "dark" })),
      setShift: (id) => set({ currentShiftId: id }),
    }),
    { name: "patientsos-app" },
  ),
);