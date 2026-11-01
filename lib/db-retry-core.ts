// The rules for retrying a read and for the size of the connection pool, kept apart from the database so tests can run them (open item P7).
// No imports.

/** Postgres and network error codes that mean "the connection failed", not "the statement was wrong". */
const CONNECTION_CODES = new Set([
  "ECONNRESET", "ECONNREFUSED", "ETIMEDOUT", "EPIPE", "ENOTFOUND", "EAI_AGAIN",
  "57P01", "57P02", "57P03", // the server is shutting down, crashed, or cannot accept connections yet
  "08000", "08001", "08003", "08004", "08006", // connection exceptions
  "53300", // too many connections
]);

const CONNECTION_MESSAGES = /connection terminated|connection timeout|timeout exceeded when trying to connect|client has encountered a connection error|server closed the connection unexpectedly|too many (clients|connections)/i;

/** Whether an error came from the connection rather than from the statement. Only then can a read be tried again. */
export function isConnectionError(err: unknown): boolean {
  if (!err || typeof err !== "object") return false;
  const { code, message } = err as { code?: unknown; message?: unknown };
  if (typeof code === "string" && CONNECTION_CODES.has(code)) return true;
  return typeof message === "string" && CONNECTION_MESSAGES.test(message);
}

/** Milliseconds to wait before each further try of a read: two more tries after the first. */
export const READ_RETRY_DELAYS_MS = [200, 600];

/** The most connections one server process keeps (DB_POOL_MAX): a whole number from 1 to 20, otherwise pg's own default of 10. */
export function poolMax(value: string | undefined = process.env.DB_POOL_MAX): number {
  const n = Number(value);
  return value !== undefined && value.trim() !== "" && Number.isInteger(n) && n >= 1 && n <= 20 ? n : 10;
}
