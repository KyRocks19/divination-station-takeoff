// The words of the picture studio's test (`--check`, scripts/image-worker.ts and lib/studio-check.ts). Pure: no network, no files, so the tests
// can run it. Each line says what was tried, whether it worked, and what to do when it did not, in plain words for someone who runs a computer for
// their circle and has never read the app's code.

import { TOKEN_PATTERN, cleanAppUrl } from "./worker-protocol";
import { describeSettings, readImageToolSettings, type ImageToolKind } from "./image-tool-settings";

export interface CheckLine {
  ok: boolean;
  /** What was tried, a few words. */
  name: string;
  /** What happened. */
  said: string;
  /** What to do next, when it did not work. */
  fix?: string;
}

/** The settings, before anything is tried over the network. `env` is the settings the studio will use (the environment or its .env.local). */
export function settingsLines(env: Record<string, string | undefined>): CheckLine[] {
  const lines: CheckLine[] = [];
  const app = cleanAppUrl(env.APP_URL);
  lines.push(
    app.ok
      ? { ok: true, name: "Website address (APP_URL)", said: app.url }
      : { ok: false, name: "Website address (APP_URL)", said: app.error, fix: "Open the file .env.local in this folder and set APP_URL to the website's address, for example APP_URL=https://the-websites-address" }
  );
  const token = env.WORKER_TOKEN?.trim() ?? "";
  lines.push(
    TOKEN_PATTERN.test(token)
      ? { ok: true, name: "Token (WORKER_TOKEN)", said: "It looks complete (the token itself is not shown)." }
      : {
          ok: false,
          name: "Token (WORKER_TOKEN)",
          said: token ? "It is not a whole token. A token starts with dsw_ and is 47 characters long." : "There is no token.",
          fix: "Make a token on the website (on the Circle page, under your picture computer), copy all of it, and paste it after WORKER_TOKEN= in .env.local.",
        }
  );
  const hasTool = !!env.IMAGE_GEN_URL?.trim();
  const hasCompanion = !!env.COMPANION_URL?.trim();
  lines.push(
    hasTool || hasCompanion
      ? { ok: true, name: "What this computer does", said: [hasTool ? `makes pictures with the image program at ${env.IMAGE_GEN_URL!.trim()}` : "", hasCompanion ? "answers the AI companion" : ""].filter(Boolean).join(" and ") }
      : { ok: false, name: "What this computer does", said: "Neither IMAGE_GEN_URL nor COMPANION_URL is set.", fix: "Add IMAGE_GEN_URL=http://localhost:5001 to .env.local if your image program (KoboldCpp) uses port 5001." }
  );
  if (hasTool) {
    const pics = readImageToolSettings(env);
    lines.push(
      pics.problems.length
        ? { ok: false, name: "Picture settings", said: pics.problems.join(" "), fix: "Correct or remove that line in .env.local. Leaving out every IMAGE_GEN_ setting except IMAGE_GEN_URL asks KoboldCpp at the standard sizes." }
        : {
            ok: true,
            name: "Picture settings",
            said: describeSettings(pics),
            fix: pics.size === "sdxl" ? "SDXL sizes are slower: on a 12 GB card an SDXL picture took about 2 minutes. Run this test with --picture to time one here." : undefined,
          }
    );
  }
  return lines;
}

const KIND_WORDS: Record<ImageToolKind, { name: string; setting: string }> = {
  sdapi: { name: "KoboldCpp (or AUTOMATIC1111, Forge, SD.Next)", setting: "IMAGE_GEN_KIND=koboldcpp, or remove the IMAGE_GEN_KIND line" },
  comfyui: { name: "ComfyUI", setting: "IMAGE_GEN_KIND=comfyui and IMAGE_GEN_MODEL=<a model file in its models/checkpoints folder>" },
};

/** When the set kind of program did not answer but another kind did at the same address: what to change. */
export function otherKindLine(found: ImageToolKind, url: string): CheckLine {
  return {
    ok: false,
    name: "Kind of image program",
    said: `The program at ${url} answers like ${KIND_WORDS[found].name}, not like the kind set in .env.local.`,
    fix: `Set ${KIND_WORDS[found].setting} in .env.local.`,
  };
}

/** ComfyUI only: whether the model named in IMAGE_GEN_MODEL is one ComfyUI can load. `names` is null when ComfyUI did not say. */
export function comfyModelLine(model: string, names: string[] | null): CheckLine | null {
  if (!names) return null;
  if (names.includes(model)) return { ok: true, name: "ComfyUI has the model", said: model };
  const some = names.filter((n) => /\.safetensors$/i.test(n)).slice(0, 5);
  return {
    ok: false,
    name: "ComfyUI has the model",
    said: `No model called ${model}.${some.length ? ` It has: ${some.join(", ")}${names.length > some.length ? ", ..." : ""}.` : " It lists no .safetensors models."}`,
    fix: "Copy the name exactly (with its folder, if it is in one) into IMAGE_GEN_MODEL, or put the model file in ComfyUI's models/checkpoints folder and restart ComfyUI.",
  };
}

export type WebsiteAnswer =
  | { ok: true; name: string; pictures: boolean; companion: boolean; circle?: boolean }
  | { ok: false; status: number; message: string };

/** The result of asking the website whether the token is accepted. */
export function websiteLine(answer: WebsiteAnswer, appUrl: string): CheckLine {
  if (answer.ok) {
    const may = [answer.pictures ? "make pictures" : "", answer.companion ? "answer the AI companion" : ""].filter(Boolean).join(" and ") || "do nothing yet";
    return {
      ok: answer.pictures || answer.companion,
      name: "Website accepts the token",
      said: `Yes. This computer is called "${answer.name}"${answer.circle ? " and belongs to a circle: it makes only that circle's pictures" : ""}. It may ${may}.`,
      fix: answer.pictures || answer.companion ? undefined : "The token is not allowed to do anything. Make a new one.",
    };
  }
  if (answer.status === 401) {
    return { ok: false, name: "Website accepts the token", said: "The website did not accept the token.", fix: "The token is mistyped, or it was removed on the website. Make a new one and paste all of it into .env.local." };
  }
  if (answer.status === 0) {
    return { ok: false, name: "Website accepts the token", said: `${answer.message.charAt(0).toUpperCase()}${answer.message.slice(1)}. Address tried: ${appUrl}`, fix: "Check this computer's internet connection and that APP_URL is spelled right." };
  }
  return { ok: false, name: "Website accepts the token", said: `The website answered with an error (${answer.status}): ${answer.message}`, fix: "Try again in a few minutes. If it keeps happening, tell the person who runs the app." };
}

/** The result of asking the image program whether it is there. */
export function imageProgramLine(result: { ok: true } | { ok: false; error: string }, url: string): CheckLine {
  return result.ok
    ? { ok: true, name: "Image program answers", said: `Yes, at ${url}.` }
    : { ok: false, name: "Image program answers", said: `No answer at ${url}. ${result.error}`, fix: "Start the image program (KoboldCpp or ComfyUI) first and wait until it says it is listening. Check that its port matches IMAGE_GEN_URL (KoboldCpp uses 5001 and ComfyUI 8188 unless they were changed)." };
}

/** The optional test picture (`--picture`). It is made and then thrown away: nothing is sent to the website. */
export function pictureLine(result: { ok: true; seconds: number } | { ok: false; error: string }): CheckLine {
  return result.ok
    ? {
        ok: true,
        name: "Test picture",
        said: `Made one in ${result.seconds} seconds. It was not sent anywhere.`,
        fix: result.seconds > 180 ? "That is slow. People may wait a long time for their pictures; a smaller picture model may suit this computer better." : undefined,
      }
    : { ok: false, name: "Test picture", said: result.error, fix: "Open the image program's own page (for KoboldCpp, http://localhost:5001/sdui; for ComfyUI, http://localhost:8188) and make a picture there to see what it says." };
}

/** The lines as text for the window, with a last line that says whether this computer is ready. */
export function formatCheck(lines: CheckLine[]): { text: string; allOk: boolean } {
  const out: string[] = [];
  for (const l of lines) {
    out.push(`${l.ok ? "OK      " : "PROBLEM "}${l.name}: ${l.said}`);
    if (!l.ok && l.fix) out.push(`         What to do: ${l.fix}`);
    else if (l.ok && l.fix) out.push(`         Note: ${l.fix}`);
  }
  const allOk = lines.length > 0 && lines.every((l) => l.ok);
  out.push("", allOk ? "Everything checked is fine. You can start the picture studio." : "Something needs fixing before the picture studio will work. Fix the first PROBLEM above, then run this test again.");
  return { text: out.join("\n"), allOk };
}
