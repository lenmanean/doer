import { NextResponse } from 'next/server'
import { getAllBlogPosts } from '@/data/blog'
import { formatBlogDateISO, getBlogPostCanonicalUrl } from '@/lib/blog'

export async function GET() {
  const posts = getAllBlogPosts()
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://usedoer.com'
  const siteName = 'DOER Blog'

  const rssItems = posts.map(post => {
    const url = getBlogPostCanonicalUrl(post.slug)
    const pubDate = new Date(post.publishDate).toUTCString()
    const description = post.excerpt.replace(/"/g, '&quot;').replace(/'/g, '&apos;')

    return `    <item>
      <title><![CDATA[${post.title}]]></title>
      <link>${url}</link>
      <guid isPermaLink="true">${url}</guid>
      <description><![CDATA[${description}]]></description>
      <pubDate>${pubDate}</pubDate>
      <author>${post.author.name}</author>
      <category>${post.category}</category>
    </item>`
  }).join('\n')

  const rss = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>${siteName}</title>
    <link>${baseUrl}/blog</link>
    <description>Latest articles and insights from DOER</description>
    <language>en-us</language>
    <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>
    <atom:link href="${baseUrl}/blog/rss.xml" rel="self" type="application/rss+xml"/>
${rssItems}
  </channel>
</rss>`

  return new NextResponse(rss, {
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
      'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400',
    },
  })
}

