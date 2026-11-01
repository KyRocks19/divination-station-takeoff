import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { getPrefs } from "@/lib/prefs";
import { Page, PageTitle, SectionLabel, BackLink, ErrorNote, JumpLinks } from "@/components/ui/Page";
import { Button, ButtonLink } from "@/components/ui/Button";
import { Card, CardLink } from "@/components/ui/Card";
import { Field, Input, Select, Textarea } from "@/components/ui/Field";
import ThemeLab from "@/components/design/ThemeLab";

const SWATCHES: { token: string; className: string; note: string }[] = [
  { token: "canvas", className: "bg-canvas", note: "the page background" },
  { token: "surface", className: "bg-surface", note: "cards and panels" },
  { token: "surface-sunken", className: "bg-surface-sunken", note: "a panel inside a panel" },
  { token: "field", className: "bg-field", note: "the inside of an input" },
  { token: "bar", className: "bg-bar", note: "the side navigation and the phone bar" },
  { token: "accent", className: "bg-accent", note: "the purple button" },
  { token: "accent-hover", className: "bg-accent-hover", note: "the purple button under the pointer" },
  { token: "blush", className: "bg-blush", note: "light pink: main button, border base" },
  { token: "blush-soft", className: "bg-blush-soft", note: "medium pink: button under the pointer" },
  { token: "blush-deep", className: "bg-blush-deep", note: "vivid pink: borders under the pointer" },
  { token: "focus", className: "bg-focus", note: "border of a box being typed in" },
];

const TEXT: { token: string; className: string }[] = [
  { token: "heading", className: "text-heading" },
  { token: "ink", className: "text-ink" },
  { token: "ink-strong", className: "text-ink-strong" },
  { token: "ink-muted", className: "text-ink-muted" },
  { token: "ink-faint", className: "text-ink-faint" },
  { token: "ink-ghost", className: "text-ink-ghost" },
  { token: "accent-ink", className: "text-accent-ink" },
  { token: "blush", className: "text-blush" },
  { token: "blush-soft", className: "text-blush-soft" },
  { token: "danger", className: "text-danger" },
];

/**
 * "Your colours": the colour lab, open to everyone signed in, saved with the person's profile. Below it, for the
 * curious, every token and shared piece of the design system the screens are built from.
 */
export default async function DesignPage() {
  const session = await getSession();
  if (!session.userId) redirect("/login");
  const prefs = await getPrefs(session.userId);

  return (
    <Page>
      <BackLink href="/settings">← Settings</BackLink>
      <PageTitle>Colours</PageTitle>

      <JumpLinks
        items={[
          { id: "d-lab", label: "Choose your colours" },
          { id: "d-built", label: "How the app is built" },
          { id: "d-colours", label: "Colour list" },
          { id: "d-buttons", label: "Buttons" },
          { id: "d-fields", label: "Fields" },
          { id: "d-cards", label: "Cards" },
        ]}
      />

      <div id="d-lab">
        <ThemeLab initial={prefs.theme} />
      </div>

      <div id="d-built" className="border-t border-line-faint pt-6 space-y-2">
        <h2 className="text-lg font-semibold text-heading">How the app is built</h2>
        <p className="text-sm text-ink-muted leading-relaxed">
          For the curious: every colour, shape, and shared piece the screens are made from, shown in your colours. The guide
          is docs/design-system.md.
        </p>
      </div>

      <section aria-labelledby="d-colours" className="space-y-3">
        <SectionLabel id="d-colours">Colours</SectionLabel>
        <ul className="grid grid-cols-2 sm:grid-cols-3 gap-3 list-none p-0">
          {SWATCHES.map((s) => (
            <li key={s.token} className="space-y-1">
              <div className={`${s.className} h-12 rounded-control border border-line-strong`} />
              <p className="text-xs text-ink-strong">{s.token}</p>
              <p className="text-[11px] text-ink-ghost">{s.note}</p>
            </li>
          ))}
        </ul>
        <ul className="space-y-1 list-none p-0">
          {TEXT.map((t) => (
            <li key={t.token} className={`${t.className} text-sm`}>text-{t.token}: The quick brown fox</li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="d-buttons" className="space-y-3">
        <SectionLabel id="d-buttons">Buttons</SectionLabel>
        <div className="flex flex-wrap items-center gap-4">
          <Button variant="primary">Primary (pink)</Button>
          <Button variant="primary" disabled>Primary, disabled</Button>
          <Button variant="purple">Purple (the earlier main button)</Button>
          <Button variant="quiet">Quiet</Button>
          <Button variant="text">Text action</Button>
          <Button variant="danger">Danger action</Button>
          <ButtonLink href="/design" variant="primary">A link as a button</ButtonLink>
          <ButtonLink href="/design">A link as a text action</ButtonLink>
        </div>
      </section>

      <section aria-labelledby="d-fields" className="space-y-3">
        <SectionLabel id="d-fields">Fields</SectionLabel>
        <Card className="space-y-4">
          <Field htmlFor="d-name" label="A text box" hint="Help sits under the box.">
            <Input id="d-name" placeholder="Placeholder text" />
          </Field>
          <Field htmlFor="d-area" label="A text area">
            <Textarea id="d-area" rows={2} />
          </Field>
          <Field htmlFor="d-select" label="A choice list">
            <Select id="d-select" defaultValue="b">
              <option value="a">First</option>
              <option value="b">Second</option>
            </Select>
          </Field>
          <Field htmlFor="d-count" label="A short number box" error="An error sits under the box.">
            <Input id="d-count" type="number" wide={false} className="w-24" defaultValue={0} aria-invalid />
          </Field>
          <ErrorNote>A message about what went wrong.</ErrorNote>
        </Card>
      </section>

      <section aria-labelledby="d-cards" className="space-y-3">
        <SectionLabel id="d-cards">Cards</SectionLabel>
        <Card>A panel (medium inner space).</Card>
        <Card pad="sm">A row in a list (small inner space).</Card>
        <CardLink href="/design">A card that is one link; its border lights up under the pointer.</CardLink>
        <Card className="border-line-accent space-y-1">
          <p className="text-sm text-blush">A highlighted panel: the accent border and a pink title.</p>
          <p className="text-xs text-ink-muted">Pink beside purple, to see how they sit together.</p>
        </Card>
      </section>
    </Page>
  );
}

export const metadata = { title: "Colours" };
