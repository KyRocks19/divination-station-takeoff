"use client";

import { createElement, type ReactNode } from "react";
import { styleRef, type StyleMap } from "@/lib/apply-style";

interface StyledProps {
  /** The element to make: "div" by default; "span", "li", "g", "circle" and so on work too. */
  as?: string;
  /** Styles that depend on the person's data (a colour they chose, a share of a total). Put anything fixed in `className`. */
  css: StyleMap;
  className?: string;
  children?: ReactNode;
  [attribute: string]: unknown;
}

/**
 * An element with styles that are worked out at run time, for a page whose policy refuses inline `style` attributes (docs/design-system.md,
 * "No inline styles"). It works inside server components, because the styles are put on by the browser (lib/apply-style.ts).
 */
export default function Styled({ as = "div", css, ...rest }: StyledProps) {
  return createElement(as, { ...rest, ref: styleRef(css) });
}
