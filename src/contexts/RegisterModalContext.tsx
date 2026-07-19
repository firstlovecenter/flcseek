'use client'

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { useParams, usePathname, useRouter, useSearchParams } from 'next/navigation'
import { RegisterConvertDialog } from '@/components/group/RegisterConvertDialog'
import { OPEN_REGISTER_EVENT } from '@/components/shell/mobileNav'

type OpenRegisterOptions = {
  onSuccess?: () => void
  onClose?: () => void
}

type RegisterModalContextValue = {
  openRegister: (options?: OpenRegisterOptions) => void
}

const RegisterModalContext = createContext<RegisterModalContextValue | null>(
  null
)

export function RegisterModalProvider({ children }: { children: ReactNode }) {
  const params = useParams()
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const groupId = (params?.groupId as string) || ''
  const [open, setOpen] = useState(false)
  const onSuccessRef = useRef<(() => void) | undefined>(undefined)
  const onCloseRef = useRef<(() => void) | undefined>(undefined)

  const openRegister = useCallback((options?: OpenRegisterOptions) => {
    onSuccessRef.current = options?.onSuccess
    onCloseRef.current = options?.onClose
    setOpen(true)
  }, [])

  useEffect(() => {
    const onOpen = () => openRegister()
    window.addEventListener(OPEN_REGISTER_EVENT, onOpen)
    return () => window.removeEventListener(OPEN_REGISTER_EVENT, onOpen)
  }, [openRegister])

  // Support /[groupId]?register=1 (and redirects from the legacy register page).
  useEffect(() => {
    if (!groupId) return
    if (searchParams.get('register') !== '1') return
    openRegister()
    router.replace(pathname)
  }, [groupId, searchParams, openRegister, router, pathname])

  const handleOpenChange = useCallback((next: boolean) => {
    setOpen(next)
    if (!next) {
      onCloseRef.current?.()
      onCloseRef.current = undefined
      onSuccessRef.current = undefined
    }
  }, [])

  const handleSuccess = useCallback(() => {
    onSuccessRef.current?.()
    onSuccessRef.current = undefined
    window.dispatchEvent(new CustomEvent('flcseek:convert-registered'))
  }, [])

  return (
    <RegisterModalContext.Provider value={{ openRegister }}>
      {children}
      {groupId ? (
        <RegisterConvertDialog
          groupId={groupId}
          open={open}
          onOpenChange={handleOpenChange}
          onSuccess={handleSuccess}
        />
      ) : null}
    </RegisterModalContext.Provider>
  )
}

export function useRegisterModal() {
  const ctx = useContext(RegisterModalContext)
  if (!ctx) {
    throw new Error('useRegisterModal must be used within RegisterModalProvider')
  }
  return ctx
}
