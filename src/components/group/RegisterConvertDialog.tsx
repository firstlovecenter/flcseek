'use client'

import { UserPlus } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { RegisterConvertForm } from '@/components/group/RegisterConvertForm'

export function RegisterConvertDialog({
  groupId,
  open,
  onOpenChange,
  onSuccess,
}: {
  groupId: string
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess?: () => void
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[90vh] max-w-md flex-col gap-0 overflow-hidden p-0">
        <DialogHeader className="shrink-0 border-b px-6 py-4">
          <DialogTitle className="flex items-center gap-2">
            <UserPlus className="size-5" />
            Register New Convert
          </DialogTitle>
        </DialogHeader>
        <RegisterConvertForm
          groupId={groupId}
          variant="modal"
          onCancel={() => onOpenChange(false)}
          onSuccess={() => {
            onOpenChange(false)
            onSuccess?.()
          }}
        />
      </DialogContent>
    </Dialog>
  )
}
