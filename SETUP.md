# SETUP.md — Windows 11 environment readiness (pre-M0)

A guided, checkable walkthrough that gets this machine ready **before** Milestone 0
(`DEV_PLAN.md` → `docs/dev-plan/M0-foundations.md`). Work top to bottom; each step is
**verify first, install only if missing**. PowerShell commands are shown; run
PowerShell as your normal user unless a step says "Administrator".

Target versions come from the config contract
(`docs/architecture/appendices/config-manifests.md` and `config-docker.md`):
**Node ≥ 22**, **npm** (the workspace manager — no pnpm/yarn), **Docker Desktop**,
**PostgreSQL 17** (used via Docker), **VS Code**, **Claude Code**.

---

## 0. Conventions

- ✅ = the check passed, move on. ❌ = install/fix, then re-run the check.
- "Restart the shell" means close and reopen PowerShell so `PATH` changes apply.
- Keep everything in your normal user profile; admin is only flagged where needed.

---

## 1. Git

```powershell
git --version          # expect git version 2.40+
```
❌ Install: `winget install --id Git.Git -e` (or https://git-scm.com/download/win),
restart the shell, re-check.

One-time identity (if not already set):
```powershell
git config --global user.name  "<your name>"
git config --global user.email "<your email>"
git config --global init.defaultBranch main
```

---

## 2. Node.js (≥ 22) + npm

```powershell
node --version         # expect v22.x or newer
npm --version          # expect 10.x+ (ships with Node 22)
```
❌ Install the LTS (≥22): `winget install --id OpenJS.NodeJS.LTS -e`, restart the
shell, re-check. The repo pins `"engines": { "node": ">=22" }`; an older Node will be
rejected at install.

> The monorepo uses **npm workspaces** (`workspaces: ["packages/*"]`). Do **not**
> install pnpm or yarn — `npm install` at the root is the only package step.

---

## 3. Docker Desktop (with WSL2 backend)

```powershell
docker --version               # expect Docker version 26+
docker compose version         # expect v2.x (the `compose` subcommand, not docker-compose)
docker run --rm hello-world    # must pull and print the hello-world banner
```
❌ Install: `winget install --id Docker.DockerDesktop -e`. Then:
1. Launch Docker Desktop once; accept the WSL2 prompt (it enables the WSL2 backend).
2. If WSL2 is missing: in an **Administrator** PowerShell, `wsl --install`, reboot.
3. Ensure Docker Desktop is **running** (whale icon) before the `docker run` check.

This is how Postgres runs locally (`compose.test.yml`, `postgres:17`) — you do **not**
install PostgreSQL natively.

---

## 4. PostgreSQL access (via Docker — no native install)

You only need the Postgres **client reachability**, provided by the test compose file.
Full verification happens in M0; for readiness, just confirm the image pulls:

```powershell
docker pull postgres:17        # must succeed
```
❌ If the pull fails, it's almost always Docker Desktop not running or no network — fix
step 3 first.

> Optional: a GUI client (DBeaver, `winget install dbeaver.dbeaver`) is handy but not
> required. `psql` is reachable inside the container via
> `docker compose exec postgres psql -U macronome`.

---

## 5. VS Code

```powershell
code --version                 # prints 3 lines (version, commit, arch)
```
❌ Install: `winget install --id Microsoft.VisualStudioCode -e`, restart the shell.
Recommended extensions (optional but useful): ESLint, Prettier, Prisma, Docker.

---

## 6. Claude Code (install + auth)

Install and authenticate the agent that will execute M0 onward.

```powershell
npm install -g @anthropic-ai/claude-code     # global install (uses your Node ≥22)
claude --version                              # confirm it resolves on PATH
```
❌ If `claude` isn't found after install, restart the shell (npm global bin must be on
`PATH`).

Authenticate (opens a browser to sign in to your Anthropic account):
```powershell
claude            # first run prompts for login; complete it in the browser
```
> Product details (install method, auth, requirements) change over time — if the
> command name or install path differs from the above, follow the current docs at
> https://docs.claude.com rather than forcing the command above.

---

## 7. Decompress the delivered package into the working directory

Pick a path **without spaces or OneDrive sync** if you can (e.g. `C:\dev`):

```powershell
mkdir C:\dev -Force
Expand-Archive -Path "$HOME\Downloads\Macronome.zip" -DestinationPath C:\dev -Force
cd C:\dev\Macronome
dir                      # expect: README.md CLAUDE.md ARCHITECTURE.md DEV_PLAN.md
                         #         SETUP.md DECISIONS.md .gitignore docs spec design specifications
```
The root of the working directory is `C:\dev\Macronome`. All doc paths are relative to
this root.

---

## 8. Git sync setup — protect the personal corpus BEFORE the first push

This is the **most important** step: prove `.gitignore` is working **before** any
commit, so `specifications/`, real-value tests, `.env`, and DB dumps can never be
pushed.

### 8.1 Init the repo
```powershell
cd C:\dev\Macronome
git init
```

### 8.2 Verify the ignore rules are effective (DO THIS BEFORE `git add`)
```powershell
# These MUST print "ignored" lines (i.e. they are matched by .gitignore):
git status --ignored --short
git check-ignore -v specifications/ ; `
git check-ignore -v specifications/suivi_poids.xlsx ; `
git check-ignore -v specifications/OPEN_GAPS.md ; `
git check-ignore -v specifications/RECONCILIATION_LOG.md ; `
git check-ignore -v specifications/screens/login.md
```
Each `git check-ignore -v` line must echo back a `.gitignore` rule (e.g.
`.gitignore:5:/specifications/   specifications/...`). If a `specifications/...` path is
**not** ignored, STOP — do not continue until it is.

Also confirm the synced contracts are **not** ignored (they should be tracked):
```powershell
git check-ignore spec/ design/ DECISIONS.md      # expect: NO output (means tracked)
```
No output = good (these are git-synced). Any output here means a rule is too broad —
stop and fix `.gitignore`.

Dry-run what the first commit would actually stage:
```powershell
git add -A
git status --short                # review the staged list
git ls-files | Select-String "specifications/|\.local\.test\.ts|\.env$|\.dump$"
```
The last command must print **nothing**. If it prints any path under
`specifications/`, any `*.local.test.ts`, `.env`, or a `*.dump`, the corpus is at risk
— `git rm --cached <path>`, fix `.gitignore`, and re-run until it prints nothing.

### 8.3 Set the remote
Create an **empty private** repo on your host (GitHub: no README/.gitignore/licence),
then:
```powershell
git remote add origin https://github.com/<you>/macronome.git
git remote -v                     # confirm origin (fetch + push)
```

### 8.4 First commit & push — only after 8.2 is clean
```powershell
git commit -m "Macronome: contracts, architecture, dev plan, setup"
git branch -M main
git push -u origin main
```
After the push, open the repo on the host and **confirm `specifications/` is absent**
and `spec/`, `design/`, `DECISIONS.md` are present.

---

## 9. Final readiness checklist (gate to M0)

- [ ] `git --version` ✅
- [ ] `node --version` ≥ 22 ✅ and `npm --version` ✅
- [ ] Docker Desktop running; `docker run --rm hello-world` ✅; `docker pull postgres:17` ✅
- [ ] `code --version` ✅
- [ ] `claude --version` ✅ and logged in
- [ ] zip decompressed at `C:\dev\Macronome`; root files present
- [ ] `git init` done; **`.gitignore` proven** (8.2): `specifications/`, `*.local.test.ts`,
      `.env`, `*.dump` all ignored; `spec/`/`design/`/`DECISIONS.md` tracked
- [ ] remote set; first commit pushed; host shows **no `specifications/`**
- [ ] you can read `DEV_PLAN.md` and open `docs/dev-plan/M0-foundations.md`

When every box is ticked, you are **ready to launch Claude Code on M0**: from
`C:\dev\Macronome`, start `claude` and point it at `DEV_PLAN.md` → M0.
