"use client";

import { useState } from "react";
import { boardFor, isRound } from "@/lib/oracle-art";
import FormShape from "@/components/oracle/FormShape";
import { styleRef } from "@/lib/apply-style";

/**
 * The picture of one item of a personal set, at the shape of its form (a tall card, a round stone, a narrow stave, a
 * round charm). With no picture it shows the form's outline instead. `alt` is the person's own description; without
 * one the picture is treated as decoration, because the item's name is always written beside it.
 */
export default function ItemArt({
  cardId,
  version,
  alt,
  form,
  height = 64,
  className = "",
}: {
  cardId: number | null;
  /** The picture's version (changes when the picture does); null or undefined means there is no picture. */
  version: string | null | undefined;
  alt?: string | null;
  form: string | null | undefined;
  /** The height in pixels; the width follows the shape of the form. */
  height?: number;
  className?: string;
}) {
  // A picture kept as a file on the owner's computer cannot be loaded when that computer is off; its outline is shown instead.
  const [failedFor, setFailedFor] = useState<string | null>(null);
  if (!cardId || !version) return <FormShape form={form} height={height} className={`text-tone-500 ${className}`} />;
  if (failedFor === version) {
    return (
      <span title="This picture is stored on the owner's computer, which is not reachable right now." className="inline-flex">
        <FormShape form={form} height={height} className={`text-tone-500 opacity-60 ${className}`} />
      </span>
    );
  }
  const { w, h } = boardFor(form);
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={`/api/oracle/cards/${cardId}/art?v=${version}${height <= 200 ? "&s=thumb" : ""}`}
      alt={alt ?? ""}
      height={height}
      width={Math.round((height * w) / h)}
      loading="lazy"
      onError={() => setFailedFor(version)}
      className={`shrink-0 object-cover border border-line-strong ${isRound(form) ? "rounded-full" : "rounded-md"} ${className}`}
      ref={styleRef({ height, width: Math.round((height * w) / h) })}
    />
  );
}
