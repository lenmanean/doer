'use client'

import Link from 'next/link'
import { useTranslations } from 'next-intl'

export function PublicFooter() {
  const t = useTranslations()

  return (
    <footer className="bg-gray-50 dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-8">
          {/* Brand & Description */}
          <div className="lg:col-span-2">
            <Link href="/" className="inline-block mb-4">
              <span className="text-xl font-bold text-gray-900 dark:text-white">DOER</span>
            </Link>
            <p className="text-sm text-gray-600 dark:text-gray-300 max-w-md">
              {t('footer.description')}
            </p>
          </div>

          {/* Company */}
          <div>
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white uppercase tracking-wider mb-4">
              {t('footer.company')}
            </h3>
            <ul className="space-y-3">
              <li>
                <Link href="/about-us" className="text-sm text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white transition-colors">
                  {t('footer.aboutUs')}
                </Link>
              </li>
              <li>
                <Link href="/affiliates" className="text-sm text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white transition-colors">
                  {t('footer.affiliateProgram')}
                </Link>
              </li>
              <li>
                <Link href="/careers" className="text-sm text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white transition-colors">
                  {t('footer.careers')}
                </Link>
              </li>
            </ul>
          </div>

          {/* Product */}
          <div>
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white uppercase tracking-wider mb-4">
              {t('footer.product')}
            </h3>
            <ul className="space-y-3">
              <li>
                <Link href="/features" className="text-sm text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white transition-colors">
                  {t('header.features')}
                </Link>
              </li>
              <li>
                <Link href="/integrations" className="text-sm text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white transition-colors">
                  {t('header.integrations')}
                </Link>
              </li>
              <li>
                <Link href="/solutions" className="text-sm text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white transition-colors">
                  {t('header.solutions')}
                </Link>
              </li>
              <li>
                <Link href="/pricing" className="text-sm text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white transition-colors">
                  {t('header.pricing')}
                </Link>
              </li>
              <li>
                <Link href="/roadmap" className="text-sm text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white transition-colors">
                  {t('footer.roadmap')}
                </Link>
              </li>
              <li>
                <Link href="/changelog" className="text-sm text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white transition-colors">
                  {t('header.changelog')}
                </Link>
              </li>
              <li>
                <Link href="/feature-request" className="text-sm text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white transition-colors">
                  {t('footer.featureRequest')}
                </Link>
              </li>
            </ul>
          </div>

          {/* Resources */}
          <div>
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white uppercase tracking-wider mb-4">
              {t('footer.resources')}
            </h3>
            <ul className="space-y-3">
              <li>
                <Link href="/documentation" className="text-sm text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white transition-colors">
                  {t('footer.docsAndFAQs')}
                </Link>
              </li>
              <li>
                <a
                  href="https://discord.gg/JfPXMjCzbN"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white transition-colors"
                >
                  {t('header.community')}
                </a>
              </li>
              <li>
                <Link href="/blog" className="text-sm text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white transition-colors">
                  {t('header.blog')}
                </Link>
              </li>
            </ul>
          </div>
        </div>

        {/* Legal Links */}
        <div className="mt-8 pt-8 border-t border-gray-200 dark:border-gray-700">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center">
            <div className="mb-4 md:mb-0">
              <h3 className="text-sm font-semibold text-gray-900 dark:text-white uppercase tracking-wider mb-4">
                {t('footer.legal')}
              </h3>
              <div className="flex flex-wrap gap-x-6 gap-y-2">
                <Link href="/privacy" className="text-sm text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white transition-colors">
                  {t('footer.privacyPolicy')}
                </Link>
                <Link href="/terms" className="text-sm text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white transition-colors">
                  {t('footer.termsOfService')}
                </Link>
                <Link href="/security" className="text-sm text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white transition-colors">
                  {t('footer.security')}
                </Link>
                <Link href="/report-misuse" className="text-sm text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white transition-colors">
                  {t('footer.reportMisuse')}
                </Link>
                <Link href="/responsible-use" className="text-sm text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white transition-colors">
                  {t('footer.responsibleUsePolicy')}
                </Link>
              </div>
            </div>
          </div>
        </div>

        {/* Copyright */}
        <div className="mt-8 pt-8 border-t border-gray-200 dark:border-gray-700 text-center">
          <p className="text-sm text-gray-600 dark:text-gray-300">
            {t('footer.copyright')}
          </p>
        </div>
      </div>
    </footer>
  )
}

