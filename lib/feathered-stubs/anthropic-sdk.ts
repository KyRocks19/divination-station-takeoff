// What `@anthropic-ai/sdk` becomes in the Feathered build (next.config.ts, docs/plan-feathered-edition.md): the real package is left out of that build,
// so the code that talks to Anthropic is not in the download at all. Nothing in Feathered reaches this (its AI routes answer "not found" first); if
// something ever did, it would stop here instead of connecting anywhere.

export default class Anthropic {
  constructor() {
    throw new Error("The Feathered edition has no AI features.");
  }
}
