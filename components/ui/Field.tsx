import { cloneElement, isValidElement } from "react";
import { cx } from "@/lib/cx";

/** The look shared by every text box, text area, and choice list. */
export const fieldClass =
  "bg-field border border-line-strong rounded-control px-3 py-2 min-h-11 sm:min-h-0 text-sm text-ink-strong placeholder-ink-ghost focus:outline-none focus:border-focus";

/** The same look, filling the width of its row. */
export const fieldFullClass = `w-full ${fieldClass}`;

/** The same look in smaller type, for boxes inside a panel that uses small text. */
export const fieldSmallClass = `w-full ${fieldClass.replace("text-sm", "text-xs")}`;

type InputProps = React.InputHTMLAttributes<HTMLInputElement> & { wide?: boolean };

/** A single-line box. It fills the row unless `wide={false}` (a short number box, for example). */
export function Input({ wide = true, className, ...rest }: InputProps) {
  return <input className={cx(fieldClass, wide && "w-full", className)} {...rest} />;
}

/** A multi-line box that the person can make taller. */
export function Textarea({ className, ...rest }: React.ComponentProps<"textarea">) {
  return <textarea className={cx(fieldClass, "w-full resize-y leading-relaxed", className)} {...rest} />;
}

/** A choice list. */
export function Select({ className, ...rest }: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return <select className={cx(fieldClass, "w-full", className)} {...rest} />;
}

interface FieldProps {
  /** The id of the control inside, so the label is tied to it. */
  htmlFor: string;
  label: string;
  /** A line of help under the control. */
  hint?: string;
  /** A message under the control when its value is not allowed. */
  error?: string | null;
  children: React.ReactNode;
}

/**
 * A label, a control, and optional help or an error, spaced the same way everywhere. The help and the error are tied to
 * the control (`aria-describedby`, and `aria-invalid` for an error) so a screen reader reads them with it, and an error
 * is announced when it appears. The control must be a single element that takes `id`, such as `Input`.
 */
export function Field({ htmlFor, label, hint, error, children }: FieldProps) {
  const hintId = `${htmlFor}-hint`;
  const errorId = `${htmlFor}-error`;
  const describedBy = error ? errorId : hint ? hintId : undefined;
  const control =
    describedBy && isValidElement<Record<string, unknown>>(children)
      ? cloneElement(children, {
          "aria-describedby": [children.props["aria-describedby"], describedBy].filter(Boolean).join(" "),
          ...(error ? { "aria-invalid": true } : {}),
        })
      : children;
  return (
    <div>
      <label htmlFor={htmlFor} className="block text-xs text-ink-faint mb-1">{label}</label>
      {control}
      {hint && !error && <p id={hintId} className="text-xs text-ink-ghost mt-1">{hint}</p>}
      {error && <p id={errorId} role="alert" className="text-xs text-danger mt-1">{error}</p>}
    </div>
  );
}
