'use client'

import { useState, useEffect } from 'react'
import { Search, X } from 'lucide-react'
import { useTranslations } from 'next-intl'

interface BlogSearchProps {
  value: string
  onChange: (value: string) => void
  placeholder?: string
}

export function BlogSearch({ value, onChange, placeholder }: BlogSearchProps) {
  const t = useTranslations()
  const [localValue, setLocalValue] = useState(value)

  const getPlaceholder = () => {
    if (placeholder) return placeholder
    try {
      const translated = t('blog.search.placeholder')
      return translated === 'blog.search.placeholder' ? 'Search articles...' : translated
    } catch {
      return 'Search articles...'
    }
  }

  useEffect(() => {
    const timer = setTimeout(() => {
      onChange(localValue)
    }, 300) // Debounce

    return () => clearTimeout(timer)
  }, [localValue, onChange])

  return (
    <div className="relative w-full max-w-2xl">
      <div className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500">
        <Search className="w-5 h-5" />
      </div>
      <input
        type="text"
        value={localValue}
        onChange={(e) => setLocalValue(e.target.value)}
        placeholder={getPlaceholder()}
        className="w-full pl-12 pr-12 py-4 bg-white dark:bg-gray-800 border-2 border-gray-200 dark:border-gray-700 rounded-xl text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent transition-colors"
      />
      {localValue && (
        <button
          onClick={() => {
            setLocalValue('')
            onChange('')
          }}
          className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
          aria-label="Clear search"
        >
          <X className="w-5 h-5" />
        </button>
      )}
    </div>
  )
}

