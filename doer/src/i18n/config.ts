export const locales = ['en', 'de', 'es', 'fr', 'pt', 'zh', 'ja', 'ko'] as const
export type Locale = (typeof locales)[number]

export const defaultLocale: Locale = 'en'

export const localeNames: Record<Locale, string> = {
  en: 'English',
  de: 'Deutsch',
  es: 'Español',
  fr: 'Français',
  pt: 'Português',
  zh: '中文',
  ja: '日本語',
  ko: '한국어',
}

