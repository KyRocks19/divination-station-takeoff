# Archive

Pieces of the app that are not in use but are kept so they can be revived.

## CrossroadsMap.tsx (archived 2026-10-12)

The illustrated "tower in an enchanted forest" map that was the centre of the home page: the Tower in three levels
(Lookout, Library, Sanctum) with the Seeing Pool, Spread Altar, Dream Cavern, and Village Square around it, each a link.

It was replaced on the home page by the world map of where each tool began (`components/world/WorldMap.tsx`), at the
user's request, with the wish to keep this one "so we can revive it later".

To bring it back:
1. Import it in `app/page.tsx`: `import CrossroadsMap from "@/components/archive/CrossroadsMap";`
2. Draw it under the "Wander the map" heading, for example `<CrossroadsMap size={460} />` (it can sit beside the world map).
3. Know its limits: it was built for tarot (the Seeing Pool is Readings and the Spread Altar is Spreads), its places are
   placed by hand, and its colours are fixed in the drawing, so it does not follow a person's colour theme. A tool added
   after it has no place on it.
