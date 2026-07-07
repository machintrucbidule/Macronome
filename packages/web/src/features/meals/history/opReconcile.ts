import { CREATED, createBodyFrom, type Intent, type Op, type OrderItem, type PinOp } from './op';

// Pure reconciliation (UR-1 / B-133): given an op, the id-resolver and an "entry still exists?"
// probe, return the ordered mutation intents that undo or redo it. No I/O — the executor in
// useMealHistory runs the intents and feeds created ids back into the id-map.

type Resolve = (id: string) => string;
type Exists = (id: string) => boolean;

const mapOrder = (order: OrderItem[], resolve: Resolve): OrderItem[] =>
  order.map((o) => ({ id: resolve(o.id), order_index: o.order_index }));

/** Re-pin an unpinned line: just pin it if it survived (qty>0), else recreate + pin (qty-0 case
 *  where unpin removed the placeholder line). The created id is substituted via the CREATED token. */
function undoPin(op: PinOp, resolve: Resolve, exists: Exists): Intent[] {
  if (!op.pinnedBefore) {
    // Recorded action was a pin → undo unpins.
    return [{ kind: 'unpin', mealId: op.mealId, id: resolve(op.entryId) }];
  }
  if (exists(resolve(op.entryId))) {
    return [{ kind: 'pin', mealId: op.mealId, id: resolve(op.entryId) }];
  }
  return [
    {
      kind: 'create',
      mealId: op.mealId,
      body: createBodyFrom(op.snapshot),
      bindRemapFor: op.entryId,
    },
    { kind: 'pin', mealId: op.mealId, id: CREATED },
  ];
}

export function reconcileUndo(op: Op, resolve: Resolve, exists: Exists): Intent[] {
  switch (op.type) {
    case 'add':
      return [{ kind: 'remove', mealId: op.mealId, id: resolve(op.entryId) }];
    case 'remove':
      return [
        {
          kind: 'create',
          mealId: op.mealId,
          body: createBodyFrom(op.snapshot),
          bindRemapFor: op.entryId,
        },
      ];
    case 'update':
      return [{ kind: 'update', mealId: op.mealId, id: resolve(op.entryId), body: op.before }];
    case 'reorder':
      return [{ kind: 'reorder', mealId: op.mealId, order: mapOrder(op.before, resolve) }];
    case 'move':
      // The line now lives in the target meal; move it back to the source row.
      return [
        {
          kind: 'move',
          mealId: op.targetMealId,
          id: resolve(op.entryId),
          targetMealId: op.mealId,
          orderIndex: op.fromOrderIndex,
        },
      ];
    case 'pin':
      return undoPin(op, resolve, exists);
  }
}

export function reconcileRedo(op: Op, resolve: Resolve): Intent[] {
  switch (op.type) {
    case 'add':
      return [
        {
          kind: 'create',
          mealId: op.mealId,
          body: createBodyFrom(op.snapshot),
          bindRemapFor: op.entryId,
        },
      ];
    case 'remove':
      return [{ kind: 'remove', mealId: op.mealId, id: resolve(op.entryId) }];
    case 'update':
      return [{ kind: 'update', mealId: op.mealId, id: resolve(op.entryId), body: op.after }];
    case 'reorder':
      return [{ kind: 'reorder', mealId: op.mealId, order: mapOrder(op.after, resolve) }];
    case 'move':
      return [
        {
          kind: 'move',
          mealId: op.mealId,
          id: resolve(op.entryId),
          targetMealId: op.targetMealId,
          orderIndex: op.toOrderIndex,
        },
      ];
    case 'pin':
      // Re-apply the recorded toggle: pinnedBefore=false → pin again; true → unpin again.
      return op.pinnedBefore
        ? [{ kind: 'unpin', mealId: op.mealId, id: resolve(op.entryId) }]
        : [{ kind: 'pin', mealId: op.mealId, id: resolve(op.entryId) }];
  }
}
