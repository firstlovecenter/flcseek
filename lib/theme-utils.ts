/**
 * Theme utility functions for consistent styling across the app
 * Provides theme-aware colors that work in both light and dark modes
 */

import { theme } from 'antd';

const { useToken } = theme;

/**
 * Get theme-aware background color for containers
 * Replaces hardcoded 'white' or '#ffffff'
 */
export function useContainerBg() {
  const { token } = useToken();
  return token.colorBgContainer;
}

/**
 * Get theme-aware cell/card background colors for switches/status indicators
 * Replaces hardcoded 'white' in milestone cells
 */
export function useCellBg() {
  const { token } = useToken();
  return token.colorBgElevated;
}

/**
 * Get theme-aware border color
 */
export function useBorderColor() {
  const { token } = useToken();
  return token.colorBorder;
}

/**
 * Hook to get all common theme-aware styles
 */
export function useThemeStyles() {
  const { token } = useToken();
  
  return {
    containerBg: token.colorBgContainer,
    cellBg: token.colorBgElevated,
    border: token.colorBorder,
    borderSecondary: token.colorBorderSecondary,
    text: token.colorText,
    textSecondary: token.colorTextSecondary,
    primary: token.colorPrimary,
    success: token.colorSuccess,
    successBg: token.colorSuccessBg,
    successBorder: token.colorSuccessBorder,
    error: token.colorError,
    errorBg: token.colorErrorBg,
    errorBorder: token.colorErrorBorder,
    warning: token.colorWarning,
    warningBg: token.colorWarningBg,
    warningBorder: token.colorWarningBorder,
    info: token.colorInfo,
    infoBg: token.colorInfoBg,
    infoBorder: token.colorInfoBorder,
  };
}
