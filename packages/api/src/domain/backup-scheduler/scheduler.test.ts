import { expect, test } from 'vitest';
import { isBackupDue } from './due.js';
import { calendarInZone } from './calendar.js';
import { backupsToRotate, backupDateFromName, type BackupFile } from './rotate.js';
import { backupFilename } from './filename.js';

// Neutral oracles from spec/logic/backup-scheduler.md §5 (no personal data).

// --- §5.1 isBackupDue -------------------------------------------------------

test('§5.1.1 due on a normal night (past scheduled time, not backed up today)', () => {
  expect(
    isBackupDue({
      enabled: true,
      nowDate: '2026-01-15',
      nowTime: '04:00',
      timeOfDay: '03:00',
      lastBackupDate: '2026-01-14',
    }),
  ).toBe(true);
});

test('§5.1.2 not due before the scheduled time', () => {
  expect(
    isBackupDue({
      enabled: true,
      nowDate: '2026-01-15',
      nowTime: '02:30',
      timeOfDay: '03:00',
      lastBackupDate: '2026-01-14',
    }),
  ).toBe(false);
});

test('§5.1.3 not due when already backed up today', () => {
  expect(
    isBackupDue({
      enabled: true,
      nowDate: '2026-01-15',
      nowTime: '04:00',
      timeOfDay: '03:00',
      lastBackupDate: '2026-01-15',
    }),
  ).toBe(false);
});

test('§5.1.4 due when never backed up and the time has passed', () => {
  expect(
    isBackupDue({
      enabled: true,
      nowDate: '2026-01-15',
      nowTime: '04:00',
      timeOfDay: '03:00',
      lastBackupDate: null,
    }),
  ).toBe(true);
});

test('§5.1.5 not due when disabled', () => {
  expect(
    isBackupDue({
      enabled: false,
      nowDate: '2026-01-15',
      nowTime: '04:00',
      timeOfDay: '03:00',
      lastBackupDate: null,
    }),
  ).toBe(false);
});

test('§5.1.6 catch-up after downtime (runs today; missed day not recovered)', () => {
  expect(
    isBackupDue({
      enabled: true,
      nowDate: '2026-01-15',
      nowTime: '23:00',
      timeOfDay: '03:00',
      lastBackupDate: '2026-01-13',
    }),
  ).toBe(true);
});

test('§5.1.7 due exactly at the scheduled minute (≥ is inclusive)', () => {
  expect(
    isBackupDue({
      enabled: true,
      nowDate: '2026-01-15',
      nowTime: '03:00',
      timeOfDay: '03:00',
      lastBackupDate: '2026-01-14',
    }),
  ).toBe(true);
});

// --- §1.1 calendarInZone (B-220) --------------------------------------------
// The scheduler reads the daily time in the user's IANA zone: a 00:0x-Paris schedule is due
// just after local midnight even though the server clock (UTC) is still 22:0x the day before.

test('§1.1 reduces a UTC instant to the Europe/Paris wall clock (summer +02:00)', () => {
  // 22:05Z on 2026-07-09 is 00:05 on 2026-07-10 in Paris (CEST, +02:00).
  expect(calendarInZone(new Date('2026-07-09T22:05:00Z'), 'Europe/Paris')).toEqual({
    date: '2026-07-10',
    time: '00:05',
  });
});

test('§1.1 reduces the same instant to the UTC wall clock', () => {
  expect(calendarInZone(new Date('2026-07-09T22:05:00Z'), 'UTC')).toEqual({
    date: '2026-07-09',
    time: '22:05',
  });
});

test('§1.1 midnight in-zone is 00:00, not 24:00', () => {
  expect(calendarInZone(new Date('2026-07-09T22:00:00Z'), 'Europe/Paris')).toEqual({
    date: '2026-07-10',
    time: '00:00',
  });
});

test('§1.1 an unrecognised zone falls back to the server-local calendar', () => {
  const instant = new Date('2026-07-09T22:05:00Z');
  const server = calendarInZone(instant, undefined);
  expect(calendarInZone(instant, 'Not/AZone')).toEqual(server);
});

// --- §5.2 backupsToRotate ---------------------------------------------------

const file = (id: string, backupDate: string): BackupFile => ({ id, backupDate });

test('§5.2.1 prunes backups on/older than the cutoff day', () => {
  const files = [
    file('a', '2026-01-15'),
    file('b', '2026-01-14'),
    file('c', '2026-01-09'),
    file('d', '2026-01-08'),
    file('e', '2026-01-01'),
  ];
  expect(backupsToRotate(files, 7, '2026-01-15')).toEqual(['d', 'e']);
});

test('§5.2.2 keeps multiple backups on the same in-window day', () => {
  const files = [
    file('nightly', '2026-01-15'),
    file('manual', '2026-01-15'),
    file('old', '2026-01-08'),
  ];
  expect(backupsToRotate(files, 7, '2026-01-15')).toEqual(['old']);
});

test('§5.2.3 nothing to prune when all are within the window', () => {
  expect(
    backupsToRotate([file('a', '2026-01-15'), file('b', '2026-01-10')], 7, '2026-01-15'),
  ).toEqual([]);
});

test('§5.2.4 empty list', () => {
  expect(backupsToRotate([], 7, '2026-01-15')).toEqual([]);
});

test('§5.2.5 retention 1 keeps only today', () => {
  expect(
    backupsToRotate([file('today', '2026-01-15'), file('yest', '2026-01-14')], 1, '2026-01-15'),
  ).toEqual(['yest']);
});

// --- §4 filename ------------------------------------------------------------

test('§4 backup filename is dated + UTC-timestamped', () => {
  expect(backupFilename('2026-01-15T02:03:04.000Z')).toBe(
    'macronome-backup-2026-01-15T020304Z.json',
  );
});

test('§4 backupDateFromName round-trips the date, or null on a non-match', () => {
  expect(backupDateFromName('macronome-backup-2026-01-15T020304Z.json')).toBe('2026-01-15');
  expect(backupDateFromName('other-file.json')).toBeNull();
});
