'use client'

import { useState, useEffect, useRef } from 'react'

interface ChangelogEntryCardProps {
  date: string
  title: string
  description: string
  index: number
}

export function ChangelogEntryCard({
  date,
  title,
  description,
  index,
}: ChangelogEntryCardProps) {
  const [isVisible, setIsVisible] = useState(false)
  const [isExpanded, setIsExpanded] = useState(false)
  const cardRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setIsVisible(true)
            observer.unobserve(entry.target)
          }
        })
      },
      {
        threshold: 0.1,
        rootMargin: '0px 0px -50px 0px',
      }
    )

    if (cardRef.current) {
      observer.observe(cardRef.current)
    }

    return () => {
      if (cardRef.current) {
        observer.unobserve(cardRef.current)
      }
    }
  }, [])

  const formattedDate = new Date(date).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    timeZone: 'America/Los_Angeles',
  })

  const formattedTime = new Date(date).toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    timeZone: 'America/Los_Angeles',
    timeZoneName: 'short',
  })

  return (
    <div
      ref={cardRef}
      className={`transition-all duration-700 ease-out ${
        isVisible
          ? 'opacity-100 translate-y-0'
          : 'opacity-0 translate-y-8'
      }`}
      style={{
        transitionDelay: `${index * 100}ms`,
      }}
    >
      <article
        className="group relative overflow-hidden rounded-2xl border border-white/10 dark:border-white/5 bg-white/5 dark:bg-gray-800/30 backdrop-blur-md p-6 shadow-lg shadow-black/5 dark:shadow-black/20 hover:shadow-xl hover:shadow-orange-500/10 dark:hover:shadow-orange-500/20 transition-all duration-300 hover:scale-[1.02] hover:border-orange-500/30 dark:hover:border-orange-500/20"
        onMouseEnter={() => setIsExpanded(true)}
        onMouseLeave={() => setIsExpanded(false)}
      >
        {/* Gradient overlay on hover */}
        <div
          className={`absolute inset-0 bg-gradient-to-br from-orange-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none`}
        />

        {/* Content */}
        <div className="relative z-10">
          {/* Date Badge */}
          <div className="flex items-center gap-3 mb-4">
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-orange-500/10 dark:bg-orange-500/20 border border-orange-500/20 dark:border-orange-500/30">
              <div className="w-2 h-2 rounded-full bg-orange-500 animate-pulse" />
              <time
                dateTime={date}
                className="text-xs font-semibold text-orange-600 dark:text-orange-400 uppercase tracking-wide"
              >
                {formattedDate}
              </time>
            </div>
            <span className="text-xs text-gray-500 dark:text-gray-400">
              {formattedTime}
            </span>
          </div>

          {/* Title */}
          <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-3 group-hover:text-orange-600 dark:group-hover:text-orange-400 transition-colors duration-300">
            {title}
          </h3>

          {/* Description */}
          <p
            className={`text-sm text-gray-600 dark:text-gray-300 leading-relaxed transition-all duration-300 ${
              isExpanded ? 'line-clamp-none' : 'line-clamp-3'
            }`}
          >
            {description}
          </p>

          {/* Expand indicator */}
          <div
            className={`mt-4 flex items-center gap-2 text-xs font-medium text-orange-500 opacity-0 group-hover:opacity-100 transition-opacity duration-300 ${
              description.length > 150 ? '' : 'hidden'
            }`}
          >
            <span>{isExpanded ? 'Show less' : 'Show more'}</span>
            <svg
              className={`w-4 h-4 transition-transform duration-300 ${
                isExpanded ? 'rotate-180' : ''
              }`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M19 9l-7 7-7-7"
              />
            </svg>
          </div>
        </div>

        {/* Shine effect on hover */}
        <div className="absolute inset-0 -translate-x-full group-hover:translate-x-full transition-transform duration-1000 bg-gradient-to-r from-transparent via-white/10 to-transparent pointer-events-none" />
      </article>
    </div>
  )
}
