/**
 * Convert ISO 8601 string to Unix milliseconds.
 */
export function isoToUnixMs(iso: string): number {
  return new Date(iso).getTime();
}

/**
 * Convert Unix milliseconds to ISO 8601 string.
 */
export function unixMsToIso(ms: number): string {
  return new Date(ms).toISOString();
}

/**
 * Get current time as ISO 8601.
 */
export function nowIso(): string {
  return new Date().toISOString();
}
