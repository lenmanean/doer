'use client'

import { BlogCategory } from '@/data/blog'
import { getCategoryDisplayName } from '@/lib/blog'
import { useTranslations } from 'next-intl'

interface CategoryFilterProps {
  categories: BlogCategory[]
  selectedCategory: BlogCategory | 'all'
  onCategoryChange: (category: BlogCategory | 'all') => void
}

// Safe translation helper that doesn't throw on missing keys
function safeTranslate(t: ReturnType<typeof useTranslations>, key: string, fallback: string): string {
  try {
    const translated = t(key)
    if (translated === key) {
      return fallback
    }
    return translated
  } catch (error) {
    return fallback
  }
}

export function CategoryFilter({ categories, selectedCategory, onCategoryChange }: CategoryFilterProps) {
  const t = useTranslations()

  return (
    <div className="flex flex-wrap gap-3 justify-center">
      <button
        onClick={() => onCategoryChange('all')}
        className={`px-4 sm:px-6 py-2 rounded-full text-sm font-medium transition-colors min-h-[44px] ${
          selectedCategory === 'all'
            ? 'bg-orange-500 text-white'
            : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
        }`}
      >
        {safeTranslate(t, 'blog.categories.all', 'All')}
      </button>
      {categories.map((category) => (
        <button
          key={category}
          onClick={() => onCategoryChange(category)}
          className={`px-4 sm:px-6 py-2 rounded-full text-sm font-medium transition-colors min-h-[44px] ${
            selectedCategory === category
              ? 'bg-orange-500 text-white'
              : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
          }`}
        >
          {getCategoryDisplayName(category)}
        </button>
      ))}
    </div>
  )
}

