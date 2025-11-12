import { getRequestConfig } from 'next-intl/server'
import { cookies } from 'next/headers'
import { locales, defaultLocale, type Locale } from './config'

// Import all message files statically
import enMessages from '../messages/en.json'
import deMessages from '../messages/de.json'
import esMessages from '../messages/es.json'
import frMessages from '../messages/fr.json'
import ptMessages from '../messages/pt.json'
import zhMessages from '../messages/zh.json'
import jaMessages from '../messages/ja.json'
import koMessages from '../messages/ko.json'

const DEFAULT_TIME_ZONE = process.env.NEXT_PUBLIC_DEFAULT_TIMEZONE || 'UTC'

const messagesMap: Record<Locale, typeof enMessages> = {
  en: enMessages,
  de: deMessages,
  es: esMessages,
  fr: frMessages,
  pt: ptMessages,
  zh: zhMessages,
  ja: jaMessages,
  ko: koMessages,
}

export async function getLocale() {
  // Get locale from cookie, fallback to default
  const cookieStore = await cookies()
  const localeCookie = cookieStore.get('locale')?.value
  
  let locale: Locale = defaultLocale
  if (localeCookie && locales.includes(localeCookie as Locale)) {
    locale = localeCookie as Locale
  }

  return {
    locale,
    messages: messagesMap[locale],
    timeZone: DEFAULT_TIME_ZONE
  }
}

export default getRequestConfig(async () => {
  // Get locale from cookie, fallback to default
  const cookieStore = await cookies()
  const localeCookie = cookieStore.get('locale')?.value
  
  let locale: Locale = defaultLocale
  if (localeCookie && locales.includes(localeCookie as Locale)) {
    locale = localeCookie as Locale
  }

  return {
    locale,
    messages: messagesMap[locale],
    timeZone: DEFAULT_TIME_ZONE
  }
})

