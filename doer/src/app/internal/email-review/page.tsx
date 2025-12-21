import { notFound } from 'next/navigation'
import { EmailReviewClient } from './EmailReviewClient'

export const dynamic = 'force-dynamic'

interface EmailReviewPageProps {
  searchParams: Promise<{ key?: string }> | { key?: string }
}

/**
 * Internal Email Review Page (Server Component)
 * 
 * INTERNAL ONLY – For manual email content verification before launch.
 * This page allows force-sending production email templates to an internal address.
 * 
 * Access via: /internal/email-review?key=INTERNAL_PREVIEW_SECRET
 */
export default async function EmailReviewPage({ searchParams }: EmailReviewPageProps) {
  // Handle both Promise and direct object for Next.js compatibility
  const params = await Promise.resolve(searchParams)
  const providedKey = params.key
  const expectedKey = process.env.INTERNAL_PREVIEW_SECRET

  // Return 404 if key is missing or invalid (don't expose route exists)
  if (!expectedKey || providedKey !== expectedKey) {
    notFound()
  }

  return <EmailReviewClient secretKey={providedKey} />
}
