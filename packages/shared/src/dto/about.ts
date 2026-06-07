// About / system-info DTOs (spec/api/system-info.md → GET /api/v1/about). A read-only
// snapshot the API gathers from env + node `os`/`process` + Postgres; the web only renders
// it (CLAUDE.md rule 2). Full-precision numbers (bytes, seconds) — the client rounds for
// display. No secrets, connection strings, paths or dependency tree (docs/.../security.md).

export interface AboutApp {
  name: string; // "Macronome"
  version: string; // env.APP_VERSION ('0.9.0' in a released image, 'dev' otherwise — ADR-0002)
  environment: string; // NODE_ENV
}

export interface AboutRuntime {
  node_version: string; // process.version, e.g. "v22.12.0"
  started_at: string; // ISO-8601 UTC, captured once at process boot
  uptime_s: number; // process uptime (seconds)
  pid: number;
}

export interface AboutSystem {
  platform: string; // os.platform()
  os_release: string; // os.release()
  arch: string; // os.arch()
  hostname: string;
  cpu_model: string; // os.cpus()[0].model
  cpu_cores: number; // os.cpus().length
  load_avg: [number, number, number]; // os.loadavg() — 1/5/15 min (0,0,0 on Windows)
  mem_total_bytes: number;
  mem_free_bytes: number;
  uptime_s: number; // os.uptime() — host uptime (seconds)
}

export interface AboutProcessMemory {
  rss_bytes: number;
  heap_used_bytes: number;
  heap_total_bytes: number;
}

export interface AboutDatabase {
  server_version: string; // SELECT version() — full PostgreSQL banner
  size_bytes: number; // pg_database_size(current_database())
}

export interface AboutInfo {
  app: AboutApp;
  runtime: AboutRuntime;
  system: AboutSystem;
  process_memory: AboutProcessMemory;
  database: AboutDatabase;
}
