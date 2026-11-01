"use client";

import { useEffect, useId, useState } from "react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { RECENT_CHANGED, clearRecentPages, loadRecent, recentIsOn, setRecentOn } from "@/lib/recent-pages-store";

/**
 * The switch for the "Recent" list in the side menu. It is kept in this browser only. The first render shows nothing
 * about the choice and the real value is read after it, so nothing depends on the browser at first paint.
 */
export default function RecentPagesSetting({ username }: { username?: string }) {
  const uid = useId();
  const [on, setOn] = useState<boolean | null>(null);
  const [count, setCount] = useState(0);

  useEffect(() => {
    const read = () => {
      setOn(recentIsOn());
      setCount(loadRecent(username).length);
    };
    read();
    window.addEventListener(RECENT_CHANGED, read);
    return () => window.removeEventListener(RECENT_CHANGED, read);
  }, [username]);

  return (
    <Card className="space-y-3" role="group" aria-labelledby={`${uid}-h`}>
      <div>
        <h3 id={`${uid}-h`} className="font-semibold text-ink-strong">Recent pages</h3>
        <p className="text-xs text-ink-faint mt-0.5">
          The side menu can list the last few pages you opened, so you can get back to one. The list is kept in this
          browser only, for you, and is cleared when you log out. It is not sent anywhere and it is not in your export.
        </p>
      </div>
      <label className="flex items-center gap-2 text-sm text-ink cursor-pointer">
        <input
          type="checkbox"
          checked={on ?? true}
          disabled={on === null}
          onChange={(e) => setRecentOn(e.target.checked)}
          className="accent-[var(--color-focus)]"
        />
        <span>Show a Recent list in the menu</span>
      </label>
      <p className="text-xs text-ink-faint" role="status">
        {on === false ? "Off. Nothing is being kept." : count > 0 ? `${count} page${count === 1 ? "" : "s"} kept on this device.` : "Nothing kept yet."}
      </p>
      {on && count > 0 && (
        <Button variant="quiet" onClick={clearRecentPages}>
          Clear the list now
        </Button>
      )}
    </Card>
  );
}
