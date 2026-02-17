/**
 * Convert ISO 8601 string to Unix milliseconds.
 */
export function isoToUnixMs(iso) {
    return new Date(iso).getTime();
}
/**
 * Convert Unix milliseconds to ISO 8601 string.
 */
export function unixMsToIso(ms) {
    return new Date(ms).toISOString();
}
/**
 * Get current time as ISO 8601.
 */
export function nowIso() {
    return new Date().toISOString();
}
