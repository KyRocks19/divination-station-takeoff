import Link from "next/link";
import { cx } from "@/lib/cx";

/** The width, side space, and vertical rhythm of a page's content. */
export function Page({ className, ...rest }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cx("max-w-page mx-auto px-4 pt-8 pb-16 space-y-6", className)} {...rest} />;
}

/** The title of a page. */
export function PageTitle({ className, ...rest }: React.HTMLAttributes<HTMLHeadingElement>) {
  return <h1 className={cx("text-2xl font-bold text-heading break-words", className)} {...rest} />;
}

/** A small capital heading above a section of a page. Give it an id and point the section's aria-labelledby at it. */
export function SectionLabel({ className, ...rest }: React.ComponentProps<"h2">) {
  return <h2 className={cx("text-xs text-ink-faint uppercase tracking-widest", className)} {...rest} />;
}

export interface JumpItem {
  /** The id of the section to jump to (set on the section itself). */
  id: string;
  label: string;
}

/**
 * "Jump to" links for a long page: each goes to a section on the same page, so someone using the keyboard does not have to
 * Tab through every card on the way. The next Tab after a jump starts from that section. Give each section the id.
 */
export function JumpLinks({ items, className }: { items: JumpItem[]; className?: string }) {
  return (
    <nav aria-label="On this page" className={cx("flex flex-wrap items-center gap-x-3 gap-y-1", className)}>
      <span className="text-xs text-ink-faint">Jump to</span>
      <ul className="flex flex-wrap gap-2 list-none p-0">
        {items.map((it) => (
          <li key={it.id}>
            <a
              href={`#${it.id}`}
              className="inline-flex items-center min-h-11 sm:min-h-0 rounded-full border border-line-strong px-3 py-1 text-xs text-ink-muted hover:border-line-hover hover:text-ink-strong transition-colors"
            >
              {it.label}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}

/** The small "← Where you came from" link at the top of a page. */
export function BackLink({ className, ...rest }: React.ComponentProps<typeof Link>) {
  return <Link className={cx("inline-flex items-center min-h-11 sm:min-h-0 text-xs text-ink-ghost hover:text-accent-ink transition-colors", className)} {...rest} />;
}

/** A message about what went wrong, announced to screen readers. */
export function ErrorNote({ className, ...rest }: React.HTMLAttributes<HTMLParagraphElement>) {
  return <p role="alert" className={cx("text-xs text-danger", className)} {...rest} />;
}
