import type { ImportReport } from './generated/ImportReport';

// Backups are made and read by the desktop app's Rust core (backup.rs). The window only names the
// file by today's date and says what an import brought in.

/** The biggest file the window hands to the core, as in backup.rs. */
export const maxBackupBytes = 64 * 1024 * 1024;

/** A backup file's date, like "2026-10-29", in the computer's own time zone. */
export function backupDay(at: Date): string {
  const two = (n: number) => String(n).padStart(2, '0');
  return `${at.getFullYear()}-${two(at.getMonth() + 1)}-${two(at.getDate())}`;
}

/** What an import brought in, as one line, like "Brought in 1 new profile and 412 sessions." */
export function importSummary(report: ImportReport): string {
  const count = (n: number, one: string, many: string) =>
    n > 0 ? `${n.toLocaleString()} ${n === 1 ? one : many}` : '';
  const parts = [
    count(report.newProfiles, 'new profile', 'new profiles'),
    count(report.updatedProfiles, 'updated profile', 'updated profiles'),
    count(report.sessions, 'session', 'sessions'),
    count(report.gateVisits, 'trip to a site', 'trips to sites'),
    count(report.satellites, 'satellite', 'satellites'),
    count(report.quotes, 'quote', 'quotes'),
  ].filter(Boolean);
  if (parts.length === 0) return 'Nothing new: everything in that backup is already here.';
  const last = parts.pop()!;
  return `Brought in ${parts.length ? `${parts.join(', ')} and ${last}` : last}.`;
}
