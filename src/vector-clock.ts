/**
 * Vector clock comparison utilities.
 *
 * Used by both the client database and server adapters to determine
 * the causal relationship between two operations.
 */

export type ClockRelation = 'before' | 'after' | 'equal' | 'concurrent';

/**
 * Compare vector clock `a` against `b`.
 *
 * - 'before'     — a happened-before b (every entry of a ≤ b, at least one strictly less)
 * - 'after'      — a happened-after b (mirror)
 * - 'equal'      — same causal point
 * - 'concurrent' — neither dominates; concurrent edits → real conflict
 */
export function compareVectorClocks(
  a: Record<string, number>,
  b: Record<string, number>
): ClockRelation {
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
  let aGreater = false;
  let bGreater = false;

  for (const key of keys) {
    const va = a[key] || 0;
    const vb = b[key] || 0;
    if (va > vb) aGreater = true;
    if (vb > va) bGreater = true;
  }

  if (aGreater && bGreater) return 'concurrent';
  if (aGreater) return 'after';
  if (bGreater) return 'before';
  return 'equal';
}
