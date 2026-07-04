# Logic spec — external integrations (Home Assistant, BarclaudeGateway)

Two optional **local-network integrations**, each stored as a connection config on
`app_user.settings.integrations` (see `spec/schema/tables-catalog.md`) and consumed
exclusively through **server-side proxies** (`spec/api/integrations.md`) — secrets never
reach the browser, and the proxies work when the app is used remotely:

- **Home Assistant** — read the latest smart-scale measurement to pre-fill the weigh-in
  modal's weight field (B-180). Nothing is built on the HA side: the read uses HA's
  standard REST API with a user-created long-lived access token.
- **BarclaudeGateway** — a self-hosted drive-product gateway (local HTTP API, `X-API-Key`
  auth) backing the Chronodrive product search in the food modal (B-182; the search and
  product mapping are specified in §8, added by that batch).

This file follows the same doctrine as `ai-connection.md`: local validation, deep partial
merge with secret keep/clear semantics, redaction to `*_set` booleans, and a "the useful
call is the connection proof" test.

## 1. The connection objects

`settings.integrations` always has both keys; each is `null` until configured:

```
integrations : {
  home_assistant    : HA | null,
  barclaude_gateway : BG | null,
}

HA = {
  base_url              : string   // absolute URL of the HA instance (http allowed on LAN)
  token                 : string   // SECRET — long-lived access token
  weight_entity_id      : string   // the scale's weight sensor entity id — ALWAYS user-supplied
  weight_round_decimals : int      // 0..3, decimals for the imported weight; default 1
}

BG = {
  base_url : string                // absolute URL (host+port) of the gateway
  api_key  : string                // SECRET — printed once in the gateway's logs at first boot
}
```

`weight_entity_id` is **never defaulted, seeded, or hardcoded** in code — it is typed by
the user (findable in HA under _Developer tools → States_). Examples in this spec use the
neutral `sensor.scale_weight`.

## 2. Validation

Local (shape/format), never calls the remote host:

- `base_url` (both) — an **absolute** `http`/`https` URL; malformed → `invalid_url`.
  Plain `http://` is accepted (LAN deployments; same SSRF stance as `ai.base_url` — a
  single-owner self-hosted app, recorded in `DECISIONS.md`).
- `token` / `api_key`, when present, are **non-empty after trim** (absence is handled by
  merge, §3).
- `weight_entity_id` matches `^[a-z0-9_]+\.[a-z0-9_]+$` (HA `domain.object_id` format) →
  else `invalid_entity_id`.
- `weight_round_decimals` is an **integer 0..3** → else `invalid_round_decimals`; when
  absent from a creating patch it defaults to `1`.

## 3. Merge semantics (partial update)

A `PATCH /settings` carries a partial `integrations`; merged **per connection**:

- A connection key **absent** from the patch → that stored connection is untouched.
- A connection key set to **`null`** → that connection is **disconnected** (stored as
  `null`) without touching the other one (or `ai`).
- A connection patch object is merged field-by-field onto the stored connection:
  - non-secret fields (`base_url`, `weight_entity_id`, `weight_round_decimals`) —
    present → replace; absent → keep;
  - **secrets** (`token` / `api_key`) — **absent** ⇒ keep the stored secret; **`""` or
    `null`** ⇒ clear it; any other value ⇒ replace. (Same rule as `ai.api_key` — the
    masked UI updates everything else without resending the secret.)
- Patching a connection that was `null` creates it from the patch (which must then carry
  the required fields; `weight_round_decimals` defaults to 1 when absent).

## 4. Redaction (read side)

Pure function `redactIntegrations(integrations) → read` — applied before the config
leaves the API:

- `home_assistant.token` is removed, replaced by `token_set: boolean` (true iff a
  non-empty token is stored).
- `barclaude_gateway.api_key` is removed, replaced by `api_key_set: boolean`.
- All other fields pass through unchanged. `null` connection in → `null` out.
- Raw secrets are **never** serialised to a client and **never** logged.

## 5. Home Assistant weight read (B-180)

Server-side proxy, reading the **stored** HA config:

- Request: `GET {base_url}/api/states/{weight_entity_id}` with header
  `Authorization: Bearer {token}`.
- Success (HTTP 200) body: `{ state, last_changed, attributes: { unit_of_measurement } }`.
- The proxy returns `{ weight_kg, measured_at, unit, entity_id }` where:
  - `weight_kg` = `Number(state)` **rounded half up to `weight_round_decimals` decimals**
    (server-side — the web never computes);
  - `measured_at` = `last_changed` (ISO datetime, passed through);
  - `unit` = `attributes.unit_of_measurement` (must be `kg`, see below);
  - `entity_id` echoes the configured entity.
- `state` of `"unavailable"` or `"unknown"` → `ha_no_measurement` (the entity exists but
  has no usable value right now).
- Non-numeric `state`, or `unit_of_measurement` ≠ `kg` → `ha_bad_response` (SI-only,
  `spec/logic/00-conventions.md`; no unit conversion in v1).

This read is also the HA card's **connection proof** (the "Tester" button): the UI
persists the edited config first (normal `/settings` PATCH), then calls the proxy — same
"persist then test" flow as `/settings/ai/models`.

### Worked examples (oracles)

1. **Rounding, default.** `state:"83.3521"`, unit `kg`, `weight_round_decimals:1` →
   `{ weight_kg: 83.4, measured_at: <last_changed>, unit: "kg", entity_id: "sensor.scale_weight" }`.
2. **Rounding, 2 decimals.** Same state, `weight_round_decimals:2` → `weight_kg: 83.35`.
3. **Rounding, half up.** `state:"80.05"`, decimals 1 → `weight_kg: 80.1`.
4. **No measurement.** `state:"unavailable"` (or `"unknown"`) → error `ha_no_measurement`.
5. **Bad unit.** `state:"183.5"`, unit `lb` → error `ha_bad_response`.
6. **Non-numeric.** `state:"on"`, unit `kg` → error `ha_bad_response`.

## 6. Gateway connection proof

- Request: `GET {base_url}/api/v1/ping` with header `X-API-Key: {api_key}`.
- Success: HTTP 200 `{ status: "ok", version: <int> }` → passed through.
- This ping is the gateway card's **connection proof** (same doctrine as §5 / "list
  models is the proof" — no separate test endpoint). Same persist-then-test flow.

## 7. Error codes & outbound policy

Upstream mapping (consumed by the API layer; codes mirrored in `shared/errors.ts`):

| Condition (Home Assistant proxy)                         | Error code            | HTTP |
| -------------------------------------------------------- | --------------------- | ---- |
| `integrations.home_assistant` is `null` / missing pieces | `ha_not_configured`   | 409  |
| upstream 401/403 (bad or revoked token)                  | `ha_unauthorized`     | 502  |
| upstream 404 (unknown entity id)                         | `ha_entity_not_found` | 502  |
| `state` `"unavailable"` / `"unknown"`                    | `ha_no_measurement`   | 409  |
| upstream 500/502/503/504 (after retry)                   | `ha_unavailable`      | 503  |
| network failure / timeout / DNS / refused (after retry)  | `ha_unreachable`      | 504  |
| 2xx unparseable, non-numeric state, wrong unit, other    | `ha_bad_response`     | 502  |

| Condition (BarclaudeGateway proxy)                      | Error code               | HTTP |
| ------------------------------------------------------- | ------------------------ | ---- |
| `integrations.barclaude_gateway` is `null`              | `gateway_not_configured` | 409  |
| upstream 401 (`unauthorized` envelope)                  | `gateway_unauthorized`   | 502  |
| upstream 500/502/503/504 (after retry)                  | `gateway_unavailable`    | 503  |
| network failure / timeout / DNS / refused (after retry) | `gateway_unreachable`    | 504  |
| 2xx unparseable / other upstream non-2xx                | `gateway_bad_response`   | 502  |

Outbound policy (both hosts): transient failures (network + 5xx) are retried briefly
(3 attempts total, short delay); **401/403/404 are never retried**. Request timeouts are
short — **≤ 10 s** for HA, **≤ 8 s** for the gateway — so a modal button never hangs.
Secrets are sent only in the auth header of the outbound request and are never logged.

For the product proxies (§8) one row extends the gateway table:

| Condition (BarclaudeGateway product proxy)     | Error code          | HTTP |
| ---------------------------------------------- | ------------------- | ---- |
| upstream 404 (`not_found` envelope) on product | `gateway_not_found` | 404  |

## 8. Chronodrive product search & food mapping (B-182)

Two server-side proxies back the food modal's _Recherche chronodrive_ dialog. Both read
the stored gateway config and authenticate with `X-API-Key` (§6 doctrine).

### 8.1 Search

- UI contract: the query is **debounced** and only submitted at **≥ 3 characters**
  (trimmed); the dialog shows at most **10 compact results**.
- Request: `GET {base_url}/api/v1/search?q={q}&size=10` (the server always passes
  `size=10` — the cap is server-side, not client-side).
- Success: the upstream `{ products: ProductSummary[] }` is mapped to the compact
  summary `{ id, name, brand, image_url, unit_quantity_label, price_eur, product_url }`:
  - `brand`, `unitQuantityLabel` absent → `null`;
  - `image_url ← image` (absolute public URL; the browser loads thumbnails directly —
    images are not proxied in v1);
  - `price_eur ← price.default` (euros, display-only), absent → `null`;
  - `product_url` = `https://www.chronodrive.com/p-P{id}` (`null` when `id` is absent) —
    the site 301-redirects this id-only form to the canonical product page (verified);
    built server-side so the Chronodrive URL scheme stays in the domain mapping.
- A `q` shorter than 3 characters after trim is rejected at the controller (422,
  `q: too_short` via Zod) — no outbound call.

### 8.2 Product → food pre-fill mapping (server-side)

`mapProduct(raw) → food_prefill` — pure function, applied by the API (rule 2: the web
never computes a nutrition figure):

- **Base gate (tolerant)**. `nutrition.base` on the live gateway is **free text or
  absent** (observed on a 24-product sample: `100 g`, `100 G`, `100 mL`, `100 grammes`,
  `100.000 GR`, `Pour 100g`, `par portion de 100g`,
  `Valeurs nutritionnelles moyennes pour 100 ml`, and missing entirely), so the gate is
  a rule, not an equality:
  - **Base absent/empty → mapped.** The EU INCO regulation makes the per-100 g/100 ml
    declaration mandatory — it is what Chronodrive publishes — so an unlabelled table
    is per-100 by law.
  - **Base present → mapped iff the text references 100 g/ml**: normalised (lowercased,
    spaces removed), it must match `100` (optionally `.0+`/`,0+`) followed by
    `g`/`gr`/`gramme(s)`/`ml`, not preceded by a digit and not followed by a letter —
    this accepts every observed per-100 spelling, including `par portion de 100g`
    (a portion that _is_ 100 g), and rejects `1000 g`-style false positives.
  - **Anything else → all four macros `null`** (e.g. `portion (30 g)`, `55 g` — the
    only case where mapping would silently store wrong per-100 macros).
- Field mapping (a field **absent** from the gateway payload — manufacturer did not
  declare it — maps to `null`; the others are kept):
  - `kcal_per_100g ← nutrition.energyKcal` — **never derived from `energyKj`**;
  - `fat_per_100g ← nutrition.fat`;
  - `carb_per_100g ← nutrition.carbohydrate`;
  - `protein_per_100g ← nutrition.protein`.
- `name = [brand, name].filter(Boolean).join(' ')` (space-separated, "Marque Nom").
- `comment = unitQuantityLabel ?? null` (the product weight label, e.g. `"500 g"`).
- **No named portion** is derived from the product weight (owner decision).
- UI contract: a `null` macro leaves the field **empty** and the modal shows a
  non-blocking "à compléter" notice — the notice wording must state that an empty
  macro field is **saved as 0** (existing `draftToBody` behaviour).

### 8.3 Worked examples (oracles)

1. **Full mapping.** `{brand:"Panzani", name:"Spaghetti", unitQuantityLabel:"500 g",
nutrition:{base:"100 g", energyKcal:361, fat:1.4, carbohydrate:72, protein:12}}` →
   `{name:"Panzani Spaghetti", kcal_per_100g:361, fat_per_100g:1.4, carb_per_100g:72,
protein_per_100g:12, comment:"500 g"}`.
2. **Non-100 g base.** Same product with `nutrition.base:"portion (30 g)"` → all four
   macros `null` (name/comment still mapped).
3. **Absent field.** Same product without `nutrition.fat` → `fat_per_100g:null`, the
   other three kept.
4. **No brand.** `{brand:null, name:"Spaghetti", …}` → `name:"Spaghetti"` (no leading
   space); `unitQuantityLabel` absent → `comment:null`.
5. **kJ only.** `nutrition:{base:"100 g", energyKj:1530}` (no `energyKcal`) →
   `kcal_per_100g:null` (never derived from kJ).
6. **Spacing-tolerant base.** `nutrition:{base:"100ml", energyKcal:47, fat:1.6,
carbohydrate:4.8, protein:3.3}` (no space — the live gateway form) → all four macros
   mapped (`kcal_per_100g:47`, …); same for `"100 G"`.
7. **Product URL.** summary `{id:"387343", …}` →
   `product_url:"https://www.chronodrive.com/p-P387343"`; missing id → `null`.
8. **Absent base.** `nutrition:{energyKcal:389, fat:18, carbohydrate:33, protein:32}`
   (no `base` key — observed live on a protein bar and on chicken fillets) → all four
   macros mapped (INCO default).
9. **Free-text per-100 bases** (all observed live) → mapped: `"Pour 100 g"`,
   `"par portion de 100g"`, `"Valeurs nutritionnelles moyennes pour 100 ml"`,
   `"100 grammes"`, `"100.000 GR"`.
10. **Non-100 bases** → all four macros `null`: `"portion (30 g)"`, `"55 g"`,
    `"1000 g"` (digit guard: `1000` must not read as `100`).
