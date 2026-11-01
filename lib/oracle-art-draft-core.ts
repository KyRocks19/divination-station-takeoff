import { cleanBatch, MAX_SCENE_LENGTH, MAX_STYLE_LENGTH } from "./art-maker";
import { MAX_ALT_LENGTH } from "./oracle-art";
import { MAX_ART_STYLE_NAME } from "./art-styles-core";

export interface OracleArtMakerDraft {
  selected?: string[];
  scene?: string;
  sceneEdited?: boolean;
  style?: string;
  styleName?: string;
  useComposition?: boolean;
  count?: number;
  alt?: string;
  altEdited?: boolean;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function parseOracleArtMakerDraft(value: unknown, sourceIds: readonly string[]): OracleArtMakerDraft | null {
  if (!isRecord(value) || value.version !== 1) return null;
  const sourceIdSet = new Set(sourceIds);
  const draft: OracleArtMakerDraft = {};

  if (Array.isArray(value.selected)) {
    draft.selected = value.selected.filter((id): id is string => typeof id === "string" && sourceIdSet.has(id));
  }
  if (typeof value.scene === "string") draft.scene = value.scene.slice(0, MAX_SCENE_LENGTH);
  if (typeof value.sceneEdited === "boolean") draft.sceneEdited = value.sceneEdited;
  if (typeof value.style === "string") draft.style = value.style.slice(0, MAX_STYLE_LENGTH);
  if (typeof value.styleName === "string") draft.styleName = value.styleName.slice(0, MAX_ART_STYLE_NAME);
  if (typeof value.useComposition === "boolean") draft.useComposition = value.useComposition;
  if (typeof value.count === "number" && Number.isFinite(value.count)) draft.count = cleanBatch(value.count);
  if (typeof value.alt === "string") draft.alt = value.alt.slice(0, MAX_ALT_LENGTH);
  if (typeof value.altEdited === "boolean") draft.altEdited = value.altEdited;

  return draft;
}
