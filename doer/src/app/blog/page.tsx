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
import { useScrollAnimation } from '@/hooks/useScrollAnimation'

// Safe translation helper that doesn't throw on missing keys
function safeTranslate(t: ReturnType<typeof useTranslations>, key: string, fallback: string): string {
  try {
    const translated = t(key)
    if (translated === key) {
      return fallback
    }
    return translated
  } catch (error) {
    logger.error('Translation error', { key, error: error instanceof Error ? error.message : String(error) })
    return fallback
  }
}

export default function BlogPage() {
  const t = useTranslations()
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedCategory, setSelectedCategory] = useState<BlogCategory | 'all'>('all')

  const allPosts = getAllBlogPosts()
  const featuredPosts = getFeaturedBlogPosts()
  const allCategories = Array.from(new Set(allPosts.map(post => post.category))) as BlogCategory[]

  // Animation hooks
  const titleAnim = useScrollAnimation({ delay: 0, triggerOnce: true })
  const descAnim = useScrollAnimation({ delay: 150, triggerOnce: true })
  const searchAnim = useScrollAnimation({ delay: 300, triggerOnce: true })
  const featuredAnim = useScrollAnimation({ delay: 400, triggerOnce: true })
  const filterAnim = useScrollAnimation({ delay: 500, triggerOnce: true })
  const postsAnim = useScrollAnimation({ delay: 600, triggerOnce: true })
  const newsletterAnim = useScrollAnimation({ delay: 700, triggerOnce: true })

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
            <h1 
              ref={titleAnim.ref as React.RefObject<HTMLHeadingElement>}
              className={`text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-bold text-slate-100 mb-6 scroll-animate-fade-up ${titleAnim.isVisible ? 'visible' : ''}`}
            >
              {safeTranslate(t, 'blog.title', 'Blog')}
            </h1>
            <p 
              ref={descAnim.ref as React.RefObject<HTMLParagraphElement>}
              className={`text-lg sm:text-xl text-slate-300 mb-8 max-w-3xl mx-auto scroll-animate-fade-up ${descAnim.isVisible ? 'visible' : ''}`}
            >
              {safeTranslate(t, 'blog.description', 'Read our latest articles and insights.')}
            </p>
            
            {/* Search Bar */}
            <div 
              ref={searchAnim.ref as React.RefObject<HTMLDivElement>}
              className={`flex justify-center mb-8 scroll-animate-fade-up ${searchAnim.isVisible ? 'visible' : ''}`}
            >
              <BlogSearch
                value={searchQuery}
                onChange={setSearchQuery}
              />
            </div>
          </div>

          {/* Featured Posts */}
          {featuredPosts.length > 0 && (
            <section 
              ref={featuredAnim.ref as React.RefObject<HTMLElement>}
              className={`mb-16 scroll-animate-fade-up ${featuredAnim.isVisible ? 'visible' : ''}`}
            >
              <h2 className="text-2xl font-bold text-white mb-6">
                {safeTranslate(t, 'blog.featured', 'Featured Posts')}
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {featuredPosts.map((post) => (
                  <BlogPostCard key={post.id} post={post} featured />
                ))}
              </div>
            </section>
          )}

          {/* Category Filter */}
          <div 
            ref={filterAnim.ref as React.RefObject<HTMLDivElement>}
            className={`mb-8 scroll-animate-fade-up ${filterAnim.isVisible ? 'visible' : ''}`}
          >
            <CategoryFilter
              categories={allCategories}
              selectedCategory={selectedCategory}
              onCategoryChange={setSelectedCategory}
            />
          </div>

          {/* Posts Grid */}
          <section
            ref={postsAnim.ref as React.RefObject<HTMLElement>}
            className={`scroll-animate-fade-up ${postsAnim.isVisible ? 'visible' : ''}`}
          >
            {filteredPosts.length > 0 ? (
              <>
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-2xl font-bold text-white">
                    {selectedCategory === 'all' 
                      ? safeTranslate(t, 'blog.allPosts', 'All Posts')
                      : `${getCategoryDisplayName(selectedCategory)} ${safeTranslate(t, 'blog.posts', 'Posts')}`
                    }
                  </h2>
                  <span className="text-sm text-gray-400">
                    {filteredPosts.length} {safeTranslate(t, 'blog.postsFound', 'posts found')}
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
                  {safeTranslate(t, 'blog.noPostsFound', 'No posts found matching your criteria.')}
                </p>
                <button
                  onClick={() => {
                    setSearchQuery('')
                    setSelectedCategory('all')
                  }}
                  className="text-orange-400 hover:underline min-h-[44px] px-4"
                >
                  {safeTranslate(t, 'blog.clearFilters', 'Clear filters')}
                </button>
              </div>
            )}
          </section>

          {/* Newsletter Signup */}
          <section 
            ref={newsletterAnim.ref as React.RefObject<HTMLElement>}
            className={`mt-16 scroll-animate-fade-up ${newsletterAnim.isVisible ? 'visible' : ''}`}
          >
            <NewsletterSignup />
          </section>
        </div>
      </main>

      <PublicFooter />
    </div>
  )
}
