'use client'

import { ReactNode, useEffect, useRef } from 'react'
import { cn } from '@/lib/utils'

interface DocumentationSectionProps {
  id: string
  title: string
  description?: string
  children: ReactNode
  className?: string
  level?: number
}

export function DocumentationSection({
  id,
  title,
  description,
  children,
  className,
  level = 2
}: DocumentationSectionProps) {
  const sectionRef = useRef<HTMLElement>(null)
  const HeadingTag = `h${level}` as keyof JSX.IntrinsicElements

  useEffect(() => {
    // Scroll to section if hash matches
    if (typeof window !== 'undefined' && window.location.hash === `#${id}`) {
      setTimeout(() => {
        sectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      }, 100)
    }
  }, [id])

  return (
    <section
      ref={sectionRef}
      id={id}
      className={cn('scroll-mt-24', className)}
    >
      <div className="mb-6">
        <HeadingTag
          className={cn(
            'font-bold text-gray-900 dark:text-slate-100 mb-2',
            level === 2 && 'text-3xl',
            level === 3 && 'text-2xl',
            level === 4 && 'text-xl'
          )}
        >
          {title}
        </HeadingTag>
        {description && (
          <p className="text-lg text-gray-600 dark:text-slate-300 mt-2 break-words overflow-wrap-anywhere">
            {description}
          </p>
        )}
      </div>
      <div className="prose prose-gray dark:prose-invert max-w-none break-words overflow-wrap-anywhere">
        {children}
      </div>
    </section>
  )
}

