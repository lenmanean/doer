'use client'

import Link from 'next/link'
import Image from 'next/image'
import { Calendar, Clock } from 'lucide-react'
import { BlogPost } from '@/data/blog'
import { formatBlogDate, getCategoryDisplayName } from '@/lib/blog'
import { Badge } from '@/components/ui/Badge'

interface BlogPostCardProps {
  post: BlogPost
  featured?: boolean
}

export function BlogPostCard({ post, featured = false }: BlogPostCardProps) {
  return (
    <Link 
      href={`/blog/${post.slug}`}
      className={`group block bg-white dark:bg-gray-800 rounded-xl border-2 border-gray-200 dark:border-gray-700 overflow-hidden hover:border-orange-500 dark:hover:border-gray-600 transition-all duration-300 hover:shadow-lg ${
        featured ? 'md:col-span-2' : ''
      }`}
    >
      {post.featuredImage && (
        <div className={`relative ${featured ? 'h-64' : 'h-48'} w-full overflow-hidden bg-gray-100 dark:bg-gray-900`}>
          <Image
            src={post.featuredImage}
            alt={post.title}
            fill
            className="object-cover group-hover:scale-105 transition-transform duration-300"
            sizes={featured ? "(max-width: 768px) 100vw, 50vw" : "(max-width: 768px) 100vw, 33vw"}
          />
        </div>
      )}
      
      <div className="p-6">
        <div className="flex items-center gap-3 mb-3">
          <Badge variant="outline" className="text-xs">
            {getCategoryDisplayName(post.category)}
          </Badge>
          <div className="flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400">
            <Clock className="w-3 h-3" />
            <span>{post.readingTime} min read</span>
          </div>
        </div>

        <h3 className={`font-bold text-gray-900 dark:text-white mb-2 group-hover:text-orange-500 dark:group-hover:text-orange-400 transition-colors ${
          featured ? 'text-2xl' : 'text-xl'
        }`}>
          {post.title}
        </h3>

        <p className={`text-gray-600 dark:text-gray-300 mb-4 line-clamp-3 ${
          featured ? 'text-base' : 'text-sm'
        }`}>
          {post.excerpt}
        </p>

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1 text-sm text-gray-500 dark:text-gray-400">
            <Calendar className="w-3 h-3" />
            <time dateTime={post.publishDate}>
              {formatBlogDate(post.publishDate)}
            </time>
          </div>
          <span className="text-sm font-medium text-orange-500 dark:text-orange-400 group-hover:underline">
            Read more →
          </span>
        </div>
      </div>
    </Link>
  )
}

