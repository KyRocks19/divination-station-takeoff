"use client";

import { useRef } from "react";

export interface TabItem<T extends string> {
  id: T;
  label: string;
  /** A small count after the label, with the words a screen reader says for it. */
  badge?: { text: string; label: string };
}

interface TabsProps<T extends string> {
  /** What the tabs choose between, for a screen reader ("Reading sections"). */
  label: string;
  tabs: TabItem<T>[];
  active: T;
  onChange: (id: T) => void;
  /** The id of each tab's button, so its panel can say `aria-labelledby`. */
  tabId: (id: T) => string;
  /** The id of each tab's panel, for `aria-controls`. */
  panelId: (id: T) => string;
  className?: string;
}

/**
 * A row of tabs (WAI-ARIA tabs, automatic activation): one Tab stop, Left and Right move between the tabs (Home and End to the first and the
 * last), and the chosen one is underlined. The panels are the page's own; give each `role="tabpanel"`, the id from `panelId` and
 * `aria-labelledby` from `tabId`. Targets are 44 px on a phone.
 */
export function Tabs<T extends string>({ label, tabs, active, onChange, tabId, panelId, className = "" }: TabsProps<T>) {
  const list = useRef<HTMLDivElement>(null);
  function move(e: React.KeyboardEvent) {
    const keys = ["ArrowLeft", "ArrowRight", "Home", "End"];
    if (!keys.includes(e.key) || tabs.length === 0) return;
    e.preventDefault();
    const at = Math.max(0, tabs.findIndex((t) => t.id === active));
    const to = e.key === "Home" ? 0 : e.key === "End" ? tabs.length - 1 : (at + (e.key === "ArrowRight" ? 1 : -1) + tabs.length) % tabs.length;
    onChange(tabs[to].id);
    list.current?.querySelector<HTMLElement>(`#${CSS.escape(tabId(tabs[to].id))}`)?.focus();
  }
  return (
    <div ref={list} role="tablist" aria-label={label} onKeyDown={move} className={`flex border-b border-line-strong ${className}`}>
      {tabs.map((t) => {
        const on = t.id === active;
        return (
          <button
            key={t.id}
            id={tabId(t.id)}
            type="button"
            role="tab"
            aria-selected={on}
            tabIndex={on ? 0 : -1}
            aria-controls={panelId(t.id)}
            onClick={() => onChange(t.id)}
            className={`flex-1 min-h-11 py-2.5 text-sm font-medium transition-colors relative ${on ? "text-tone-300" : "text-ink-faint hover:text-ink-muted"}`}
          >
            {t.label}
            {t.badge && (
              <span aria-label={t.badge.label} className={`ml-2 text-xs rounded-full px-1.5 py-0.5 ${on ? "bg-tone-700/60 text-tone-200" : "bg-tone-900/50 text-tone-600"}`}>
                {t.badge.text}
              </span>
            )}
            {on && <span aria-hidden="true" className="absolute bottom-0 inset-x-0 h-0.5 bg-tone-500 rounded-full" />}
          </button>
        );
      })}
    </div>
  );
}
