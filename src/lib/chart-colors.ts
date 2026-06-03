/**
 * Resolved hex colors for Recharts (SVG fill/stroke does not reliably use CSS variables).
 * Values mirror design-tokens.css HSL channel triplets.
 */
export const CHART_HEX = {
  primary: '#ff4d6d',
  members: '#26a69a',
  churches: '#7c5cbf',
  campaigns: '#9b59b6',
  success: '#22c55e',
  warning: '#f59e0b',
  destructive: '#ef4444',
  muted: '#cbd5e1',
  grid: '#d1d5db',
  series: ['#ff4d6d', '#26a69a', '#7c5cbf', '#22c55e', '#f59e0b', '#3b82f6', '#8b5cf6'],
} as const;
