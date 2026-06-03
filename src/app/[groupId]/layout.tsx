import { RegisterModalProvider } from '@/contexts/RegisterModalContext'

export default function GroupLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return <RegisterModalProvider>{children}</RegisterModalProvider>
}
