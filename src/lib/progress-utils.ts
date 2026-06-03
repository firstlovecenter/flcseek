/**
 * Helpers for compact progress payloads (completed stage numbers only).
 */

export type ProgressCell = { stage_number: number; is_completed: boolean };

/** Expand server `completed_stages` into the grid shape the UI expects. */
export function expandCompletedStages(
  completedStages: number[],
  stageNumbers: number[]
): ProgressCell[] {
  const done = new Set(completedStages);
  return stageNumbers.map((stage_number) => ({
    stage_number,
    is_completed: done.has(stage_number),
  }));
}
