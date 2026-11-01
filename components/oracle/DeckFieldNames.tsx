"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import FieldNamesPanel from "@/components/oracle/FieldNamesPanel";
import type { OracleFieldName } from "@/lib/oracle";

interface Props {
  initialNames: OracleFieldName[];
  /** What one item of this set is called: card, stone, stave, charm. */
  thing: string;
}

/** On a set's page: the field names the person has used on any of their items, to rename or remove for every item at once. */
export default function DeckFieldNames({ initialNames, thing }: Props) {
  const router = useRouter();
  const [names, setNames] = useState(initialNames);
  const [loaded, setLoaded] = useState(initialNames);

  // The page sent a fresh list (after router.refresh): start from it, keeping the section open.
  if (loaded !== initialNames) {
    setLoaded(initialNames);
    setNames(initialNames);
  }

  async function refresh(): Promise<OracleFieldName[] | null> {
    try {
      const res = await fetch("/api/oracle/fields");
      if (!res.ok) return null;
      const list: OracleFieldName[] = await res.json();
      setNames(list);
      return list;
    } catch {
      return null;
    }
  }

  if (names.length === 0) return null;

  return (
    <details className="border-t border-line-faint pt-4">
      <summary className="text-sm text-ink-faint hover:text-ink-soft cursor-pointer transition-colors">
        Field names ({names.length})
      </summary>
      <div className="mt-4 max-w-xl space-y-3">
        <p className="text-xs text-ink-ghost leading-relaxed">
          The names you gave to your own fields, across all your sets. Renaming one changes it on every {thing} that holds it, and
          keeps what you wrote. Removing one takes it off every {thing}, with what you wrote in it.
        </p>
        <FieldNamesPanel
          names={names}
          refresh={refresh}
          onRemoved={() => router.refresh()}
          onRenamed={() => router.refresh()}
          thing={thing}
        />
      </div>
    </details>
  );
}
