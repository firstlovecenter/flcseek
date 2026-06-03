'use client'

import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { UserPlus } from 'lucide-react'
import { api } from '@/lib/api'
import { message } from '@/lib/toast'
import {
  registerConvertSchema,
  type RegisterConvertFormValues,
} from '@/lib/schemas/register-convert'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { DialogFooter } from '@/components/ui/dialog'

type RegisterConvertFormProps = {
  groupId: string
  variant?: 'page' | 'modal'
  onSuccess?: () => void
  onCancel?: () => void
}

export function RegisterConvertForm({
  groupId,
  variant = 'page',
  onSuccess,
  onCancel,
}: RegisterConvertFormProps) {
  const [loading, setLoading] = useState(false)
  const [groups, setGroups] = useState<
    { id: string; name: string; year: number }[]
  >([])

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    reset,
    formState: { errors },
  } = useForm<RegisterConvertFormValues>({
    resolver: zodResolver(registerConvertSchema),
    defaultValues: { group_id: groupId },
  })

  useEffect(() => {
    void (async () => {
      try {
        const response = await api.groups.list()
        if (response.success) {
          setGroups(response.data?.groups || [])
        }
      } catch (error) {
        console.error('Failed to fetch groups:', error)
      }
    })()
  }, [])

  useEffect(() => {
    if (groupId) {
      setValue('group_id', groupId)
    }
  }, [groupId, groups.length, setValue])

  const onSubmit = async (values: RegisterConvertFormValues) => {
    setLoading(true)
    try {
      const response = await api.people.create(values)
      if (!response.success) {
        throw new Error(response.error?.message || 'Failed to register person')
      }
      message.success('Person registered successfully!')
      reset({ group_id: groupId })
      onSuccess?.()
    } catch (error: unknown) {
      const errorMsg =
        error instanceof Error ? error.message : 'Failed to register person'
      if (errorMsg.includes('phone number') && errorMsg.includes('already')) {
        message.error(
          'This phone number is already registered. Each person must have a unique phone number.'
        )
      } else if (
        errorMsg.includes('group_id') ||
        errorMsg.includes('Invalid group')
      ) {
        message.error(
          'Invalid group selection. Please select a valid group and try again.'
        )
      } else if (errorMsg.includes('required')) {
        message.warning(`Missing required field: ${errorMsg}`)
      } else {
        message.error(`Registration failed: ${errorMsg}`)
      }
    } finally {
      setLoading(false)
    }
  }

  const gender = watch('gender')
  const occupation = watch('occupation_type')
  const groupIdValue = watch('group_id')

  const fields = (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="first_name">First Name</Label>
        <Input id="first_name" placeholder="John" {...register('first_name')} />
        {errors.first_name && (
          <p className="text-xs text-destructive">{errors.first_name.message}</p>
        )}
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="last_name">Last Name</Label>
        <Input id="last_name" placeholder="Doe" {...register('last_name')} />
        {errors.last_name && (
          <p className="text-xs text-destructive">{errors.last_name.message}</p>
        )}
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="phone_number">Phone Number</Label>
        <Input
          id="phone_number"
          placeholder="+233 123 456 789"
          {...register('phone_number')}
        />
        {errors.phone_number && (
          <p className="text-xs text-destructive">
            {errors.phone_number.message}
          </p>
        )}
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="date_of_birth">Date of Birth (DD-MM)</Label>
        <Input
          id="date_of_birth"
          placeholder="15-03"
          maxLength={5}
          {...register('date_of_birth')}
        />
        <p className="text-xs text-muted-foreground">
          Pick the day and month (year is not stored). Format: DD-MM
        </p>
        {errors.date_of_birth && (
          <p className="text-xs text-destructive">
            {errors.date_of_birth.message}
          </p>
        )}
      </div>
      <div className="space-y-1.5">
        <Label>Gender</Label>
        <Select
          value={gender}
          onValueChange={(v) =>
            setValue('gender', v as RegisterConvertFormValues['gender'])
          }
        >
          <SelectTrigger>
            <SelectValue placeholder="Select gender" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="Male">Male</SelectItem>
            <SelectItem value="Female">Female</SelectItem>
          </SelectContent>
        </Select>
        {errors.gender && (
          <p className="text-xs text-destructive">{errors.gender.message}</p>
        )}
      </div>
      <div className="space-y-1.5">
        <Label>Worker or Student</Label>
        <Select
          value={occupation}
          onValueChange={(v) =>
            setValue(
              'occupation_type',
              v as RegisterConvertFormValues['occupation_type']
            )
          }
        >
          <SelectTrigger>
            <SelectValue placeholder="Select worker or student" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="Worker">Worker</SelectItem>
            <SelectItem value="Student">Student</SelectItem>
            <SelectItem value="Unemployed">Unemployed</SelectItem>
          </SelectContent>
        </Select>
        {errors.occupation_type && (
          <p className="text-xs text-destructive">
            {errors.occupation_type.message}
          </p>
        )}
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="residential_location">Residential Location</Label>
        <Input
          id="residential_location"
          placeholder="e.g., Accra, Ghana"
          {...register('residential_location')}
        />
        {errors.residential_location && (
          <p className="text-xs text-destructive">
            {errors.residential_location.message}
          </p>
        )}
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="school_residential_location">
          School Residential Location (if applicable)
        </Label>
        <Input
          id="school_residential_location"
          placeholder="e.g., KNUST Campus"
          {...register('school_residential_location')}
        />
      </div>
      <div className="space-y-1.5">
        <Label>Group</Label>
        <Select value={groupIdValue} disabled>
          <SelectTrigger>
            <SelectValue placeholder="Select group" />
          </SelectTrigger>
          <SelectContent>
            {groups.map((group) => (
              <SelectItem key={group.id} value={group.id}>
                {group.name} ({group.year})
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  )

  if (variant === 'modal') {
    return (
      <form
        onSubmit={handleSubmit(onSubmit)}
        className="flex min-h-0 flex-1 flex-col"
      >
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-6 py-4">
          {fields}
        </div>
        <DialogFooter className="shrink-0 border-t px-6 py-4">
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancel
          </Button>
          <Button type="submit" disabled={loading}>
            <UserPlus className="size-4" />
            Register Convert
          </Button>
        </DialogFooter>
      </form>
    )
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      {fields}
      <Button type="submit" className="w-full" disabled={loading}>
        <UserPlus className="size-4" />
        Register Convert
      </Button>
    </form>
  )
}
