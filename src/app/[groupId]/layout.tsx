import { Suspense } from 'react'
import { RegisterModalProvider } from '@/contexts/RegisterModalContext'

export default function GroupLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <Suspense fallback={null}>
      <RegisterModalProvider>{children}</RegisterModalProvider>
    </Suspense>
  )
}
