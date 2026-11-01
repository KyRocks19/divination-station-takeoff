// Whether this person asked for less motion: the device's own setting, or the "less motion" switch in Reading comfort
// (kept on <html> as data-motion by the inline script in app/layout.tsx). Browser only; on the server it says no.
export function wantsLessMotion(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches || document.documentElement.dataset.motion === "less";
  } catch {
    return false;
  }
}
