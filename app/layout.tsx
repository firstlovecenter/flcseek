import './globals.css';
import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import { AntdRegistry } from '@ant-design/nextjs-registry';
import { AuthProvider } from '@/contexts/AuthContext';
import AppConfigProvider from '@/components/AppConfigProvider';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'FLC Sheep Seeking',
  description: 'Church progress tracking system for FLC',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <AntdRegistry>
          <AppConfigProvider>
            <AuthProvider>{children}</AuthProvider>
          </AppConfigProvider>
        </AntdRegistry>
      </body>
    </html>
  );
}
