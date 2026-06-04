// Transitive cycle guard (spec/logic/recipes-derived-food.md §2, RECONCILIATION_LOG §C2).
// Adding ingredient R to recipe E is forbidden if R == E OR E is reachable from R through
// the recipe→recipe ingredient graph (A→B→…→E). Pure: the caller supplies the adjacency
// (recipe id → set of recipe ids it references) read from the repo, excluding E's own
// outgoing edges since those are being replaced by the save.

export type Adjacency = Map<string, Set<string>>;

/** Is `target` reachable from `start` (inclusive of start === target) in the graph? */
export function isReachable(start: string, target: string, adjacency: Adjacency): boolean {
  if (start === target) return true;
  const seen = new Set<string>();
  const stack = [start];
  while (stack.length > 0) {
    const node = stack.pop();
    if (node === undefined || seen.has(node)) continue;
    seen.add(node);
    const neighbours = adjacency.get(node);
    if (!neighbours) continue;
    for (const next of neighbours) {
      if (next === target) return true;
      stack.push(next);
    }
  }
  return false;
}

/**
 * Would adding edge `editingRecipeId → candidateRecipeId` (recipe E references recipe R)
 * create a cycle? True when R == E, or when E is already reachable from R.
 */
export function wouldCreateCycle(
  editingRecipeId: string,
  candidateRecipeId: string,
  adjacency: Adjacency,
): boolean {
  return isReachable(candidateRecipeId, editingRecipeId, adjacency);
}
