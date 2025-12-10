import type { Metadata } from "next";
import { Inter } from "next/font/google";
import Script from "next/script";
import "./globals.css";
import { ToastProvider } from "@/components/ui/Toast";
import { validateCoreFeatures } from "@/lib/feature-flags";
import { PageFadeIn } from "@/components/ui/FadeInWrapper";
import { createClient, validateSession } from '@/lib/supabase/server'
import { SupabaseProvider } from '@/components/providers/supabase-provider'
import { ThemeProvider, type InitialThemePreferences } from '@/components/providers/theme-provider'
import { TimezoneProvider } from '@/components/providers/timezone-provider'
import { getLocale } from '@/i18n/request'
import { LocaleProvider } from '@/components/providers/locale-provider'
import { AnalyticsInitializer } from '@/components/analytics/AnalyticsInitializer'
import { AnalyticsScripts } from '@/components/analytics/AnalyticsScripts'
import { CookieConsent } from '@/components/ui/CookieConsent'
import enMessages from '../messages/en.json'

const DEFAULT_TIME_ZONE = process.env.NEXT_PUBLIC_DEFAULT_TIMEZONE || 'UTC'

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

export const metadata: Metadata = {
  title: "DOER - AI-Powered Goal Achievement Platform",
  description: "Transform your goals into reality with AI-powered plans, progress tracking, and intelligent planning designed for achievers.",
  icons: {
    icon: '/icon.png',
    apple: '/icon.png',
  },
  viewport: {
    width: 'device-width',
    initialScale: 1,
    maximumScale: 5,
    userScalable: true,
  },
};

// Force dynamic rendering since we use cookies for auth and locale
export const dynamic = 'force-dynamic'

// Validate core features at startup
validateCoreFeatures();

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // Use validateSession to get user - this automatically handles invalid sessions
  let initialUser = null
  try {
    initialUser = await validateSession()
    // Only log if user is found (to reduce noise in logs for public pages)
    if (initialUser) {
      console.log('[layout] Initial user validated:', initialUser.id)
    }
  } catch (error: any) {
    // Only log actual errors, not missing sessions
    if (!error?.message?.includes('session') && !error?.message?.includes('Auth session missing')) {
      console.error('[layout] Error validating session:', error)
    }
    // Don't set initialUser if validation fails
    initialUser = null
  }

  // Get locale with error handling
  let locale = 'en'
  let messages = enMessages
  let timeZone = DEFAULT_TIME_ZONE
  try {
    const localeData = await getLocale()
    locale = localeData.locale
    messages = localeData.messages
    timeZone = localeData.timeZone || DEFAULT_TIME_ZONE
  } catch (error) {
    console.error('Error loading locale:', error)
    // Fallback to English messages (already imported)
  }

  let initialPreferences: InitialThemePreferences | undefined
  if (initialUser) {
    try {
      const supabaseClient = await createClient()
      const { data, error } = await supabaseClient
        .from('user_settings')
        .select('preferences')
        .eq('user_id', initialUser.id)
        .single()

      if (!error || error.code === 'PGRST116') {
        const prefs = data?.preferences
        initialPreferences = {
          userId: initialUser.id,
          theme: prefs?.theme,
          accentColor: prefs?.accent_color,
        }
      } else {
        console.error('[layout] Error loading user preferences:', error)
      }
    } catch (error) {
      console.error('[layout] Error loading user preferences:', error)
    }
  }
  
  // Determine if user is authenticated for script
  const isAuthenticated = Boolean(initialUser)
  
  return (
    <html 
      lang={locale} 
      className={`${inter.variable}`} 
      suppressHydrationWarning
      data-is-authenticated={isAuthenticated ? 'true' : 'false'}
    >
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                try {
                  // Check if we're on a public page (not dashboard, schedule, settings)
                  const path = window.location.pathname;
                  const isAuthenticatedRoute = path.includes('/dashboard') || path.includes('/schedule') || path.includes('/settings') || path.includes('/onboarding');
                  
                  // Check authentication state from data attribute (server-rendered)
                  const htmlElement = document.documentElement;
                  const serverAuthState = htmlElement.getAttribute('data-is-authenticated') === 'true';
                  
                  // Determine if this is truly a public page
                  // Must be: not an authenticated route AND not authenticated
                  const isPublicPage = !isAuthenticatedRoute || !serverAuthState;
                  
                  let savedTheme, resolvedTheme;
                  
                  if (isPublicPage) {
                    // Use public theme for public pages - ALWAYS ignore 'theme' key
                    // This prevents stale user theme data from overriding public theme
                    savedTheme = localStorage.getItem('publicTheme');
                    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
                    resolvedTheme = savedTheme === 'light' ? 'light' : (savedTheme === 'dark' ? 'dark' : (prefersDark ? 'dark' : 'light'));
                  } else {
                    // Use user theme for authenticated routes with valid authentication
                    savedTheme = localStorage.getItem('theme');
                    const savedAccentColor = localStorage.getItem('accentColor');
                    
                    // Theme colors - adjusted to match green's lightness (61.37%)
                    const accentColors = {
                      default: '#949aa5',
                      blue: '#4387f6',
                      green: '#51e889',
                      yellow: '#f7b442',
                      pink: '#ec4d9c',
                      orange: '#ff9c3a',
                      purple: '#7a44f5'
                    };
                    
                    // Determine resolved theme
                    resolvedTheme = 'dark';
                    if (savedTheme === 'light') {
                      resolvedTheme = 'light';
                    } else if (savedTheme === 'system') {
                      const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
                      resolvedTheme = mediaQuery.matches ? 'dark' : 'light';
                    }
                    
                    // Apply accent color immediately
                    const accentColor = savedAccentColor && accentColors[savedAccentColor] ? accentColors[savedAccentColor] : accentColors.orange;
                    document.documentElement.style.setProperty('--accent-color', accentColor);
                    document.documentElement.style.setProperty('--primary', accentColor);
                    document.documentElement.style.setProperty('--ring', accentColor);
                  }
                  
                  // Apply theme class immediately
                  document.documentElement.classList.remove('dark', 'light');
                  document.documentElement.classList.add(resolvedTheme);
                  
                  // Apply body classes
                  const body = document.body;
                  if (resolvedTheme === 'light') {
                    body.className = 'font-sans antialiased bg-white text-gray-900';
                    body.classList.add('light-theme');
                    body.classList.remove('dark-theme');
                  } else {
                    body.className = 'font-sans antialiased bg-gray-900 text-[#d7d2cb]';
                    body.classList.add('dark-theme');
                    body.classList.remove('light-theme');
                  }
                } catch (e) {
                  // Fallback to dark theme if there's an error
                  document.documentElement.classList.add('dark');
                }
              })();
            `,
          }}
        />
      </head>
      <body className="font-sans antialiased" suppressHydrationWarning>
        <AnalyticsScripts />
        <LocaleProvider locale={locale} messages={messages} timeZone={timeZone}>
          <SupabaseProvider initialUser={initialUser}>
            <ThemeProvider initialPreferences={initialPreferences}>
              <TimezoneProvider>
                <ToastProvider>
                  <AnalyticsInitializer />
                  <CookieConsent />
                  <PageFadeIn className="min-h-screen">
                    {children}
                  </PageFadeIn>
                </ToastProvider>
              </TimezoneProvider>
            </ThemeProvider>
          </SupabaseProvider>
        </LocaleProvider>
      </body>
    </html>
  );
}

