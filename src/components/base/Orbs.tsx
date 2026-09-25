'use client'

import { useEffect, useState } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { cn } from '@/lib/utils'

/**
 * Soft glowing orbs: blurred radial gradients moved with Motion (no WebGL, no
 * extra library). Decorative only: hidden from assistive tech, never in the
 * way of clicks, and still when the device asks for reduced motion.
 *
 * Colours are theme tokens (HSL channel triplets), e.g. 'members', 'primary'.
 */

type Token = 'primary' | 'members' | 'churches' | 'arrivals' | 'success' | 'campaigns' | 'maps'

const glow = (token: Token, alpha: number) => `radial-gradient(circle at 50% 50%, hsl(var(--${token}) / ${alpha}), transparent 68%)`

/** A few large orbs drifting slowly behind a page. The parent must be `relative` (and usually `overflow-hidden`). */
export function OrbField({ colors = ['primary', 'members', 'churches'], className, intensity = 0.35 }: { colors?: Token[]; className?: string; intensity?: number }) {
  const still = useReducedMotion()
  const spots = [
    { top: '-18%', left: '-12%', size: '62vmax', drift: [0, 60, -30, 0], y: [0, 40, 70, 0], duration: 26 },
    { top: '35%', left: '55%', size: '52vmax', drift: [0, -70, 20, 0], y: [0, -50, 30, 0], duration: 32 },
    { top: '70%', left: '-5%', size: '44vmax', drift: [0, 50, 80, 0], y: [0, -30, -60, 0], duration: 38 },
  ]
  return (
    <div aria-hidden className={cn('pointer-events-none absolute inset-0 overflow-hidden', className)}>
      {spots.slice(0, colors.length).map((s, i) => (
        <motion.div
          key={i}
          className="absolute rounded-full blur-3xl"
          style={{ top: s.top, left: s.left, width: s.size, height: s.size, background: glow(colors[i], intensity) }}
          animate={still ? undefined : { x: s.drift, y: s.y, scale: [1, 1.08, 0.96, 1] }}
          transition={{ duration: s.duration, repeat: Infinity, ease: 'easeInOut' }}
        />
      ))}
    </div>
  )
}

/** A small breathing orb: the AI is working on something. */
export function ThinkingOrb({ className, color = 'primary' }: { className?: string; color?: Token }) {
  const still = useReducedMotion()
  return (
    <span aria-hidden className={cn('relative inline-flex size-4 shrink-0 items-center justify-center', className)}>
      <motion.span
        className="absolute inset-0 rounded-full blur-[3px]"
        style={{ background: glow(color, 0.9) }}
        animate={still ? undefined : { scale: [0.8, 1.35, 0.8], opacity: [0.55, 1, 0.55] }}
        transition={{ duration: 1.8, repeat: Infinity, ease: 'easeInOut' }}
      />
      <span className="relative size-1.5 rounded-full" style={{ background: `hsl(var(--${color}))` }} />
    </span>
  )
}

/**
 * A short burst of orbs across the screen, for a moment worth marking (a
 * convert graduating). Render it with a changing `trigger` (e.g. a counter);
 * each change plays it once.
 */
export function OrbBurst({ trigger, colors = ['success', 'members', 'primary', 'churches', 'arrivals'] }: { trigger: number; colors?: Token[] }) {
  const still = useReducedMotion()
  const [playing, setPlaying] = useState(0)
  useEffect(() => {
    if (!trigger || still) return
    setPlaying(trigger)
    const t = setTimeout(() => setPlaying(0), 1600)
    return () => clearTimeout(t)
  }, [trigger, still])

  return (
    <AnimatePresence>
      {playing ? (
        <div key={playing} aria-hidden className="pointer-events-none fixed inset-0 z-[60] flex items-center justify-center overflow-hidden">
          {Array.from({ length: 14 }, (_, i) => {
            const angle = (i / 14) * Math.PI * 2
            const distance = 180 + (i % 3) * 90
            const size = 36 + (i % 4) * 18
            return (
              <motion.span
                key={i}
                className="absolute rounded-full blur-md"
                style={{ width: size, height: size, background: glow(colors[i % colors.length], 0.95) }}
                initial={{ x: 0, y: 0, scale: 0.2, opacity: 0 }}
                animate={{ x: Math.cos(angle) * distance, y: Math.sin(angle) * distance, scale: [0.2, 1.2, 0.9], opacity: [0, 1, 0] }}
                exit={{ opacity: 0 }}
                transition={{ duration: 1.4, ease: 'easeOut', delay: (i % 5) * 0.03 }}
              />
            )
          })}
        </div>
      ) : null}
    </AnimatePresence>
  )
}
