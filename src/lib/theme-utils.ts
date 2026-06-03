/**
 * Theme-aware color tokens from design-tokens.css (light + dark via CSS variables)
 */

export function useThemeStyles() {
  return {
    containerBg: 'hsl(var(--card))',
    cellBg: 'hsl(var(--card))',
    border: 'hsl(var(--border))',
    borderSecondary: 'hsl(var(--muted))',
    text: 'hsl(var(--foreground))',
    textSecondary: 'hsl(var(--muted-foreground))',
    primary: 'hsl(var(--primary))',
    success: 'hsl(var(--success))',
    successBg: 'hsl(var(--success) / 0.15)',
    successBorder: 'hsl(var(--success) / 0.35)',
    error: 'hsl(var(--destructive))',
    errorBg: 'hsl(var(--destructive) / 0.15)',
    errorBorder: 'hsl(var(--destructive) / 0.35)',
    warning: 'hsl(var(--warning))',
    warningBg: 'hsl(var(--warning) / 0.15)',
    warningBorder: 'hsl(var(--warning) / 0.35)',
    info: 'hsl(var(--primary))',
    infoBg: 'hsl(var(--primary) / 0.1)',
    infoBorder: 'hsl(var(--primary) / 0.25)',
  }
}

export function useContainerBg() {
  return 'hsl(var(--card))'
}

export function useCellBg() {
  return 'hsl(var(--card))'
}

export function useBorderColor() {
  return 'hsl(var(--border))'
}
