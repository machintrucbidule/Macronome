import os from 'node:os';
import type { AboutInfo } from '@macronome/shared';
import { env } from '../config/env.js';
import { dbInfo, STARTED_AT } from '../data/about.js';

// About service (spec/api/system-info.md): assemble the read-only app + server/runtime snapshot
// from env + node `os`/`process` + the DB. Pure gathering — no nutrition logic. Only owner-safe
// fields (no secrets, connection string, paths or dependency tree — docs/architecture/security.md).
export async function getAbout(): Promise<AboutInfo> {
  const cpus = os.cpus();
  const mem = process.memoryUsage();
  const db = await dbInfo();
  const [l1, l5, l15] = os.loadavg();
  return {
    app: {
      name: 'Macronome',
      version: env.APP_VERSION,
      environment: env.NODE_ENV,
    },
    runtime: {
      node_version: process.version,
      started_at: STARTED_AT,
      uptime_s: process.uptime(),
      pid: process.pid,
    },
    system: {
      platform: os.platform(),
      os_release: os.release(),
      arch: os.arch(),
      hostname: os.hostname(),
      cpu_model: cpus[0]?.model ?? 'unknown',
      cpu_cores: cpus.length,
      load_avg: [l1 ?? 0, l5 ?? 0, l15 ?? 0],
      mem_total_bytes: os.totalmem(),
      mem_free_bytes: os.freemem(),
      uptime_s: os.uptime(),
    },
    process_memory: {
      rss_bytes: mem.rss,
      heap_used_bytes: mem.heapUsed,
      heap_total_bytes: mem.heapTotal,
    },
    database: db,
  };
}
