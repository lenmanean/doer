'use client'

import { NextIntlClientProvider } from 'next-intl'
import { ReactNode, useEffect } from 'react'
import { logger } from '@/lib/logger'

interface LocaleProviderProps {
  children: ReactNode
  locale: string
  messages: any
  timeZone?: string
}

const DEFAULT_TIME_ZONE = 'UTC'

export function LocaleProvider({ children, locale, messages, timeZone }: LocaleProviderProps) {
  // Ensure messages is a valid object (handle serialization issues)
  const validMessages = messages && typeof messages === 'object' ? messages : {}
  
  // Log message availability on mount
  useEffect(() => {
    if (!messages || typeof messages !== 'object') {
      logger.error('LocaleProvider: Invalid or missing messages', {
        locale,
        messagesType: typeof messages,
        messagesIsNull: messages === null,
        messagesIsUndefined: messages === undefined,
        userAgent: typeof navigator !== 'undefined' ? navigator.userAgent.substring(0, 100) : 'unknown',
        url: typeof window !== 'undefined' ? window.location.href : 'unknown'
      })
    } else {
      const hasBlogMessages = 'blog' in messages && typeof messages.blog === 'object'
      const hasPricingMessages = 'pages' in messages && 
                                 typeof messages.pages === 'object' && 
                                 'pricing' in messages.pages
      
      logger.info('LocaleProvider: Messages loaded', {
        locale,
        hasMessages: true,
        hasBlogMessages,
        hasPricingMessages,
        messageKeys: Object.keys(messages).slice(0, 10),
        blogKeys: hasBlogMessages ? Object.keys(messages.blog || {}).slice(0, 5) : [],
        userAgent: typeof navigator !== 'undefined' ? navigator.userAgent.substring(0, 100) : 'unknown'
      })
      
      // Check for specific missing keys
      if (!hasBlogMessages) {
        logger.warn('LocaleProvider: blog messages missing', { locale })
      }
      if (!hasPricingMessages) {
        logger.warn('LocaleProvider: pricing messages missing', { locale })
      }
    }
  }, [locale, messages])

  return (
    <NextIntlClientProvider
      locale={locale}
      messages={validMessages}
      timeZone={timeZone || DEFAULT_TIME_ZONE}
    >
      {children}
    </NextIntlClientProvider>
  )
}






