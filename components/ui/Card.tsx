import Link from "next/link";
import { cx } from "@/lib/cx";

const base = "bg-surface border border-line rounded-card";

/** The class string of a card row that lifts under the pointer, for a list item that holds the link. */
export const cardLiftClass = `block ${base} hover:border-line-hover transition-colors card-hover`;
const padding = { none: "", sm: "p-4", md: "p-5" } as const;

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  /** The inner space: sm for a row in a list, md for a panel. */
  pad?: keyof typeof padding;
}

/** A panel on the surface colour. To make a list row, put a Card inside the list item. */
export function Card({ pad = "md", className, ...rest }: CardProps) {
  return <div className={cx(base, padding[pad], className)} {...rest} />;
}

type CardLinkProps = React.ComponentProps<typeof Link> & { pad?: keyof typeof padding; lift?: boolean };

/** A card that is one link, with its border lighting up under the pointer. `lift` also raises it a little. */
export function CardLink({ pad = "sm", lift = false, className, ...rest }: CardLinkProps) {
  return <Link className={cx(base, "block hover:border-line-hover transition-colors", lift && "card-hover", padding[pad], className)} {...rest} />;
}
