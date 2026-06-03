import { toast as sonnerToast } from 'sonner'

export const toast = {
  success: (message: string, description?: string) =>
    sonnerToast.success(message, { description }),
  error: (message: string, description?: string) =>
    sonnerToast.error(message, { description }),
  warning: (message: string, description?: string) =>
    sonnerToast.warning(message, { description }),
  info: (message: string, description?: string) =>
    sonnerToast.info(message, { description }),
  loading: (message: string) => sonnerToast.loading(message),
  dismiss: (id?: string | number) => sonnerToast.dismiss(id),
  promise: sonnerToast.promise,
}

/** Drop-in replacement for antd `message` API */
export const message = {
  success: (content: string) => toast.success(content),
  error: (content: string) => toast.error(content),
  warning: (content: string) => toast.warning(content),
  info: (content: string) => toast.info(content),
  loading: (content: string) => toast.loading(content),
}
