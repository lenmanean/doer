'use client'

import { BlogCategory } from '@/data/blog'
import { getCategoryDisplayName } from '@/lib/blog'
import { useTranslations } from 'next-intl'

interface CategoryFilterProps {
  categories: BlogCategory[]
  selectedCategory: BlogCategory | 'all'
  onCategoryChange: (category: BlogCategory | 'all') => void
}

export function CategoryFilter({ categories, selectedCategory, onCategoryChange }: CategoryFilterProps) {
  const t = useTranslations()

  return (
    <div className="flex flex-wrap gap-3 justify-center">
      <button
        onClick={() => onCategoryChange('all')}
        className={`px-6 py-2 rounded-full text-sm font-medium transition-colors ${
          selectedCategory === 'all'
            ? 'bg-orange-500 text-white dark:bg-orange-500'
            : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
        }`}
      >
        {t('blog.categories.all')}
      </button>
      {categories.map((category) => (
        <button
          key={category}
          onClick={() => onCategoryChange(category)}
          className={`px-6 py-2 rounded-full text-sm font-medium transition-colors ${
            selectedCategory === category
              ? 'bg-orange-500 text-white dark:bg-orange-500'
              : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
          }`}
        >
          {getCategoryDisplayName(category)}
        </button>
      ))}
    </div>
  )
}

