# API — system info (about)

See `00-conventions.md`. **Authenticated** (an active session is required). Base path
`/api/v1/about`.

A read-only snapshot of the running app and its host, for the À propos screen
(`specifications/screens/about.md`). The server gathers everything (env + node `os`/`process` +
PostgreSQL); the web only renders it (rule 2). Full-precision numbers (bytes, seconds) — the
client rounds for display.

**Privacy:** only owner-safe fields are exposed (the endpoint is behind auth, single-owner app).
**Never** the DB connection string, secrets/`SESSION_SECRET`, filesystem paths, or the dependency
tree (`docs/architecture/security.md` §7/§9). The public readiness probe stays at
`GET /api/v1/health` (unauthenticated; reports `status`, `db`, `version`).

## Endpoint

- `GET /about` — → 200
  `{data:{
  app:{name, version, environment},
  runtime:{node_version, started_at, uptime_s, pid},
  system:{platform, os_release, arch, hostname, cpu_model, cpu_cores,
          load_avg:[number,number,number], mem_total_bytes, mem_free_bytes, uptime_s},
  process_memory:{rss_bytes, heap_used_bytes, heap_total_bytes},
  database:{server_version, size_bytes}
}}`.
  - `app.version` = `APP_VERSION` (baked from the git tag — ADR-0002; `dev` outside the image).
  - `started_at` = process boot instant (ISO-8601 UTC); `*_uptime_s` in seconds.
  - `system.load_avg` = 1/5/15-minute averages (`[0,0,0]` on platforms without load average).
  - `database.server_version` = `SELECT version()`; `size_bytes` =
    `pg_database_size(current_database())`.
  - No request body/params. Unauthenticated → 401.
