'use client';

import { ConfigProvider, theme } from 'antd';
import { ReactNode, createContext, useContext, useState, useEffect } from 'react';

interface ThemeContextType {
  isDark: boolean;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextType>({
  isDark: true,
  toggleTheme: () => {},
});

export const useTheme = () => useContext(ThemeContext);

export default function AppConfigProvider({ children }: { children: ReactNode }) {
  const [isDark, setIsDark] = useState(false); // Default to light theme

  // Load theme preference from localStorage
  useEffect(() => {
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme) {
      setIsDark(savedTheme === 'dark');
    }
  }, []);

  // Apply theme class to body
  useEffect(() => {
    if (isDark) {
      document.body.classList.remove('light-theme');
    } else {
      document.body.classList.add('light-theme');
    }
  }, [isDark]);

  const toggleTheme = () => {
    const newTheme = !isDark;
    setIsDark(newTheme);
    localStorage.setItem('theme', newTheme ? 'dark' : 'light');
  };

  return (
    <ThemeContext.Provider value={{ isDark, toggleTheme }}>
      <ConfigProvider
        theme={{
          algorithm: isDark ? theme.darkAlgorithm : theme.defaultAlgorithm,
          token: {
            // Primary colors - using app's brand color #003366
            colorPrimary: isDark ? '#4096ff' : '#003366',
            colorPrimaryHover: isDark ? '#69b1ff' : '#004080',
            colorPrimaryActive: isDark ? '#1677ff' : '#002952',
            
            // Success, Error, Warning - enhanced contrast
            colorSuccess: isDark ? '#73d13d' : '#52c41a',
            colorSuccessBg: isDark ? '#162312' : '#f6ffed',
            colorSuccessBorder: isDark ? '#274916' : '#b7eb8f',
            
            colorError: isDark ? '#ff7875' : '#ff4d4f',
            colorErrorBg: isDark ? '#2a1215' : '#fff1f0',
            colorErrorBorder: isDark ? '#58181c' : '#ffccc7',
            
            colorWarning: isDark ? '#ffc53d' : '#faad14',
            colorWarningBg: isDark ? '#2b2111' : '#fffbe6',
            colorWarningBorder: isDark ? '#594214' : '#ffe58f',
            
            colorInfo: isDark ? '#4096ff' : '#003366',
            colorInfoBg: isDark ? '#111d2c' : '#f0f5ff',
            colorInfoBorder: isDark ? '#15395b' : '#adc6ff',
            
            // Links
            colorLink: isDark ? '#4096ff' : '#003366',
            colorLinkHover: isDark ? '#69b1ff' : '#004080',
            colorLinkActive: isDark ? '#1677ff' : '#002952',
            
            // Backgrounds - better contrast
            colorBgContainer: isDark ? '#1f1f1f' : '#ffffff',
            colorBgElevated: isDark ? '#262626' : '#ffffff',
            colorBgLayout: isDark ? '#0a0a0a' : '#f5f7fa',
            colorBgSpotlight: isDark ? '#424242' : '#ffffff',
            colorBgMask: isDark ? 'rgba(0, 0, 0, 0.65)' : 'rgba(0, 0, 0, 0.45)',
            
            // Borders - improved visibility
            colorBorder: isDark ? '#434343' : '#d9d9d9',
            colorBorderSecondary: isDark ? '#303030' : '#f0f0f0',
            
            // Text colors - WCAG AA compliant
            colorText: isDark ? 'rgba(255, 255, 255, 0.92)' : 'rgba(0, 0, 0, 0.88)',
            colorTextSecondary: isDark ? 'rgba(255, 255, 255, 0.75)' : 'rgba(0, 0, 0, 0.65)',
            colorTextTertiary: isDark ? 'rgba(255, 255, 255, 0.55)' : 'rgba(0, 0, 0, 0.45)',
            colorTextQuaternary: isDark ? 'rgba(255, 255, 255, 0.35)' : 'rgba(0, 0, 0, 0.25)',
            colorTextDisabled: isDark ? 'rgba(255, 255, 255, 0.25)' : 'rgba(0, 0, 0, 0.25)',
            
            // Fills
            colorFill: isDark ? 'rgba(255, 255, 255, 0.18)' : 'rgba(0, 0, 0, 0.06)',
            colorFillSecondary: isDark ? 'rgba(255, 255, 255, 0.12)' : 'rgba(0, 0, 0, 0.04)',
            colorFillTertiary: isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.03)',
            colorFillQuaternary: isDark ? 'rgba(255, 255, 255, 0.04)' : 'rgba(0, 0, 0, 0.02)',
            
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
    </ThemeContext.Provider>
  );
}
