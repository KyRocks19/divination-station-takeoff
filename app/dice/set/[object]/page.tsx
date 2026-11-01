import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { query } from "@/lib/db";
import { faceId, facesOf, faceLabel, getObject, sideShape } from "@/lib/dice";
import { ownNames } from "@/lib/own-names";
import DieFace from "@/components/dice/DieFace";
import { BackLink, Page, PageTitle } from "@/components/ui/Page";

export default async function ObjectFacesPage({ params }: { params: Promise<{ object: string }> }) {
  const { object: objectParam } = await params;
  const session = await getSession();
  if (!session.userId) redirect("/login");

  const object = getObject(objectParam);
  if (!object) {
    return (
      <div className="max-w-page mx-auto px-4 py-8 space-y-3">
        <p className="text-ink-faint">Not found.</p>
        <BackLink href="/dice/set">
          ← What the faces mean to you
        </BackLink>
      </div>
    );
  }

  const prefix = object.id === "coin" ? "coin-%" : `die-${object.id}-%`;
  const written = await query<{ card_id: string }>(
    `SELECT card_id FROM card_customizations
     WHERE user_id = $1 AND card_id LIKE $2
       AND (COALESCE(TRIM(upright_keywords), '') <> '' OR COALESCE(TRIM(upright_description), '') <> '')`,
    [session.userId, prefix]
  );
  const hasWords = new Set(written.map((w) => w.card_id));
  const bone = object.id === "knucklebone";
  const names = bone ? await ownNames(session.userId) : {};

  return (
    <Page>
      <BackLink href="/dice/set">
        ← What the faces mean to you
      </BackLink>
      <PageTitle>{object.name}</PageTitle>
      <p className="text-sm text-ink-muted">
        You have written words for {hasWords.size} of {object.faces}. Open a face to write what it means to you.
      </p>
      <ul className="grid grid-cols-3 sm:grid-cols-5 gap-3 list-none p-0">
        {facesOf(object.id).map((f) => (
          <li key={f}>
            <Link
              href={`/dice/set/${object.id}/${f}`}
              className="flex flex-col items-center gap-1 bg-surface border border-line rounded-card p-3 hover:border-line-hover transition-colors"
            >
              <DieFace object={object.id} face={f} className="w-12 h-12 text-tone-200" />
              <span className="sr-only">{faceLabel(f)}</span>
              {bone && (
                <span className="text-[11px] text-ink-muted text-center break-words">
                  {sideShape(f)}
                  {names[faceId(object.id, f)] && <span className="block text-tone-200">{names[faceId(object.id, f)]}</span>}
                </span>
              )}
              <span className="text-[10px] text-tone-500 h-3">{hasWords.has(faceId(object.id, f)) ? "Your words" : ""}</span>
            </Link>
          </li>
        ))}
      </ul>
    </Page>
  );
}

export const metadata = { title: "Dice meanings" };
