'use client';

import { ConfigProvider, theme } from 'antd';
import { ReactNode } from 'react';

export default function AppConfigProvider({ children }: { children: ReactNode }) {
  return (
    <ConfigProvider
      theme={{
        algorithm: theme.darkAlgorithm,
        token: {
          colorPrimary: '#1890ff',
          colorSuccess: '#52c41a',
          colorError: '#ff4d4f',
          colorBgContainer: '#141414',
          colorBgElevated: '#1f1f1f',
          borderRadius: 6,
        },
      }}
    >
      {children}
    </ConfigProvider>
  );
}
