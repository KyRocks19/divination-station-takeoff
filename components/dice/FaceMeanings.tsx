"use client";

import MeaningsPanel from "@/components/MeaningsPanel";
import CommonMeaningBlock from "@/components/CommonMeaningBlock";
import { COIN_MEANINGS, COMMON_SOURCES, numberMeaning } from "@/lib/common-meanings-data";
import { getFace, getObject, isNumbered } from "@/lib/dice-data";

interface Props {
  faceId: string;
}

/**
 * What a face means to the person: their own words first, with every earlier version. The common meaning is
 * stock text behind a button; dice have no single tradition, so it says where the words come from.
 */
export default function FaceMeanings({ faceId }: Props) {
  const face = getFace(faceId);
  if (!face) return null;
  const coin = COIN_MEANINGS[faceId];
  const die = !isNumbered(face.object) ? null : numberMeaning(Number(face.face), getObject(face.object)?.faces ?? 6);
  return (
    <MeaningsPanel
      cardId={faceId}
      orientation="upright"
      api={`/api/dice/meanings/${encodeURIComponent(faceId)}`}
      stockLabel="Common Meanings"
      stockSection={
        coin ? (
          <CommonMeaningBlock meaning={coin} source={COMMON_SOURCES.coin} symbolId={faceId} />
        ) : die ? (
          <CommonMeaningBlock
            meaning={die}
            source={COMMON_SOURCES.number}
            note={[die.place, die.reduction].filter(Boolean).join(" ")}
            symbolId={faceId}
          />
        ) : null
      }
      // A knucklebone side has no stock text, so there is no button that would open nothing.
      hideStock={!coin && !die}
      noun="face"
    />
  );
}
