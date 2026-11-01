// How many people a circle holds on this copy of the app. A hosted circle holds 30; a leader's own copy that serves a circle (DS_MODE=host,
// docs/plan-host-mode.md) holds 10 unless its host sets DS_HOST_CIRCLE_MAX (up to 30), because one computer makes the pictures and one database session serves everyone. Read when called, on the
// server. The browser never calls this: the Circle page is told the number in its data (`max_members`, lib/circles-core.ts). No database code.

import { MAX_CIRCLE_MEMBERS } from "./circles-core";
import { hostCircleMembers, isHostMode } from "./edition";

export function maxCircleMembers(host: boolean = isHostMode()): number {
  return host ? hostCircleMembers() : MAX_CIRCLE_MEMBERS;
}
