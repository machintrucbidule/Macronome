-- B-045: the garde-manger pin is no longer a per-line frozen snapshot; it is derived
-- live from pantry_item on read (spec/logic/pantry-pin.md). Drop the redundant column.
ALTER TABLE "meal_entry" DROP COLUMN "is_pinned";
