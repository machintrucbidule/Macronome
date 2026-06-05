// Default user data seeded on account creation (services/user-bootstrap.ts) and used as
// the day-scaffold fallback when a user has no meal_slot_template yet (services/days.ts).
// These are French DEFAULTS the user can rename/reorder/delete — meal names are user data,
// never translated (spec/screens/settings.md). The locked built-in container name ("Rien",
// 0 g) is the direct-net leftover case (spec/screens/containers.md, DECISIONS Gap 13).

export const DEFAULT_MEAL_SLOTS = ['Petit déjeuner', 'Déjeuner', 'Dîner', 'Collation'];

export const BUILTIN_CONTAINER_NAME = 'Rien';
export const BUILTIN_CONTAINER_TARE_G = 0;
