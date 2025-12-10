'use client'

import Link from 'next/link'
import { useTranslations } from 'next-intl'
import { IS_PRE_LAUNCH } from '@/lib/feature-flags'

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
                <Link href="/features/integrations" className="text-sm text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white transition-colors">
                  {t('header.integrations')}
                </Link>
              </li>
              <li>
                <Link href="/solutions" className="text-sm text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white transition-colors">
                  {t('header.solutions')}
                </Link>
              </li>
              {!IS_PRE_LAUNCH && (
                <li>
                  <Link href="/pricing" className="text-sm text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white transition-colors">
                    {t('header.pricing')}
                  </Link>
                </li>
              )}
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

          {/* Legal */}
          <div>
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white uppercase tracking-wider mb-4">
              {t('footer.legal')}
            </h3>
            <ul className="space-y-3">
              <li>
                <Link href="/privacy" className="text-sm text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white transition-colors">
                  {t('footer.privacyPolicy')}
                </Link>
              </li>
              <li>
                <Link href="/terms" className="text-sm text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white transition-colors">
                  {t('footer.termsOfService')}
                </Link>
              </li>
              <li>
                <Link href="/security" className="text-sm text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white transition-colors">
                  {t('footer.security')}
                </Link>
              </li>
              <li>
                <Link href="/report-misuse" className="text-sm text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white transition-colors">
                  {t('footer.reportMisuse')}
                </Link>
              </li>
              <li>
                <Link href="/responsible-use" className="text-sm text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white transition-colors">
                  {t('footer.responsibleUsePolicy')}
                </Link>
              </li>
            </ul>
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

