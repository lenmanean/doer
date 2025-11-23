import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Privacy Policy | DOER',
  description: 'DOER Privacy Policy - Learn how we collect, use, and protect your personal information. Comprehensive privacy policy covering data collection, third-party services, user rights, and GDPR/CCPA compliance.',
  openGraph: {
    title: 'Privacy Policy | DOER',
    description: 'DOER Privacy Policy - Learn how we collect, use, and protect your personal information.',
    type: 'website',
  },
  robots: {
    index: true,
    follow: true,
  },
}

export default function PrivacyLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return children
}

