import { cache } from "react";
import { queryOne } from "./db";
import { DEFAULT_COMPANION_NAME, DEFAULT_PREFS, type Prefs } from "./prefs-shared";
import { parseChosenTools } from "./divination-kinds";
import { parseNavFolded } from "./nav-groups";
import { parseTheme } from "./theme";
import { parseComfort } from "./comfort";
import { focusOption } from "./companion-focus";
import { adultConfirmed } from "./adult";

export { DEFAULT_PREFS, type Prefs, type Scaffolding } from "./prefs-shared";

// cache() shares one read between the root layout and the page within a single request, so a page no longer
// asks the database for the same preferences twice. It does not outlive the request.
export const getPrefs = cache(async function getPrefs(userId: number): Promise<Prefs> {
  type Row = {
    hemisphere: string | null;
    scaffolding: string | null;
    lookback_prompts: number | null;
    oracle_prompts: number | null;
    art_help: number | null;
    chosen_tools: string | null;
    theme: string | null;
    companion_enabled: number | null;
    companion_name: string | null;
    companion_focus: string | null;
    companion_focus_line: string | null;
    companion_focus_asked: number | null;
    companion_note: string | null;
    days_list_readings: number | null;
    comfort: string | null;
    guess_first: number | null;
    nav_folded: string | null;
  };
  const row = await queryOne<Row>(
    `SELECT hemisphere, scaffolding, lookback_prompts, oracle_prompts, art_help, chosen_tools, theme, companion_enabled, companion_name,
            companion_focus, companion_focus_line, companion_focus_asked, companion_note, days_list_readings, comfort, guess_first, nav_folded
       FROM users WHERE id = $1`,
    [userId]
  );
  if (!row) return DEFAULT_PREFS;
  // The companion is on only for a person who has said they are 18 or older (lib/adult.ts); the saved choice is kept for when they do.
  const adult = await adultConfirmed(userId);
  return {
    hemisphere: row.hemisphere === "south" ? "south" : "north",
    scaffolding: row.scaffolding === "less" ? "less" : "more",
    lookbackPrompts: row.lookback_prompts !== 0,
    oraclePrompts: row.oracle_prompts !== 0,
    artHelp: row.art_help !== 0,
    companionEnabled: row.companion_enabled === 1 && adult,
    adultConfirmed: adult,
    companionName: row.companion_name?.trim() || DEFAULT_COMPANION_NAME,
    companionFocus: focusOption(row.companion_focus) ? row.companion_focus! : null,
    companionFocusLine: row.companion_focus_line?.trim() ?? "",
    companionFocusAsked: row.companion_focus_asked ?? 0,
    companionNote: row.companion_note?.trim() ?? "",
    daysListReadings: row.days_list_readings !== 0,
    guessFirst: row.guess_first !== 0,
    tools: parseChosenTools(row.chosen_tools),
    navFolded: parseNavFolded(row.nav_folded),
    theme: parseTheme(row.theme),
    comfort: row.comfort ? parseComfort(row.comfort) : null,
  };
});
