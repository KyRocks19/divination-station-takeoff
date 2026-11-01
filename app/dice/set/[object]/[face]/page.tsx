import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { faceId, faceLabel, facesOf, getObject, sideShape } from "@/lib/dice";
import { ownNames } from "@/lib/own-names";
import DieFace from "@/components/dice/DieFace";
import OwnSideName from "@/components/dice/OwnSideName";
import FaceMeanings from "@/components/dice/FaceMeanings";
import PieceHistory from "@/components/PieceHistory";
import { BackLink, Page } from "@/components/ui/Page";

export default async function FacePage({ params }: { params: Promise<{ object: string; face: string }> }) {
  const { object: objectParam, face } = await params;
  const session = await getSession();
  if (!session.userId) redirect("/login");

  const object = getObject(objectParam);
  if (!object || !facesOf(object.id).includes(face)) {
    return (
      <div className="max-w-page mx-auto px-4 py-8 space-y-3">
        <p className="text-ink-faint">Not found.</p>
        <BackLink href="/dice/set">
          ← What the faces mean to you
        </BackLink>
      </div>
    );
  }

  const bone = object.id === "knucklebone";
  const ownName = bone ? ((await ownNames(session.userId, [faceId(object.id, face)]))[faceId(object.id, face)] ?? null) : null;

  return (
    <Page>
      <BackLink href={`/dice/set/${object.id}`}>
        ← {object.name}
      </BackLink>

      <header className="flex items-center gap-5">
        <DieFace object={object.id} face={face} className="w-20 h-20 flex-shrink-0 text-tone-200" />
        <div className="min-w-0">
          <h1 className="text-3xl font-bold text-tone-100 break-words">{object.name}</h1>
          {bone && (
            <p className="text-sm text-ink-muted break-words mt-1">
              {faceLabel(face)}: {sideShape(face)}
              {ownName && <> · <span className="text-tone-200">{ownName}</span></>}
            </p>
          )}
        </div>
      </header>

      {bone && <OwnSideName pieceId={faceId(object.id, face)} initialName={ownName} label={faceLabel(face)} />}

      <FaceMeanings faceId={faceId(object.id, face)} />

      <PieceHistory userId={session.userId} kind="dice" pieceKey={`${object.id}:${face}`} noun={object.id === "coin" ? "side" : "face"} readingWord="throw" />

      <div className="flex flex-wrap gap-x-5 gap-y-2">
        <Link href="/dice/new" className="text-xs text-accent-ink hover:text-accent-ink-hover transition-colors">Throw some dice</Link>
        <Link href="/dice" className="text-xs text-accent-ink hover:text-accent-ink-hover transition-colors">Past throws</Link>
      </div>
    </Page>
  );
}

export const metadata = { title: "What a face means" };
