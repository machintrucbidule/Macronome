import { calendarInZone, isBackupDue } from '../domain/backup-scheduler/index.js';
import { userRepo } from '../data/repositories/user.repo.js';
import { logger } from '../observability/logger.js';
import { runBackup } from './gdrive-backup.js';
import { rawGoogleDrive } from './settings.js';

// In-process catch-up scheduler for the Google Drive backup (spec/logic/backup-scheduler.md
// §1). Started once at boot from server.ts (never from createApp, so it stays inert under
// tests). A ~15-min tick runs a user's backup when it is past the scheduled time today and
// no successful backup ran today; state lives in the persisted last_backup_at. The scheduled
// time is read in the user's stored time_zone (B-220), falling back to the process TZ.

const TICK_MS = 15 * 60 * 1000;
const inFlight = new Set<string>();

async function runIfDue(userId: string, now: Date): Promise<void> {
  if (inFlight.has(userId)) return;
  const cfg = await rawGoogleDrive(userId);
  if (!cfg?.enabled || !cfg.refresh_token?.trim()) return;
  const { date: nowDate, time: nowTime } = calendarInZone(now, cfg.time_zone);
  const lastBackupDate = cfg.last_backup_at
    ? calendarInZone(new Date(cfg.last_backup_at), cfg.time_zone).date
    : null;
  if (
    !isBackupDue({
      enabled: cfg.enabled,
      nowDate,
      nowTime,
      timeOfDay: cfg.time_of_day,
      lastBackupDate,
    })
  ) {
    return;
  }
  inFlight.add(userId);
  try {
    await runBackup(userId);
    logger.info({ userId }, 'scheduled Google Drive backup completed');
  } catch (err) {
    logger.warn({ err: { name: (err as Error)?.name } }, 'scheduled Google Drive backup failed');
  } finally {
    inFlight.delete(userId);
  }
}

async function tick(): Promise<void> {
  const candidates = await userRepo.findBackupCandidates();
  if (candidates.length === 0) return;
  const now = new Date();
  for (const { id } of candidates) await runIfDue(id, now);
}

/** Start the recurring scheduler; the timer is unref'd so it never blocks shutdown. */
export function startScheduler(): void {
  const timer = setInterval(() => {
    void tick().catch((err: unknown) => logger.warn({ err }, 'scheduler tick failed'));
  }, TICK_MS);
  timer.unref();
  logger.info('Google Drive backup scheduler started');
}
