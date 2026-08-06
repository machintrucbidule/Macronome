-- LD-1 / B-303 — index the Ciqual catalog's default ordering.
--
-- `GET /food-refs` orders by (name, id) in the queried locale. Nothing backed those columns, so
-- every page sorted the whole 3 400-row table — measured at 15 ms per page — and a scrollbar jump
-- now backfills ~68 pages, about a second of pure sorting. With the index a page costs 0.3 ms
-- (index scan, no sort). One btree per name column serves both scan directions.
--
-- Measured caveat, kept honest: at the very deepest offsets the planner still prefers the seq scan
-- + quicksort, because reading 3 300 index entries and their heap rows costs more than sorting the
-- table once. That is the correct choice, and it is the last page or two of a backfill.
--
-- The numeric sorts (kcal/fat/carb/protein) are deliberately left unindexed: measured at 4.7 ms,
-- they do not repay eight more indexes at this size (spec/schema/indexes.md).

CREATE INDEX "idx_foodref_name_fr" ON "food_ref"("name_fr", "id");
CREATE INDEX "idx_foodref_name_eng" ON "food_ref"("name_eng", "id");
