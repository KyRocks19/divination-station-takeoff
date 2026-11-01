import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { MAX_GALLERY_ITEMS } from "@/lib/oracle-art";
import { artDir, diskRequiredButMissing } from "@/lib/art-store";
import { listGallery } from "@/lib/oracle-gallery";
import GalleryView from "@/components/oracle/GalleryView";
import { BackLink, Page, PageTitle } from "@/components/ui/Page";

export default async function GalleryPage() {
  const session = await getSession();
  if (!session.userId) redirect("/login");

  const items = await listGallery(session.userId);
  // Dates become text here, so the client component starts with the same shape the API returns.
  const initial = JSON.parse(JSON.stringify(items));

  return (
    <Page>
      <BackLink href="/oracle">← Oracle deck</BackLink>
      <PageTitle>Gallery</PageTitle>
      <p className="text-sm text-ink-muted">
        Pictures you keep here are yours alone and are not on any item until you choose them. Open an item&rsquo;s page and press
        &ldquo;Choose from your gallery&rdquo; to put one on it. You can hold up to {MAX_GALLERY_ITEMS}.
      </p>
      <p className="text-xs text-ink-faint">
        {artDir()
          ? "New pictures are saved as files on the computer that runs this app, not in the online database. They show only while that computer is on."
          : diskRequiredButMissing()
            ? "Pictures are stored on the owner's computer. They show only while that computer is on, and new ones can only be added from it."
            : "Pictures are saved in the app's database."}
      </p>
      <GalleryView initialItems={initial} max={MAX_GALLERY_ITEMS} onDisk={artDir() !== null} />
    </Page>
  );
}

export const metadata = { title: "Picture gallery" };
