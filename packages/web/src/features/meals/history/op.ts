import type {
  CreateMealEntryRequest,
  EntryUnit,
  MacroSnap,
  MealEntry,
  UpdateMealEntryRequest,
} from '@macronome/shared';

// Undo/redo op model for the Repas line edits (UR-1 / B-133). Pure: no React, no I/O. Each op
// carries exactly what is needed to compute BOTH its inverse (undo) and its re-apply (redo).
// Edits are server-persisted and refetched (no optimistic state), so undo/redo re-issue the
// inverse mutation through the existing entry/pin/reorder endpoints; a re-created line gets a
// new server id, handled by the id-map (idMap.ts). Day-level ops are never recorded here.

export interface OrderItem {
  id: string;
  order_index: number;
}

/** Enough of a line to re-create it identically via createEntry. A referenced line recomputes
 *  its macro snap from the food on a live day; a custom line carries `snap` so it is exact. */
export interface LineSnapshot {
  kind: 'referenced' | 'custom';
  food_id: string | null;
  custom_name: string | null;
  served_quantity: number;
  unit: EntryUnit;
  portion_id: string | null;
  snap: MacroSnap;
  order_index: number;
}

export function snapshotOf(e: MealEntry): LineSnapshot {
  return {
    kind: e.kind,
    food_id: e.food_id,
    custom_name: e.custom_name,
    served_quantity: e.served_quantity,
    unit: e.unit,
    portion_id: e.portion_id,
    snap: e.snap,
    order_index: e.order_index,
  };
}

/** Build the create request that resurrects a line from its snapshot (custom keeps `snap`). */
export function createBodyFrom(s: LineSnapshot): CreateMealEntryRequest {
  if (s.kind === 'custom') {
    return {
      kind: 'custom',
      custom_name: s.custom_name ?? '',
      served_quantity: s.served_quantity,
      unit: s.unit,
      snap: s.snap,
      order_index: s.order_index,
    };
  }
  return {
    kind: 'referenced',
    food_id: s.food_id ?? '',
    served_quantity: s.served_quantity,
    unit: s.unit,
    ...(s.portion_id ? { portion_id: s.portion_id } : {}),
    order_index: s.order_index,
  };
}

interface Base {
  mealId: string;
}
export interface AddOp extends Base {
  type: 'add';
  entryId: string;
  snapshot: LineSnapshot;
}
export interface RemoveOp extends Base {
  type: 'remove';
  entryId: string;
  snapshot: LineSnapshot;
}
export interface UpdateOp extends Base {
  type: 'update';
  entryId: string;
  before: UpdateMealEntryRequest;
  after: UpdateMealEntryRequest;
}
export interface PinOp extends Base {
  type: 'pin';
  entryId: string;
  /** Pin state BEFORE the recorded toggle: false = the action was a pin, true = it was an unpin. */
  pinnedBefore: boolean;
  snapshot: LineSnapshot;
}
export interface ReorderOp extends Base {
  type: 'reorder';
  before: OrderItem[];
  after: OrderItem[];
}
/** Cross-meal move (B-187/B-188). A move is its own inverse; undo restores the source row —
 *  if that sparse row was refilled meanwhile the duplicate index is accepted (as reorder-undo). */
export interface MoveOp extends Base {
  type: 'move';
  entryId: string;
  targetMealId: string;
  fromOrderIndex: number;
  toOrderIndex: number;
}

export type Op = AddOp | RemoveOp | UpdateOp | PinOp | ReorderOp | MoveOp;

/** Sentinel id meaning "the line just created by the preceding create intent" (idMap.ts fills it). */
export const CREATED = '@created';

/** A single mutation the reconciler asks the executor to perform via the existing useDay hooks. */
export type Intent =
  | { kind: 'create'; mealId: string; body: CreateMealEntryRequest; bindRemapFor: string }
  | { kind: 'update'; mealId: string; id: string; body: UpdateMealEntryRequest }
  | { kind: 'remove'; mealId: string; id: string }
  | { kind: 'reorder'; mealId: string; order: OrderItem[] }
  | { kind: 'move'; mealId: string; id: string; targetMealId: string; orderIndex: number }
  | { kind: 'pin'; mealId: string; id: string }
  | { kind: 'unpin'; mealId: string; id: string };
