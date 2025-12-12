'use client'

import { useState, useMemo, useEffect } from 'react'
import { useTranslations } from 'next-intl'
import { PublicHeader } from '@/components/ui/PublicHeader'
import { PublicFooter } from '@/components/ui/PublicFooter'
import { BlogPostCard } from '@/components/blog/BlogPostCard'
import { BlogSearch } from '@/components/blog/BlogSearch'
import { CategoryFilter } from '@/components/blog/CategoryFilter'
import { NewsletterSignup } from '@/components/blog/NewsletterSignup'
import { 
  getAllBlogPosts, 
  getFeaturedBlogPosts, 
  type BlogCategory 
} from '@/data/blog'
import { searchBlogPosts, getCategoryDisplayName } from '@/lib/blog'
import { logger } from '@/lib/logger'

export default function BlogPage() {
  const t = useTranslations()
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedCategory, setSelectedCategory] = useState<BlogCategory | 'all'>('all')

  const allPosts = getAllBlogPosts()
  const featuredPosts = getFeaturedBlogPosts()
  const allCategories = Array.from(new Set(allPosts.map(post => post.category))) as BlogCategory[]

  // Log translation availability on mount
  useEffect(() => {
    try {
      const testTranslation = t('blog.title')
      if (testTranslation === 'blog.title') {
        logger.error('Translation key returned as-is (translation missing)', {
          key: 'blog.title',
          userAgent: navigator.userAgent,
          url: window.location.href
        })
      } else {
        logger.info('Translations loaded successfully', {
          sampleTranslation: testTranslation,
          userAgent: navigator.userAgent.substring(0, 100)
        })
      }
    } catch (error) {
      logger.error('Error accessing translations', {
        error: error instanceof Error ? error.message : String(error),
        userAgent: navigator.userAgent,
        url: window.location.href
      })
    }
  }, [t])

  // Filter posts by category and search
  const filteredPosts = useMemo(() => {
    let posts = allPosts

    // Filter by category
    if (selectedCategory !== 'all') {
      posts = posts.filter(post => post.category === selectedCategory)
    }

    // Filter by search query
    if (searchQuery.trim()) {
      posts = searchBlogPosts(posts, searchQuery)
    }

    // Exclude featured posts from main list
    const featuredIds = new Set(featuredPosts.map(p => p.id))
    posts = posts.filter(post => !featuredIds.has(post.id))

    return posts
  }, [allPosts, selectedCategory, searchQuery, featuredPosts])

  return (
    <div className="min-h-screen bg-gray-900 flex flex-col transition-colors overflow-x-hidden">
      <PublicHeader />
      
      <main className="flex-1 py-12 px-4 sm:px-6 lg:px-8 bg-gray-900 transition-colors">
        <div className="max-w-7xl mx-auto">
          {/* Hero Section */}
          <div className="text-center mb-16">
            <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-bold text-slate-100 mb-6">
              {(() => {
                try {
                  const translated = t('blog.title')
                  if (translated === 'blog.title') {
                    logger.warn('Translation key returned as-is', {
                      key: 'blog.title',
                      userAgent: navigator.userAgent.substring(0, 100)
                    })
                    return 'Blog'
                  }
                  return translated
                } catch (error) {
                  logger.error('Translation error for blog.title', {
                    error: error instanceof Error ? error.message : String(error),
                    key: 'blog.title'
                  })
                  return 'Blog'
                }
              })()}
            </h1>
            <p className="text-lg sm:text-xl text-slate-300 mb-8 max-w-3xl mx-auto">
              {(() => {
                try {
                  const translated = t('blog.description')
                  if (translated === 'blog.description') {
                    logger.warn('Translation key returned as-is', {
                      key: 'blog.description',
                      userAgent: navigator.userAgent.substring(0, 100)
                    })
                    return 'Read our latest articles and insights.'
                  }
                  return translated
                } catch (error) {
                  logger.error('Translation error for blog.description', {
                    error: error instanceof Error ? error.message : String(error),
                    key: 'blog.description'
                  })
                  return 'Read our latest articles and insights.'
                }
              })()}
            </p>
            
            {/* Search Bar */}
            <div className="flex justify-center mb-8">
              <BlogSearch
                value={searchQuery}
                onChange={setSearchQuery}
              />
            </div>
          </div>

          {/* Featured Posts */}
          {featuredPosts.length > 0 && (
            <section className="mb-16">
              <h2 className="text-2xl font-bold text-white mb-6">
                {t('blog.featured')}
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {featuredPosts.map((post) => (
                  <BlogPostCard key={post.id} post={post} featured />
                ))}
              </div>
            </section>
          )}

          {/* Category Filter */}
          <div className="mb-8">
            <CategoryFilter
              categories={allCategories}
              selectedCategory={selectedCategory}
              onCategoryChange={setSelectedCategory}
            />
          </div>

          {/* Posts Grid */}
          <section>
            {filteredPosts.length > 0 ? (
              <>
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-2xl font-bold text-white">
                    {selectedCategory === 'all' 
                      ? t('blog.allPosts')
                      : `${getCategoryDisplayName(selectedCategory)} ${t('blog.posts')}`
                    }
                  </h2>
                  <span className="text-sm text-gray-400">
                    {filteredPosts.length} {(() => {
                      try {
                        const translated = t('blog.postsFound')
                        if (translated === 'blog.postsFound') {
                          logger.warn('Translation key returned as-is', { key: 'blog.postsFound' })
                          return 'posts found'
                        }
                        return translated
                      } catch (error) {
                        logger.error('Translation error for blog.postsFound', {
                          error: error instanceof Error ? error.message : String(error),
                          key: 'blog.postsFound'
                        })
                        return 'posts found'
                      }
                    })()}
                  </span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {filteredPosts.map((post) => (
                    <BlogPostCard key={post.id} post={post} />
                  ))}
                </div>
              </>
            ) : (
              <div className="text-center py-16">
                <p className="text-xl text-gray-400 mb-4">
                  {t('blog.noPostsFound')}
                </p>
                <button
                  onClick={() => {
                    setSearchQuery('')
                    setSelectedCategory('all')
                  }}
                  className="text-orange-400 hover:underline min-h-[44px] px-4"
                >
                  {t('blog.clearFilters')}
                </button>
              </div>
            )}
          </section>

          {/* Newsletter Signup */}
          <section className="mt-16">
            <NewsletterSignup />
          </section>
        </div>
      </main>

      <PublicFooter />
    </div>
  )
}
