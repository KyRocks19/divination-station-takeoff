// The version a person sees on the About page, from package.json, so it matches VERSION.txt in every download
// (scripts/build-local-package.ts) and the version on the download page (UPGRADING.md, "Which version you have").
import pkg from "../package.json";

export const APP_VERSION: string = pkg.version;

// Where the source code is published (AGPL-3.0-only, section 13: people who use the app over a network are offered the source).
export const SOURCE_URL = "https://github.com/KyRocks19/divination-station-takeoff";
