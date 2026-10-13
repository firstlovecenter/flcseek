'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { SynagoLogo } from '@/components/shell/SynagoLogo'
import { ThemeToggle } from '@/components/shell/ThemeToggle'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Lock, User } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { landingPathFor } from '@/lib/app-routing'
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
import { OrbField } from '@/components/base/Orbs'
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
    // Already signed in: where signing in would take them (the portal chooser for those with both).
    if (!loading && user) router.push(landingPathFor(user))
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
    <div className="relative isolate flex min-h-[100dvh] items-center justify-center overflow-hidden bg-background p-4">
      <OrbField className="-z-10" />
      <div className="absolute top-4 right-4 z-10 safe-area-top">
        <ThemeToggle />
      </div>
      <Card className="w-full max-w-md bg-card/85 shadow-sm backdrop-blur-sm">
        <CardHeader className="space-y-4 text-center">
          <div className="mx-auto flex size-16 items-center justify-center">
            <SynagoLogo size={48} surface="auto" priority />
          </div>
          <div className="space-y-1">
            <CardTitle className="text-2xl tracking-tight">Seek City Church Family</CardTitle>
            <CardDescription>Convert Milestone Tracker</CardDescription>
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
                  placeholder="Enter username or email"
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
              <div className="flex items-center justify-between gap-2">
                <Label htmlFor="password">Password</Label>
                <Link href="/forgot-password" className="text-xs font-medium text-primary hover:underline">
                  Forgot password?
                </Link>
              </div>
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
