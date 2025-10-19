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
            colorPrimary: isDark ? '#40a9ff' : '#1890ff',
            colorSuccess: '#52c41a',
            colorError: '#ff4d4f',
            colorWarning: '#faad14',
            colorInfo: isDark ? '#40a9ff' : '#1890ff',
            colorLink: isDark ? '#69c0ff' : '#1890ff',
            colorLinkHover: isDark ? '#91d5ff' : '#40a9ff',
            // Dark mode colors
            colorBgContainer: isDark ? '#1f1f1f' : '#ffffff',
            colorBgElevated: isDark ? '#2a2a2a' : '#ffffff',
            colorBgLayout: isDark ? '#141414' : '#f5f5f5',
            colorBorder: isDark ? '#424242' : '#d9d9d9',
            colorBorderSecondary: isDark ? '#303030' : '#f0f0f0',
            // Text colors with better contrast
            colorText: isDark ? 'rgba(255, 255, 255, 0.88)' : 'rgba(0, 0, 0, 0.88)',
            colorTextSecondary: isDark ? 'rgba(255, 255, 255, 0.70)' : 'rgba(0, 0, 0, 0.65)',
            colorTextTertiary: isDark ? 'rgba(255, 255, 255, 0.50)' : 'rgba(0, 0, 0, 0.45)',
            colorTextDisabled: isDark ? 'rgba(255, 255, 255, 0.30)' : 'rgba(0, 0, 0, 0.25)',
            borderRadius: 6,
            fontSize: 14,
          },
        }}
      >
        {children}
      </ConfigProvider>
    </ThemeContext.Provider>
  );
}
