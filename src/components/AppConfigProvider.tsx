'use client';

import { ConfigProvider, theme } from 'antd';
import { ReactNode } from 'react';

export default function AppConfigProvider({ children }: { children: ReactNode }) {
  return (
    <ConfigProvider
      theme={{
        algorithm: theme.defaultAlgorithm,
        token: {
          // Primary colors - using app's brand color #003366
          colorPrimary: '#003366',
          colorPrimaryHover: '#004080',
          colorPrimaryActive: '#002952',

          // Success, Error, Warning - enhanced contrast
          colorSuccess: '#52c41a',
          colorSuccessBg: '#f6ffed',
          colorSuccessBorder: '#b7eb8f',

          colorError: '#ff4d4f',
          colorErrorBg: '#fff1f0',
          colorErrorBorder: '#ffccc7',

          colorWarning: '#faad14',
          colorWarningBg: '#fffbe6',
          colorWarningBorder: '#ffe58f',

          colorInfo: '#003366',
          colorInfoBg: '#f0f5ff',
          colorInfoBorder: '#adc6ff',

          // Links
          colorLink: '#003366',
          colorLinkHover: '#004080',
          colorLinkActive: '#002952',

          // Backgrounds - better contrast
          colorBgContainer: '#ffffff',
          colorBgElevated: '#ffffff',
          colorBgLayout: '#f5f7fa',
          colorBgSpotlight: '#ffffff',
          colorBgMask: 'rgba(0, 0, 0, 0.45)',

          // Borders - improved visibility
          colorBorder: '#d9d9d9',
          colorBorderSecondary: '#f0f0f0',

          // Text colors - WCAG AA compliant
          colorText: 'rgba(0, 0, 0, 0.88)',
          colorTextSecondary: 'rgba(0, 0, 0, 0.65)',
          colorTextTertiary: 'rgba(0, 0, 0, 0.45)',
          colorTextQuaternary: 'rgba(0, 0, 0, 0.25)',
          colorTextDisabled: 'rgba(0, 0, 0, 0.25)',

          // Fills
          colorFill: 'rgba(0, 0, 0, 0.06)',
          colorFillSecondary: 'rgba(0, 0, 0, 0.04)',
          colorFillTertiary: 'rgba(0, 0, 0, 0.03)',
          colorFillQuaternary: 'rgba(0, 0, 0, 0.02)',

          borderRadius: 6,
          fontSize: 14,
          fontSizeHeading1: 38,
          fontSizeHeading2: 30,
          fontSizeHeading3: 24,
          fontSizeHeading4: 20,
          fontSizeHeading5: 16,
        },
      }}
    >
      {children}
    </ConfigProvider>
  );
}
