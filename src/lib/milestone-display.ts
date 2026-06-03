import type { MilestoneData } from '@/lib/types/api-responses';

export type DisplayMilestone = {
  number: number;
  name: string;
  shortName: string;
  description?: string;
  isAutoCalculated: boolean;
};

/** Format API milestone rows for grid/table headers (shared across pages). */
export function formatMilestonesForDisplay(
  milestoneData: MilestoneData[]
): DisplayMilestone[] {
  return milestoneData.map((milestone) => {
    let formattedShortName =
      milestone.short_name || milestone.stage_name.substring(0, 10);
    if (milestone.short_name && !formattedShortName.includes('\n')) {
      const words = milestone.short_name
        .split(/[\s,\/]+/)
        .filter((w: string) => w.length > 0);
      if (words.length > 1) {
        const midpoint = Math.ceil(words.length / 2);
        formattedShortName = `${words.slice(0, midpoint).join(' ')}\n${words.slice(midpoint).join(' ')}`;
      }
    }
    return {
      number: milestone.stage_number,
      name: milestone.stage_name,
      shortName: formattedShortName,
      description: milestone.description,
      isAutoCalculated: milestone.is_auto_calculated || false,
    };
  });
}
