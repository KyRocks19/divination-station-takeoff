import { queryOne } from "./db";
import { configuredFamilyCircleId, familyGateRequired } from "./family-access-core";

/** Whether a user may use this hosted copy; local editions do not use the hosted circle gate. */
export async function familyUserAllowed(userId: number): Promise<boolean> {
  if (!familyGateRequired()) return true;
  const circleId = configuredFamilyCircleId();
  if (circleId === null) return false;
  const member = await queryOne(
    "SELECT 1 FROM circle_members WHERE circle_id = $1 AND user_id = $2",
    [circleId, userId]
  );
  return !!member;
}
