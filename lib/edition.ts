// Which edition of the app this copy is (docs/plan-editions.md). One codebase, one flag: DS_EDITION=local for the copy a person runs
// on their own computer, anything else (or nothing) for the hosted copy. Nothing here reads a database, so the browser and the tests can use it.
//
// A local copy has one more setting, DS_MODE=host (docs/plan-host-mode.md): the same copy also serves the friends of the person who runs it,
// who reach it over Tailscale, so it keeps the circle, forum and invite pages that a copy for one person leaves out. DS_MODE means nothing
// on a hosted copy, which already has them.
//
// The Feathered edition (docs/plan-feathered-edition.md) is a separate build of the local edition: no AI and no outgoing connections. It is chosen
// when the app is built, with NEXT_PUBLIC_FEATHERED=1, because the AI code is left out of that build; the browser and the server read the same value.
// Winged is the owner's name for the full local edition (host mode is one of its settings).

export type Edition = "hosted" | "local";

/**
 * What the navigation, the search and the home page ask: a hosted copy, a local copy for one person ("local"), a local copy that serves a circle ("host"),
 * or the Feathered edition ("feathered": one person, no AI, no outgoing connections).
 */
export type Shape = Edition | "host" | "feathered";

/** True in the Feathered build. Written out in full so Next.js puts the value into the browser's code too. */
export const FEATHERED = process.env.NEXT_PUBLIC_FEATHERED === "1";

/** Whether a value of NEXT_PUBLIC_FEATHERED means the Feathered build. For the tests; the app uses FEATHERED. */
export const featheredFrom = (value: string | undefined): boolean => value?.trim() === "1";

/** The most people in a circle that a leader's own copy serves by default (docs/plan-host-mode.md); a hosted circle holds more (lib/circles-core.ts). */
export const HOST_CIRCLE_MEMBERS = 10;
/** The most a host may set with DS_HOST_CIRCLE_MAX: the same as a hosted circle (MAX_CIRCLE_MEMBERS, pinned equal by tests/host-mode.test.ts). */
export const HOST_CIRCLE_MEMBERS_LIMIT = 30;

/**
 * How many people a leader's copy lets into its circle: DS_HOST_CIRCLE_MAX when it is a whole number from 2 to 30, otherwise 10. A free Tailscale plan
 * limits how many people can be reached; a host on Headscale, or on a paid plan, may raise it (docs/host-guide.md). One database session and one
 * picture computer serve everyone, so more people means more waiting.
 */
export function hostCircleMembers(value: string | undefined = process.env.DS_HOST_CIRCLE_MAX): number {
  const n = Number(value?.trim());
  return value?.trim() && Number.isInteger(n) && n >= 2 && n <= HOST_CIRCLE_MEMBERS_LIMIT ? n : HOST_CIRCLE_MEMBERS;
}

export function editionOf(value: string | undefined = process.env.DS_EDITION, feathered = FEATHERED): Edition {
  // A Feathered build is always a copy on one person's computer, whatever DS_EDITION says.
  return feathered || value?.trim().toLowerCase() === "local" ? "local" : "hosted";
}

export const isLocalEdition = (value?: string): boolean => editionOf(value) === "local";

/** True for a local copy started in host mode. Anything else, and every hosted copy, is false. */
export function isHostMode(mode: string | undefined = process.env.DS_MODE, edition: string | undefined = process.env.DS_EDITION, feathered = FEATHERED): boolean {
  // Feathered serves one person only (owner, 2026-10-22), so DS_MODE=host means nothing there.
  return !feathered && editionOf(edition) === "local" && mode?.trim().toLowerCase() === "host";
}

export function shapeOf(edition: string | undefined = process.env.DS_EDITION, mode: string | undefined = process.env.DS_MODE, feathered = FEATHERED): Shape {
  if (feathered) return "feathered";
  if (editionOf(edition, false) !== "local") return "hosted";
  return isHostMode(mode, edition, false) ? "host" : "local";
}

/** The name a person sees for this copy (About page): Feathered, Winged for any other copy on a person's own computer, nothing for the hosted site. */
export function editionName(shape: Shape = shapeOf()): string | null {
  return shape === "feathered" ? "Feathered" : shape === "hosted" ? null : "Winged";
}
