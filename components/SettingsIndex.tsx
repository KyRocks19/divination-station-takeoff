"use client";

import { useEffect, useState } from "react";
import { cx } from "@/lib/cx";

interface Entry {
  id: string;
  label: string;
  items: { id: string; label: string }[];
}

/**
 * The index of the Settings page: each section and each setting in it, as links to them on the same page. It is read from
 * the page itself (`data-settings-section` on a section, `data-settings-item` on the box around each setting), so a setting
 * that is not shown here (a copy on someone's own computer, an administrator's card, the Feathered edition) is never listed,
 * and the words are written once. The first render is empty; the list appears once the page has been drawn.
 */
export default function SettingsIndex({ of, className }: { of: string; className?: string }) {
  const [entries, setEntries] = useState<Entry[]>([]);

  useEffect(() => {
    const box = document.getElementById(of);
    if (!box) return;
    const read = () => {
      const next: Entry[] = [...box.querySelectorAll<HTMLElement>("[data-settings-section]")]
        .map((section) => ({
          id: section.id,
          label: section.dataset.settingsSection ?? "",
          // A setting whose component drew nothing leaves an empty box behind: it is not listed.
          items: [...section.querySelectorAll<HTMLElement>("[data-settings-item]")]
            .filter((item) => item.childElementCount > 0)
            .map((item) => ({ id: item.id, label: item.dataset.settingsItem ?? "" })),
        }))
        .filter((s) => s.items.length > 0);
      setEntries((prev) => (JSON.stringify(prev) === JSON.stringify(next) ? prev : next));
    };
    read();
    // Some settings appear only once they have asked the server whether they apply here.
    const watch = new MutationObserver(read);
    watch.observe(box, { childList: true, subtree: true });
    return () => watch.disconnect();
  }, [of]);

  const linkClass = "flex items-center min-h-6 py-0.5 rounded-control hover:text-accent-ink-hover transition-colors";

  return (
    <nav aria-label="On this page" className={cx("text-sm", className)}>
      <ul className="list-none p-0 space-y-4">
        {entries.map((s) => (
          <li key={s.id}>
            <a href={`#${s.id}`} className={cx(linkClass, "font-semibold text-ink-strong")}>
              {s.label}
            </a>
            <ul className="list-none p-0 mt-1 ml-3 border-l border-line pl-3 space-y-0.5">
              {s.items.map((it) => (
                <li key={it.id}>
                  <a href={`#${it.id}`} className={cx(linkClass, "text-ink-muted")}>
                    {it.label}
                  </a>
                </li>
              ))}
            </ul>
          </li>
        ))}
      </ul>
    </nav>
  );
}
