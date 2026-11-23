/* ============================================================
   Boot error codes — the OS-wide numeric system.

     0  OK          stage / system normal
     1  FAILURE     stage failed (bad element, missing API, thrown error)
     2  SYSTEM HANG stage did not complete within its time budget
     3  DISK FULL   virtual disk is full; used by boot (as a warning —
                    system still runs) and by the file manager (as a
                    hard error when a write cannot proceed)

   A single numeric code, plus a human label, plus a free-form message.
   ============================================================ */

export const BootCode = Object.freeze({
  OK: 0,
  FAILURE: 1,
  HANG: 2,
  DISK_FULL: 3
});

export const codeLabel = (code) => ({
  0: 'OK',
  1: 'FAILURE',
  2: 'SYSTEM HANG',
  3: 'DISK FULL'
}[code] ?? `UNKNOWN (${code})`);

/** Build a stage result. `ms` is the elapsed time in milliseconds. */
export const mkResult = (key, label, code, message, ms = 0) =>
  ({ key, label, code, message, ms });

/**
 * Collapse per-stage results into one overall code.
 * Severity order: HANG > FAILURE > DISK_FULL > OK.
 * The system can boot with a DISK_FULL warning, but not with FAILURE/HANG.
 */
export function overallCode(results) {
  if (results.some((r) => r.code === BootCode.HANG)) return BootCode.HANG;
  if (results.some((r) => r.code === BootCode.FAILURE)) return BootCode.FAILURE;
  if (results.some((r) => r.code === BootCode.DISK_FULL)) return BootCode.DISK_FULL;
  return BootCode.OK;
}
