import { query } from "./db";

export {
  MAX_SCRYING_MINUTES,
  SCRYING_SURFACE_LABELS,
  SCRYING_SURFACES,
  cleanMinutes,
  isScryingSurface,
  minutesInWords,
  surfaceLabel,
  type ScryingSurface,
} from "./scrying-surfaces";

// Scrying: a person looks into a surface and writes what they saw. A session is one shared record
// (`divinations`, kind 'scrying') plus one row in `scrying_sessions` (migration 025) saying which surface and,
// when the person kept it, how long they looked. What they saw is kept in `journals`, like any other writing
// about a reading. The app never says what a shape is.

/** One saved session at a surface. */
export interface ScryingSession {
  /** The id of the session's shared record. */
  id: number;
  question: string | null;
  /** JSON snapshot of the sky when the session was saved. */
  sky: string | null;
  created_at: string;
  /** 'mirror', 'ball', or 'water'. */
  surface: string;
  /** How long the person looked, in whole minutes. Null when it was not kept. */
  minutes: number | null;
  /** How many entries the person has written about this session. */
  entry_count: number;
}

async function findSessions(userId: number, id?: number): Promise<ScryingSession[]> {
  const params: number[] = [userId];
  let sql = `
    SELECT d.id, d.question, d.sky, d.created_at, s.surface, s.minutes,
           (SELECT COUNT(*)::int FROM journals j WHERE j.divination_id = d.id) AS entry_count
    FROM divinations d JOIN scrying_sessions s ON s.divination_id = d.id
    WHERE d.user_id = $1 AND d.kind = 'scrying'`;
  if (id) sql += ` AND d.id = $${params.push(id)}`;
  sql += " ORDER BY d.created_at DESC, d.id DESC";
  return query<ScryingSession>(sql, params);
}

/** The person's sessions, newest first. */
export function listSessions(userId: number): Promise<ScryingSession[]> {
  return findSessions(userId);
}

/** One session, or null when it is not theirs. */
export async function loadSession(userId: number, id: number): Promise<ScryingSession | null> {
  if (!id) return null;
  return (await findSessions(userId, id))[0] ?? null;
}
