'use client';

import { ConfigProvider, theme } from 'antd';
import { ReactNode, useState } from 'react';

export default function AppConfigProvider({ children }: { children: ReactNode }) {
  const [isDark, setIsDark] = useState(false);

  return (
    <ConfigProvider
      theme={{
        algorithm: isDark ? theme.darkAlgorithm : theme.defaultAlgorithm,
        token: {
          colorPrimary: '#003366',
          colorSuccess: '#00b300',
          colorError: '#e60000',
          borderRadius: 6,
        },
      }}
    >
      {children}
    </ConfigProvider>
  );
}
