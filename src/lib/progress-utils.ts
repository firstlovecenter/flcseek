/**
 * Helpers for compact progress payloads (completed stage numbers only).
 */

export type ProgressCell = { stage_number: number; is_completed: boolean };

type PersonProgressSource = {
  progress?: ProgressCell[];
  completed_stages?: number | number[];
};

/** Normalise API person rows (grid or progress include) into progress cells. */
export function personProgressCells(
  person: PersonProgressSource,
  stageNumbers: number[]
): ProgressCell[] {
  if (person.progress?.length) {
    return person.progress;
  }
  const completed = person.completed_stages;
  if (Array.isArray(completed)) {
    return expandCompletedStages(completed, stageNumbers);
  }
  return [];
}

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
