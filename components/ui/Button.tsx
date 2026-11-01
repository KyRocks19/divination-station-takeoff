import Link from "next/link";
import { cx } from "@/lib/cx";

/**
 * The kinds of button the app uses (docs/design-system.md):
 * - primary: the one main action of a form ("Save", "Throw some dice"), in pastel pink with dark text
 * - purple: the earlier purple main button, kept so the two can be compared
 * - quiet: a plain secondary action beside it ("Cancel")
 * - text: a small action inside content ("Edit", "Your words")
 * - danger: a small, low-key delete action; its confirmation is written next to it, not in a pop-up
 */
export type ButtonVariant = "primary" | "purple" | "quiet" | "text" | "danger";

export const buttonClass: Record<ButtonVariant, string> = {
  primary:
    "bg-blush hover:bg-blush-soft disabled:opacity-40 text-canvas text-sm font-medium px-4 py-2 min-h-11 sm:min-h-0 rounded-control transition-colors",
  purple:
    "bg-accent hover:bg-accent-hover disabled:opacity-40 text-white text-sm font-medium px-4 py-2 min-h-11 sm:min-h-0 rounded-control transition-colors",
  quiet: "text-sm text-ink-faint hover:text-ink-soft px-3 py-2 min-h-11 sm:min-h-0 rounded-control transition-colors",
  text: "max-sm:inline-flex max-sm:items-center max-sm:min-h-11 text-xs text-accent-ink hover:text-accent-ink-hover disabled:opacity-40 transition-colors",
  danger: "max-sm:inline-flex max-sm:items-center max-sm:min-h-11 text-xs text-ink-ghost hover:text-danger-ink disabled:opacity-40 transition-colors",
};

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
}

/** A button. It is type="button" unless told otherwise, so one inside a form never submits it by accident. */
export function Button({ variant = "primary", type = "button", className, ...rest }: ButtonProps) {
  return <button type={type} className={cx(buttonClass[variant], className)} {...rest} />;
}

interface ButtonLinkProps extends React.ComponentProps<typeof Link> {
  variant?: ButtonVariant;
}

/** A link that looks like a button of the same variants. */
export function ButtonLink({ variant = "text", className, ...rest }: ButtonLinkProps) {
  return <Link className={cx(buttonClass[variant], "max-sm:inline-flex max-sm:items-center", className)} {...rest} />;
}
