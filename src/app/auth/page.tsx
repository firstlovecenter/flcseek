'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { SynagoLogo } from '@/components/shell/SynagoLogo'
import { ThemeToggle } from '@/components/shell/ThemeToggle'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Lock, User } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { LoadingScreen } from '@/components/base/LoadingScreen'
import { toast } from '@/lib/toast'

const loginSchema = z.object({
  username: z.string().min(1, 'Username is required'),
  password: z.string().min(1, 'Password is required'),
})

type LoginForm = z.infer<typeof loginSchema>

export default function LoginPage() {
  const { login, user, loading } = useAuth()
  const router = useRouter()
  const [submitting, setSubmitting] = useState(false)

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
  })

  useEffect(() => {
    if (!loading && user) {
      if (user.role === 'superadmin') router.push('/superadmin')
      else if (user.role === 'leadpastor' || user.role === 'overseer')
        router.push('/leadpastor')
      else if (user.role === 'admin' || user.role === 'leader')
        router.push(user.group_id ? `/${user.group_id}` : '/')
      else router.push('/')
    }
  }, [user, loading, router])

  const onSubmit = async (values: LoginForm) => {
    setSubmitting(true)
    try {
      await login(values.username.trim(), values.password)
      toast.success('Signed in')
    } catch (error: unknown) {
      toast.error(
        error instanceof Error ? error.message : 'Sign in failed'
      )
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <div className="relative min-h-[100dvh] bg-background">
        <div className="absolute top-4 right-4 z-10 safe-area-top">
          <ThemeToggle />
        </div>
        <LoadingScreen fullScreen label="Checking session…" />
      </div>
    )
  }

  return (
    <div className="relative flex min-h-[100dvh] items-center justify-center bg-background p-4">
      <div className="absolute top-4 right-4 z-10 safe-area-top">
        <ThemeToggle />
      </div>
      <Card className="w-full max-w-md shadow-sm">
        <CardHeader className="space-y-4 text-center">
          <div className="mx-auto flex size-16 items-center justify-center">
            <SynagoLogo size={48} surface="auto" priority />
          </div>
          <div className="space-y-1">
            <CardTitle className="text-2xl tracking-tight">Seek</CardTitle>
            <CardDescription>Sheep seeking milestone tracker</CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="username">Username or email</Label>
              <div className="relative">
                <User className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="username"
                  className="min-h-11 pl-9"
                  placeholder="Enter username"
                  aria-invalid={!!errors.username}
                  {...register('username')}
                />
              </div>
              {errors.username && (
                <p className="text-xs text-destructive">
                  {errors.username.message}
                </p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="password">Password</Label>
              <div className="relative">
                <Lock className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="password"
                  type="password"
                  className="min-h-11 pl-9"
                  placeholder="Enter password"
                  aria-invalid={!!errors.password}
                  {...register('password')}
                />
              </div>
              {errors.password && (
                <p className="text-xs text-destructive">
                  {errors.password.message}
                </p>
              )}
            </div>
            <Button
              type="submit"
              className="min-h-11 w-full"
              disabled={submitting}
            >
              {submitting ? 'Signing in…' : 'Sign in'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
