import type { Request, Response } from 'express';
import { DataExportEnvelopeSchema, ErrorCode, type DataMutationResult } from '@macronome/shared';
import { buildExport } from '../../services/data/export.js';
import { buildJournalCsv, buildWeightCsv } from '../../services/data/export-csv.js';
import { importData } from '../../services/data/import.js';
import { wipeData } from '../../services/data/wipe.js';
import { ApiError, zodDetails } from '../errors.js';

// THIN controllers (api-CLAUDE.md): Zod-parse → service → serialise. The "Données" section of
// Paramètres (IMP-1): export a full snapshot, wipe tracked data, or import (REPLACE) a snapshot.
// requireAuth exposes the user id; CSRF guards the two state-changing routes.
function userId(res: Response): string {
  return res.locals.userId as string;
}

const OK: DataMutationResult = { ok: true };

/** GET /data/export — full account snapshot as a downloadable JSON file (B-002). */
export async function exportData(_req: Request, res: Response): Promise<void> {
  const envelope = await buildExport(userId(res));
  if (!envelope) throw new ApiError(404, ErrorCode.NotFound);
  const filename = `macronome-export-${new Date().toISOString().slice(0, 10)}.json`;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.status(200).send(JSON.stringify(envelope));
}

/** Send a CSV string as a downloadable attachment (EX-1 / B-132). */
function sendCsv(res: Response, name: string, csv: string): void {
  const filename = `macronome-${name}-${new Date().toISOString().slice(0, 10)}.csv`;
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.status(200).send(csv);
}

/** GET /data/export/journal.csv — one recap row per logged day, all years (B-132). */
export async function exportJournalCsv(_req: Request, res: Response): Promise<void> {
  sendCsv(res, 'journal', await buildJournalCsv(userId(res)));
}

/** GET /data/export/weight.csv — one row per weigh-in, full history (B-132). */
export async function exportWeightCsv(_req: Request, res: Response): Promise<void> {
  sendCsv(res, 'weight', await buildWeightCsv(userId(res)));
}

/** POST /data/import — validate then REPLACE all data with the uploaded snapshot (B-003). */
export async function importDataController(req: Request, res: Response): Promise<void> {
  const parsed = DataExportEnvelopeSchema.safeParse(req.body);
  if (!parsed.success) {
    throw new ApiError(422, ErrorCode.ImportInvalidFormat, zodDetails(parsed.error));
  }
  await importData(userId(res), parsed.data);
  res.status(200).json({ data: OK });
}

/** POST /data/wipe — delete all tracked data, keep the account seed (B-001). */
export async function wipeDataController(_req: Request, res: Response): Promise<void> {
  await wipeData(userId(res));
  res.status(200).json({ data: OK });
}
