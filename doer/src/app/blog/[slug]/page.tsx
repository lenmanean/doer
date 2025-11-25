import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { PublicHeader } from '@/components/ui/PublicHeader'
import { PublicFooter } from '@/components/ui/PublicFooter'
import { MarkdownContent } from '@/components/blog/MarkdownContent'
import { SocialShare } from '@/components/blog/SocialShare'
import { RelatedPosts } from '@/components/blog/RelatedPosts'
import { AuthorBio } from '@/components/blog/AuthorBio'
import { NewsletterSignup } from '@/components/blog/NewsletterSignup'
import { getBlogPostBySlug, getRelatedPosts } from '@/data/blog'
import { 
  formatBlogDate, 
  formatBlogDateISO,
  getBlogPostCanonicalUrl,
  getBlogPostImageUrl,
  getCategoryDisplayName
} from '@/lib/blog'
import { Calendar, Clock } from 'lucide-react'
import { Badge } from '@/components/ui/Badge'

interface BlogPostPageProps {
  params: {
    slug: string
  }
}

export async function generateMetadata({ params }: BlogPostPageProps): Promise<Metadata> {
  const post = getBlogPostBySlug(params.slug)

  if (!post) {
    return {
      title: 'Post Not Found',
    }
  }

  const canonicalUrl = getBlogPostCanonicalUrl(post.slug)
  const imageUrl = getBlogPostImageUrl(post)

  return {
    title: `${post.title} | DOER Blog`,
    description: post.metaDescription,
    alternates: {
      canonical: canonicalUrl,
    },
    openGraph: {
      title: post.title,
      description: post.metaDescription,
      url: canonicalUrl,
      siteName: 'DOER',
      images: [
        {
          url: imageUrl,
          width: 1200,
          height: 630,
          alt: post.title,
        },
      ],
      locale: 'en_US',
      type: 'article',
      publishedTime: post.publishDate,
      modifiedTime: post.updatedDate || post.publishDate,
      authors: [post.author.name],
      tags: post.tags,
    },
    twitter: {
      card: 'summary_large_image',
      title: post.title,
      description: post.metaDescription,
      images: [imageUrl],
    },
  }
}

export default function BlogPostPage({ params }: BlogPostPageProps) {
  const post = getBlogPostBySlug(params.slug)

  if (!post) {
    notFound()
  }

  const relatedPosts = getRelatedPosts(post, 3)
  const canonicalUrl = getBlogPostCanonicalUrl(post.slug)

  // Structured data for SEO
  const structuredData = {
    '@context': 'https://schema.org',
    '@type': 'BlogPosting',
    headline: post.title,
    description: post.metaDescription,
    image: getBlogPostImageUrl(post),
    datePublished: post.publishDate,
    dateModified: post.updatedDate || post.publishDate,
    author: {
      '@type': 'Person',
      name: post.author.name,
    },
    publisher: {
      '@type': 'Organization',
      name: 'DOER',
      logo: {
        '@type': 'ImageObject',
        url: `${process.env.NEXT_PUBLIC_SITE_URL || 'https://usedoer.com'}/logo.png`,
      },
    },
    mainEntityOfPage: {
      '@type': 'WebPage',
      '@id': canonicalUrl,
    },
  }

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
      />
      <div className="min-h-screen bg-white dark:bg-gray-900 flex flex-col transition-colors">
        <PublicHeader />
        
        <main className="flex-1 py-12 px-4 sm:px-6 lg:px-8 bg-white dark:bg-gray-900 transition-colors">
          <article className="max-w-4xl mx-auto">
            {/* Header */}
            <header className="mb-8">
              <div className="flex items-center gap-3 mb-4">
                <Badge variant="outline">
                  {getCategoryDisplayName(post.category)}
                </Badge>
                <div className="flex items-center gap-1 text-sm text-gray-500 dark:text-gray-400">
                  <Clock className="w-4 h-4" />
                  <span>{post.readingTime} min read</span>
                </div>
              </div>

              <h1 className="text-4xl md:text-5xl font-bold text-gray-900 dark:text-white mb-6">
                {post.title}
              </h1>

              <div className="flex flex-wrap items-center gap-4 text-sm text-gray-600 dark:text-gray-400 mb-6">
                <div className="flex items-center gap-2">
                  <span>{post.author.name}</span>
                </div>
                <span>•</span>
                <time dateTime={formatBlogDateISO(post.publishDate)} className="flex items-center gap-1">
                  <Calendar className="w-4 h-4" />
                  {formatBlogDate(post.publishDate)}
                </time>
              </div>

              {/* Social Share */}
              <div className="border-t border-b border-gray-200 dark:border-gray-700 py-4">
                <SocialShare
                  url={`/blog/${post.slug}`}
                  title={post.title}
                  description={post.excerpt}
                />
              </div>
            </header>

            {/* Featured Image */}
            {post.featuredImage && (
              <div className="relative w-full h-64 md:h-96 mb-8 rounded-xl overflow-hidden bg-gray-100 dark:bg-gray-900">
                <img
                  src={post.featuredImage}
                  alt={post.title}
                  className="w-full h-full object-cover"
                />
              </div>
            )}

            {/* Content */}
            <div className="prose prose-lg dark:prose-invert max-w-none mb-12">
              <MarkdownContent content={post.content} />
            </div>

            {/* Tags */}
            {post.tags.length > 0 && (
              <div className="flex flex-wrap gap-2 mb-12">
                {post.tags.map((tag) => (
                  <Badge key={tag} variant="outline" className="text-xs">
                    #{tag}
                  </Badge>
                ))}
              </div>
            )}

            {/* Author Bio */}
            <div className="mb-12">
              <AuthorBio author={post.author} />
            </div>

            {/* Newsletter CTA */}
            <div className="mb-12">
              <NewsletterSignup variant="inline" />
            </div>

            {/* Related Posts */}
            {relatedPosts.length > 0 && (
              <RelatedPosts posts={relatedPosts} />
            )}
          </article>
        </main>

        <PublicFooter />
      </div>
    </>
  )
}

