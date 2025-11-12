'use client'

import { NextIntlClientProvider } from 'next-intl'
import { ReactNode } from 'react'

interface LocaleProviderProps {
  children: ReactNode
  locale: string
  messages: any
  timeZone?: string
}

const DEFAULT_TIME_ZONE = 'UTC'

export function LocaleProvider({ children, locale, messages, timeZone }: LocaleProviderProps) {
  return (
    <NextIntlClientProvider
      locale={locale}
      messages={messages}
      timeZone={timeZone || DEFAULT_TIME_ZONE}
    >
      {children}
    </NextIntlClientProvider>
  )
}






