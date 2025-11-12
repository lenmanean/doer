'use client'

import { useEffect, useRef, useState } from 'react'

interface UseScrollAnimationOptions {
  threshold?: number
  rootMargin?: string
  triggerOnce?: boolean
  delay?: number
}

export function useScrollAnimation(options: UseScrollAnimationOptions = {}) {
  const {
    threshold = 0.1,
    rootMargin = '0px 0px -100px 0px',
    triggerOnce = true,
    delay = 0
  } = options

  const [isVisible, setIsVisible] = useState(false)
  const elementRef = useRef<HTMLElement>(null)
  const hasTriggeredRef = useRef(false)
  const observerRef = useRef<IntersectionObserver | null>(null)

  useEffect(() => {
    const element = elementRef.current
    if (!element || hasTriggeredRef.current) return

    // Clean up any existing observer
    if (observerRef.current) {
      observerRef.current.disconnect()
    }

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting && !hasTriggeredRef.current) {
            hasTriggeredRef.current = true
            
            if (delay > 0) {
              setTimeout(() => {
                setIsVisible(true)
                if (triggerOnce && observerRef.current) {
                  observerRef.current.unobserve(element)
                }
              }, delay)
            } else {
              setIsVisible(true)
              if (triggerOnce && observerRef.current) {
                observerRef.current.unobserve(element)
              }
            }
          } else if (!triggerOnce && !entry.isIntersecting) {
            setIsVisible(false)
            hasTriggeredRef.current = false
          }
        })
      },
      {
        threshold,
        rootMargin,
      }
    )

    observerRef.current = observer
    observer.observe(element)

    return () => {
      if (observerRef.current) {
        observerRef.current.disconnect()
        observerRef.current = null
      }
    }
  }, [threshold, rootMargin, triggerOnce, delay])

  return { ref: elementRef, isVisible }
}

