export function haptic(pattern: number | number[] = 30) {
  try {
    if (typeof navigator !== "undefined" && "vibrate" in navigator) {
      navigator.vibrate(pattern);
    }
  } catch {
    // ignore
  }
}

export const HAPTIC = {
  tap: 15,
  success: [40, 30, 60],
  critical: [80, 40, 80, 40, 120],
};