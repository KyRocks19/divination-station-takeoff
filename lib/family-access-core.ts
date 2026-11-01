import { editionOf } from "./edition";

export interface FamilyAccessConfig {
  edition?: string;
  nodeEnv?: string;
  familyCircleId?: string;
  localDataDir?: string;
}

export function configuredFamilyCircleId(value = process.env.DS_FAMILY_CIRCLE_ID): number | null {
  const raw = value?.trim();
  if (!raw || !/^[1-9]\d*$/.test(raw)) return null;
  const id = Number(raw);
  return Number.isSafeInteger(id) ? id : null;
}

export function familyGateRequired(config: FamilyAccessConfig = {}): boolean {
  const edition = config.edition ?? process.env.DS_EDITION;
  const nodeEnv = config.nodeEnv ?? process.env.NODE_ENV;
  const familyCircleId = config.familyCircleId ?? process.env.DS_FAMILY_CIRCLE_ID;
  const localDataDir = config.localDataDir ?? process.env.DS_DB_DIR;
  if (editionOf(edition) === "local") return !localDataDir?.trim();
  return nodeEnv === "production" || Boolean(familyCircleId?.trim());
}

export function familyCircleAllowed(
  circleId: number | null | undefined,
  config: FamilyAccessConfig = {}
): boolean {
  if (!familyGateRequired(config)) return true;
  const allowedId = configuredFamilyCircleId(config.familyCircleId);
  return allowedId !== null && circleId === allowedId;
}
