'use client'

import { BlogPost } from '@/data/blog'
import { BlogPostCard } from './BlogPostCard'
import { useTranslations } from 'next-intl'

interface RelatedPostsProps {
  posts: BlogPost[]
}

export function RelatedPosts({ posts }: RelatedPostsProps) {
  const t = useTranslations()

  if (posts.length === 0) return null

  return (
    <section className="mt-16 pt-16 border-t border-gray-200 dark:border-gray-700">
      <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-8">
        {t('blog.relatedPosts')}
      </h2>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {posts.map((post) => (
          <BlogPostCard key={post.id} post={post} />
        ))}
      </div>
    </section>
  )
}

