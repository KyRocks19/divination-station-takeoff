"use client";

import { useEffect } from "react";

/**
 * Keeps `--header-h` (app/globals.css) equal to the header bar's real height, so the side column always starts below
 * it. The stylesheet's 3.5rem is right only while the header is one row: larger text (Settings, reading comfort) can
 * wrap it, and its bottom border adds a pixel. When the header scrolls away with the page (a very short window, or the
 * person turned the sticky header off in Settings) it takes no room, and the stylesheet's 0 stays. That setting can change
 * while the page is open, so the `data-header` attribute on <html> is watched too. Without script the stylesheet's value
 * is used.
 */
export default function HeaderHeight() {
  useEffect(() => {
    const header = document.querySelector<HTMLElement>("[data-app-header]");
    const root = document.documentElement;
    if (!header) return;
    const update = () => {
      if (getComputedStyle(header).position !== "sticky") root.style.removeProperty("--header-h");
      else root.style.setProperty("--header-h", `${header.offsetHeight}px`);
    };
    update();
    const watch = new ResizeObserver(update);
    watch.observe(header);
    const setting = new MutationObserver(update);
    setting.observe(root, { attributes: true, attributeFilter: ["data-header"] });
    window.addEventListener("resize", update);
    return () => {
      watch.disconnect();
      setting.disconnect();
      window.removeEventListener("resize", update);
      root.style.removeProperty("--header-h");
    };
  }, []);
  return null;
}
