// The side navigation can be narrowed to its pictures. The choice is kept in this browser and put on <html> as
// data-nav="narrow" before the first paint, by the small script below (app/layout.tsx), so the column never jumps from
// wide to narrow after the page is drawn. This file touches no database code and no browser code on import.

export const NAV_WIDTH_KEY = "ds-nav";

/** Runs in the page head: sets data-nav="narrow" when the person chose it. Storage can throw; then the column stays wide. */
export const NAV_BOOT_SCRIPT = `(function(){try{if(localStorage.getItem(${JSON.stringify(NAV_WIDTH_KEY)})==="narrow")document.documentElement.setAttribute("data-nav","narrow");}catch(e){}})();`;

/** Saves the choice and puts it on the page now. */
export function applyNavWidth(narrow: boolean) {
  const root = document.documentElement;
  if (narrow) root.setAttribute("data-nav", "narrow");
  else root.removeAttribute("data-nav");
  try {
    if (narrow) localStorage.setItem(NAV_WIDTH_KEY, "narrow");
    else localStorage.removeItem(NAV_WIDTH_KEY);
  } catch {
    // Not stored; the choice lasts until the page is closed.
  }
}

/** True when the page is currently narrowed. */
export function navIsNarrow(): boolean {
  return document.documentElement.getAttribute("data-nav") === "narrow";
}
