'use client'

import { useEffect } from 'react'
import { usePathname } from 'next/navigation'
import { onCLS, onINP, onLCP, onTTFB } from 'web-vitals'

export function WebVitalsReporter() {
  const pathname = usePathname()

  useEffect(() => {
    if (process.env.NODE_ENV !== 'production') return

    onTTFB((metric) => {
      if (metric.value > 300) {
        console.warn(`[perf] ${pathname} — TTFB: ${metric.value}ms`)
      }
    })
    onLCP((metric) => {
      if (metric.value > 2500) {
        console.warn(`[perf] ${pathname} — LCP: ${metric.value}ms`)
      }
    })
    onCLS((metric) => {
      if (metric.value > 0.1) {
        console.warn(`[perf] ${pathname} — CLS: ${metric.value}`)
      }
    })
    onINP((metric) => {
      if (metric.value > 200) {
        console.warn(`[perf] ${pathname} — INP: ${metric.value}ms`)
      }
    })
  }, [pathname])

  return null
}
