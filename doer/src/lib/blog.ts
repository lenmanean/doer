import { BlogPost } from '@/data/blog'

/**
 * Calculate reading time in minutes based on content length
 * Assumes average reading speed of 200 words per minute
 */
export function calculateReadingTime(content: string): number {
  const wordsPerMinute = 200
  const wordCount = content.split(/\s+/).length
  const readingTime = Math.ceil(wordCount / wordsPerMinute)
  return Math.max(1, readingTime) // Minimum 1 minute
}

/**
 * Generate a URL-friendly slug from a string
 */
export function generateSlug(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '') // Remove special characters
    .replace(/[\s_-]+/g, '-') // Replace spaces and underscores with hyphens
    .replace(/^-+|-+$/g, '') // Remove leading/trailing hyphens
}

/**
 * Format date for display
 */
export function formatBlogDate(dateString: string): string {
  const date = new Date(dateString)
  return new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  }).format(date)
}

/**
 * Format date for ISO display
 */
export function formatBlogDateISO(dateString: string): string {
  return new Date(dateString).toISOString()
}

/**
 * Get category display name
 */
export function getCategoryDisplayName(category: string): string {
  const categoryMap: Record<string, string> = {
    'product-updates': 'Product Updates',
    'productivity-tips': 'Productivity Tips',
    'ai-technology': 'AI & Technology',
    'goal-achievement': 'Goal Achievement',
    'integrations': 'Integrations',
    'case-studies': 'Case Studies',
  }
  return categoryMap[category] || category
}

/**
 * Search blog posts by query
 */
export function searchBlogPosts(posts: BlogPost[], query: string): BlogPost[] {
  if (!query.trim()) return posts
  
  const lowerQuery = query.toLowerCase()
  return posts.filter(post => 
    post.title.toLowerCase().includes(lowerQuery) ||
    post.excerpt.toLowerCase().includes(lowerQuery) ||
    post.content.toLowerCase().includes(lowerQuery) ||
    post.tags.some(tag => tag.toLowerCase().includes(lowerQuery)) ||
    post.category.toLowerCase().includes(lowerQuery)
  )
}

/**
 * Get excerpt from content (first N characters)
 */
export function getExcerpt(content: string, maxLength: number = 160): string {
  const plainText = content
    .replace(/[#*`]/g, '') // Remove markdown formatting
    .replace(/\n+/g, ' ') // Replace newlines with spaces
    .trim()
  
  if (plainText.length <= maxLength) return plainText
  
  return plainText.slice(0, maxLength).trim() + '...'
}

/**
 * Get canonical URL for a blog post
 */
export function getBlogPostCanonicalUrl(slug: string): string {
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://usedoer.com'
  return `${baseUrl}/blog/${slug}`
}

/**
 * Get blog post image URL (for OG tags)
 */
export function getBlogPostImageUrl(post: BlogPost): string {
  if (post.ogImage) return post.ogImage
  if (post.featuredImage) return post.featuredImage
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://usedoer.com'
  return `${baseUrl}/og-blog-default.png` // Default OG image
}

