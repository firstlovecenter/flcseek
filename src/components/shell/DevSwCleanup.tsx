'use client'

import { useEffect } from 'react'

/**
 * Unregister PWA service workers in development. A leftover SW from `next build`
 * can cache HTML that points at production chunk hashes, causing 404s for
 * main-app.js / app-pages-internals.js while running `next dev`.
 */
export function DevSwCleanup() {
  useEffect(() => {
    if (process.env.NODE_ENV !== 'development') return
    if (!('serviceWorker' in navigator)) return

    void navigator.serviceWorker.getRegistrations().then((registrations) => {
      registrations.forEach((registration) => {
        void registration.unregister()
      })
    })

    if ('caches' in window) {
      void caches.keys().then((keys) => {
        keys.forEach((key) => void caches.delete(key))
      })
    }
  }, [])

  return null
}
