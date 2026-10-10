// Server-authoritative time. Sync an offset from each response's `server_time`
// and render countdowns against it — never trust Date.now() directly.

let offsetMs = 0;

/** Call with the `server_time` (ISO) from any API response. */
export function syncServerTime(serverTimeIso: string) {
  const server = new Date(serverTimeIso).getTime();
  if (!Number.isNaN(server)) offsetMs = server - Date.now();
}

/** Current server-aligned time in ms. */
export function serverNow(): number {
  return Date.now() + offsetMs;
}
