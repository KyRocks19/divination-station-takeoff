"use client";

import { styleRef } from "@/lib/apply-style";

interface SigilDisplayProps {
  sigilData: string | null;
  /** Display size in px. Default 48 */
  size?: number;
  /** Optional label shown on hover */
  label?: string;
  className?: string;
}

/**
 * Renders a saved sigil as a small sealed image.
 * Pass sigilData=null to render nothing.
 */
export default function SigilDisplay({ sigilData, size = 48, label, className = "" }: SigilDisplayProps) {
  if (!sigilData) return null;

  return (
    <div
      className={`inline-flex flex-col items-center gap-1 opacity-60 hover:opacity-90 transition-opacity ${className}`}
      title={label ?? "Signature Sigil"}
    >
      <div
        className="rounded-full border border-line overflow-hidden [background:radial-gradient(ellipse_at_center,#1a0a2e_0%,#0d0d1a_100%)]"
        ref={styleRef({ width: size, height: size })}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={sigilData}
          alt={label ?? "Signature Sigil"}
          width={size}
          height={size}
          className="block"
          ref={styleRef({ width: size, height: size })}
          draggable={false}
        />
      </div>
      {label && <span className="text-[10px] text-tone-600 tracking-widest uppercase">{label}</span>}
    </div>
  );
}
